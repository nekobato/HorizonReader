import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { app, BrowserWindow, Menu, type Rectangle, screen, session } from 'electron'
import type { AppUpdater, Logger, ProgressInfo, UpdateInfo } from 'electron-updater'

import type {
  BrowserState,
  DomSelection,
  HistoryEntry,
  ReadingPosition,
  ReadingRestoreState,
  UpdateState,
  WebviewCommand,
  WebviewStatus
} from '@shared/app-state'
import { recordHistoryPosition, recordHistorySelection, recordHistoryVisit } from '@shared/history'
import { coerceMainHeight, DEFAULT_MAIN_HEIGHT } from '@shared/line-height'
import { normalizeNavigationInput } from '@shared/url'
import { calculateControllerPlacement, type RectangleLike } from '@shared/window-placement'

const CONTROLLER_WIDTH = 740
const CONTROLLER_COLLAPSED_HEIGHT = 76
const CONTROLLER_EXPANDED_HEIGHT = 360
const DEFAULT_MAIN_BOUNDS = { width: 960, height: DEFAULT_MAIN_HEIGHT } as const

interface PersistedState {
  readonly currentUrl: string
  readonly mainBounds?: Rectangle
  readonly historyEntries: readonly HistoryEntry[]
}

interface PersistedStore {
  readonly get: <Key extends keyof PersistedState>(key: Key) => PersistedState[Key]
  readonly set: <Key extends keyof PersistedState>(key: Key, value: PersistedState[Key]) => void
}

let mainWindow: BrowserWindow | null = null
let controllerWindow: BrowserWindow | null = null
let persistedStore: PersistedStore | null = null
let isQuitting = false
let isAutoUpdaterConfigured = false
let autoUpdaterInstance: AppUpdater | null = null

const requireRuntimeDependency = createRequire(import.meta.url)
const currentDir = dirname(fileURLToPath(import.meta.url))
const updateMetadataPath = join(process.resourcesPath, 'app-update.yml')
const rendererEntry = join(currentDir, '../renderer/index.html')
const rendererDevUrl = process.env.ELECTRON_RENDERER_URL
const shellPreloadPath = join(currentDir, '../preload/index.cjs')
const webviewPreloadPath = join(currentDir, '../preload/webview.cjs')
const webviewPreloadUrl = pathToFileURL(webviewPreloadPath).toString()

interface ElectronUpdaterModule {
  readonly autoUpdater?: AppUpdater
  readonly default?: {
    readonly autoUpdater?: AppUpdater
  }
}

interface UpdateLogger extends Logger {
  readonly initialize: () => void
  readonly transports: {
    readonly file: {
      level: string
    }
  }
  readonly info: (...messages: readonly unknown[]) => void
  readonly warn: (...messages: readonly unknown[]) => void
  readonly error: (...messages: readonly unknown[]) => void
}

/**
 * Returns whether this packaged app contains electron-updater metadata.
 */
const isAutoUpdateResourceAvailable = (): boolean =>
  app.isPackaged && existsSync(updateMetadataPath)

/**
 * Creates the initial auto-update state for the current runtime.
 */
const createInitialUpdateState = (): UpdateState => {
  const isUpdateEnabled = isAutoUpdateResourceAvailable()

  return {
    phase: isUpdateEnabled ? 'idle' : 'disabled',
    currentVersion: app.getVersion(),
    availableVersion: null,
    percent: null,
    message: isUpdateEnabled
      ? null
      : app.isPackaged
        ? 'Auto update metadata is not available in this local package.'
        : 'Auto updates are disabled in development builds.',
    checkedAt: null
  }
}

let browserState: BrowserState = {
  currentUrl: normalizeNavigationInput(''),
  title: 'Oneline Browser',
  canGoBack: false,
  canGoForward: false,
  isLoading: false,
  controllerVisible: false,
  historyVisible: false,
  selectionMode: false,
  selectedDom: null,
  historyEntries: [],
  restoreRequest: null,
  webviewPreloadPath: webviewPreloadUrl,
  update: createInitialUpdateState()
}

app.setName('Oneline Browser')

/**
 * Creates the electron-store wrapper used for small persisted app preferences.
 */
const createPersistedStore = async (): Promise<PersistedStore> => {
  const { default: Store } = await import('electron-store')
  return new Store<PersistedState>({
    defaults: {
      currentUrl: normalizeNavigationInput(''),
      historyEntries: []
    }
  }) as PersistedStore
}

/**
 * Sends the latest browser state to all active renderer windows.
 */
const broadcastState = (): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('state:changed', browserState)
  }
}

/**
 * Applies a partial browser state update and mirrors it to renderers.
 */
const patchState = (patch: Partial<BrowserState>): BrowserState => {
  browserState = { ...browserState, ...patch }
  broadcastState()
  return browserState
}

/**
 * Applies an auto-update state patch and mirrors it to renderers.
 */
const patchUpdateState = (patch: Partial<UpdateState>): UpdateState => {
  const update = { ...browserState.update, ...patch }
  patchState({ update })
  return update
}

/**
 * Persists the current in-memory history list.
 */
const persistHistoryEntries = (): void => {
  persistedStore?.set('historyEntries', browserState.historyEntries)
}

/**
 * Returns the controller dimensions for the current history panel state.
 */
const getControllerSize = (): { readonly width: number; readonly height: number } => ({
  width: CONTROLLER_WIDTH,
  height: browserState.historyVisible ? CONTROLLER_EXPANDED_HEIGHT : CONTROLLER_COLLAPSED_HEIGHT
})

/**
 * Applies a history list update and persists it immediately.
 */
const patchHistoryEntries = (entries: readonly HistoryEntry[]): readonly HistoryEntry[] => {
  patchState({ historyEntries: entries })
  persistHistoryEntries()
  return entries
}

/**
 * Records a visit for the current embedded page.
 */
const recordCurrentVisit = (status: WebviewStatus): void => {
  patchHistoryEntries(
    recordHistoryVisit(browserState.historyEntries, {
      id: randomUUID(),
      url: status.currentUrl,
      title: status.title || status.currentUrl,
      visitedAt: new Date().toISOString()
    })
  )
}

/**
 * Records the current selected readable DOM target.
 */
const recordCurrentSelection = (selection: DomSelection): void => {
  patchHistoryEntries(
    recordHistorySelection(browserState.historyEntries, {
      url: browserState.currentUrl,
      selectedDom: selection,
      updatedAt: new Date().toISOString()
    })
  )
}

/**
 * Records the current scroll offset from the embedded page.
 */
const recordCurrentPosition = (position: ReadingPosition): void => {
  patchHistoryEntries(
    recordHistoryPosition(browserState.historyEntries, position, new Date().toISOString())
  )
}

/**
 * Converts an unknown thrown value into a readable updater error message.
 */
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Converts updater failures into concise user-facing status text.
 */
const getUpdateStatusMessage = (error: unknown): string => {
  const rawMessage = getErrorMessage(error)

  if (rawMessage.includes('app-update.yml') && rawMessage.includes('ENOENT')) {
    return 'Auto update metadata is not available in this local package.'
  }

  if (rawMessage.includes('releases.atom') && rawMessage.includes('404')) {
    return 'GitHub Release metadata was not found. Publish a release with latest-mac.yml first.'
  }

  return rawMessage.split('\n')[0]?.slice(0, 180) ?? 'Auto update failed.'
}

/**
 * Loads CommonJS updater dependencies from the packaged ESM main process.
 */
const loadAutoUpdateDependencies = (): {
  readonly autoUpdater: AppUpdater
  readonly log: UpdateLogger
} => {
  const updaterModule = requireRuntimeDependency('electron-updater') as ElectronUpdaterModule
  const autoUpdater = updaterModule.autoUpdater ?? updaterModule.default?.autoUpdater

  if (!autoUpdater) {
    throw new Error('electron-updater autoUpdater export was not found.')
  }

  const log = requireRuntimeDependency('electron-log/main') as UpdateLogger
  autoUpdaterInstance = autoUpdater

  return { autoUpdater, log }
}

/**
 * Loads the renderer shell with a query that identifies the window role.
 */
const loadRenderer = async (
  window: BrowserWindow,
  windowKind: 'main' | 'controller'
): Promise<void> => {
  if (rendererDevUrl) {
    await window.loadURL(`${rendererDevUrl}?window=${windowKind}`)
    return
  }

  await window.loadFile(rendererEntry, { query: { window: windowKind } })
}

/**
 * Persists the Main window bounds after user movement or resizing.
 */
const persistMainBounds = (): void => {
  if (!mainWindow || !persistedStore) {
    return
  }

  persistedStore.set('mainBounds', mainWindow.getBounds())
}

/**
 * Centers the default Main window near the lower portion of the primary display.
 */
const getInitialMainBounds = (): Rectangle => {
  const savedBounds = persistedStore?.get('mainBounds')

  if (savedBounds) {
    return savedBounds
  }

  const { workArea } = screen.getPrimaryDisplay()
  const x = Math.round(workArea.x + (workArea.width - DEFAULT_MAIN_BOUNDS.width) / 2)
  const y = Math.round(workArea.y + workArea.height - DEFAULT_MAIN_BOUNDS.height - 48)

  return {
    x,
    y,
    width: DEFAULT_MAIN_BOUNDS.width,
    height: DEFAULT_MAIN_BOUNDS.height
  }
}

/**
 * Creates the one-line content window.
 */
const createMainWindow = async (): Promise<BrowserWindow> => {
  const bounds = getInitialMainBounds()
  const window = new BrowserWindow({
    ...bounds,
    minWidth: 420,
    minHeight: 28,
    frame: false,
    show: false,
    backgroundColor: '#f8f7f2',
    webPreferences: {
      preload: shellPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true
    }
  })

  window.once('ready-to-show', () => window.show())
  window.on('move', persistMainBounds)
  window.on('resize', persistMainBounds)
  window.on('closed', () => {
    mainWindow = null

    if (!isQuitting) {
      isQuitting = true
      app.quit()
    }
  })

  await loadRenderer(window, 'main')
  return window
}

/**
 * Creates the compact browser-controller window.
 */
const createControllerWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: CONTROLLER_WIDTH,
    height: CONTROLLER_COLLAPSED_HEIGHT,
    minWidth: CONTROLLER_WIDTH,
    maxWidth: CONTROLLER_WIDTH,
    minHeight: CONTROLLER_COLLAPSED_HEIGHT,
    maxHeight: CONTROLLER_EXPANDED_HEIGHT,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#fbfaf6',
    webPreferences: {
      preload: shellPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  window.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    setControllerVisible(false)
  })

  await loadRenderer(window, 'controller')
  return window
}

/**
 * Positions Controller above or below Main depending on available screen space.
 */
const positionControllerWindow = (): void => {
  if (!mainWindow || !controllerWindow) {
    return
  }

  const mainBounds = mainWindow.getBounds()
  const { workArea } = screen.getDisplayMatching(mainBounds)
  const controllerSize = getControllerSize()
  const nextBounds = calculateControllerPlacement(
    mainBounds,
    controllerSize,
    workArea as RectangleLike
  )

  controllerWindow.setBounds(nextBounds)
}

/**
 * Shows or hides the Controller window.
 */
const setControllerVisible = (visible: boolean): void => {
  if (!controllerWindow) {
    return
  }

  if (visible) {
    positionControllerWindow()
    controllerWindow.show()
    controllerWindow.focus()
  } else {
    if (browserState.historyVisible) {
      patchState({ historyVisible: false })
      positionControllerWindow()
    }

    controllerWindow.hide()
    mainWindow?.focus()
  }

  patchState({ controllerVisible: visible })
}

/**
 * Expands or collapses the Controller history panel.
 */
const setHistoryVisible = (visible: boolean): void => {
  if (!controllerWindow) {
    return
  }

  patchState({ historyVisible: visible })
  positionControllerWindow()

  if (visible && !browserState.controllerVisible) {
    controllerWindow.show()
    controllerWindow.focus()
    patchState({ controllerVisible: true })
  }
}

/**
 * Sends a navigation command to the Main renderer webview host.
 */
const sendWebviewCommand = (command: WebviewCommand): void => {
  mainWindow?.webContents.send('webview:command', command)
}

/**
 * Resizes Main to the selected text line height while preserving the top-left anchor.
 */
const resizeMainToLineHeight = (lineHeight: number): void => {
  if (!mainWindow) {
    return
  }

  const bounds = mainWindow.getBounds()
  const height = coerceMainHeight(lineHeight)
  mainWindow.setBounds({ ...bounds, height })
  persistMainBounds()
}

/**
 * Builds the restore payload used when opening a persisted history entry.
 */
const createRestoreState = (entry: HistoryEntry): ReadingRestoreState => ({
  selectedDom: entry.selectedDom,
  scrollY: entry.scrollY
})

/**
 * Builds a renderer-side script that restores a history entry in the webview.
 */
const createHistoryRestoreScript = (entry: HistoryEntry): string => {
  const url = JSON.stringify(entry.url)
  const restore = JSON.stringify(createRestoreState(entry))

  return `
    (() => {
      const webview = document.querySelector('webview')

      if (!webview) {
        return
      }

      const restore = ${restore}
      const applyRestore = () => webview.send('oneline:restore-reading-state', restore)

      if (typeof webview.getURL === 'function' && webview.getURL() !== ${url}) {
        webview.addEventListener('did-stop-loading', applyRestore, { once: true })
        void webview.loadURL(${url})
        return
      }

      applyRestore()
    })()
  `
}

/**
 * Sends a history restore request directly to the Main renderer webview host.
 */
const restoreHistoryEntryInRenderer = (entry: HistoryEntry): void => {
  void mainWindow?.webContents.executeJavaScript(createHistoryRestoreScript(entry)).catch(() => {
    sendWebviewCommand({ type: 'load-url', url: entry.url, restore: createRestoreState(entry) })
  })
}

/**
 * Opens a persisted history entry and asks the webview to restore its reading state.
 */
const openHistoryEntry = (entryId: string): BrowserState => {
  const entry = browserState.historyEntries.find((historyEntry) => historyEntry.id === entryId)

  if (!entry) {
    return browserState
  }

  persistedStore?.set('currentUrl', entry.url)

  if (entry.selectedDom) {
    resizeMainToLineHeight(entry.selectedDom.lineHeight)
  }

  patchState({
    currentUrl: entry.url,
    title: entry.title || entry.url,
    isLoading: true,
    historyVisible: false,
    selectionMode: false,
    selectedDom: entry.selectedDom,
    restoreRequest: {
      id: randomUUID(),
      url: entry.url,
      ...createRestoreState(entry)
    }
  })
  positionControllerWindow()
  restoreHistoryEntryInRenderer(entry)
  return browserState
}

/**
 * Registers all IPC handlers used by the renderer preload bridge.
 */
const registerIpcHandlers = async (): Promise<void> => {
  const { ipcMain } = await import('electron')

  ipcMain.handle('state:get', () => browserState)

  ipcMain.handle('navigation:load', (_event, rawInput: string) => {
    const nextUrl = normalizeNavigationInput(rawInput)
    persistedStore?.set('currentUrl', nextUrl)
    patchState({
      currentUrl: nextUrl,
      title: nextUrl,
      isLoading: true,
      historyVisible: false,
      selectionMode: false,
      selectedDom: null,
      restoreRequest: null
    })
    sendWebviewCommand({ type: 'load-url', url: nextUrl })
    return browserState
  })

  ipcMain.handle('navigation:back', () => sendWebviewCommand({ type: 'go-back' }))
  ipcMain.handle('navigation:forward', () => sendWebviewCommand({ type: 'go-forward' }))
  ipcMain.handle('navigation:reload', () => sendWebviewCommand({ type: 'reload' }))
  ipcMain.handle('controller:toggle', () => setControllerVisible(!browserState.controllerVisible))
  ipcMain.handle('controller:set-visible', (_event, visible: boolean) =>
    setControllerVisible(visible)
  )
  ipcMain.handle('history:set-visible', (_event, visible: boolean) => setHistoryVisible(visible))
  ipcMain.handle('history:open', (_event, entryId: string) => openHistoryEntry(entryId))
  ipcMain.handle('selection:set-mode', (_event, enabled: boolean) => {
    patchState({ selectionMode: enabled })
    sendWebviewCommand({ type: 'set-selection-mode', enabled })
  })
  ipcMain.handle('main:set-line-height', (_event, lineHeight: number) =>
    resizeMainToLineHeight(lineHeight)
  )
  ipcMain.handle('webview:status', (_event, status: WebviewStatus) => {
    persistedStore?.set('currentUrl', status.currentUrl)
    recordCurrentVisit(status)
    patchState({
      currentUrl: status.currentUrl,
      title: status.title || status.currentUrl,
      canGoBack: status.canGoBack,
      canGoForward: status.canGoForward,
      isLoading: status.isLoading
    })
  })
  ipcMain.handle('dom:selected', (_event, selection: DomSelection) => {
    recordCurrentSelection(selection)
    patchState({ selectedDom: selection, selectionMode: false })
    resizeMainToLineHeight(selection.lineHeight)
    sendWebviewCommand({ type: 'set-selection-mode', enabled: false })
  })
  ipcMain.handle('reading:position', (_event, position: ReadingPosition) => {
    recordCurrentPosition(position)
  })
  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:install', () => installUpdate())
  ipcMain.handle('app:quit', () => {
    isQuitting = true
    app.quit()
  })
}

/**
 * Applies defensive defaults for untrusted web content.
 */
const configureSecurityDefaults = (): void => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })
}

/**
 * Registers electron-updater event handlers once.
 */
const configureAutoUpdater = (): AppUpdater => {
  if (isAutoUpdaterConfigured) {
    if (!autoUpdaterInstance) {
      throw new Error('Auto updater was marked configured before it was loaded.')
    }

    return autoUpdaterInstance
  }

  const { autoUpdater, log } = loadAutoUpdateDependencies()

  isAutoUpdaterConfigured = true
  log.initialize()
  log.transports.file.level = 'info'
  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update')
    patchUpdateState({
      phase: 'checking',
      percent: null,
      message: 'Checking for updates...',
      checkedAt: new Date().toISOString()
    })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available', info.version)
    patchUpdateState({
      phase: 'available',
      availableVersion: info.version,
      percent: null,
      message: `Version ${info.version} is available.`
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('Update not available', info.version)
    patchUpdateState({
      phase: 'not-available',
      availableVersion: null,
      percent: null,
      message: 'Oneline Browser is up to date.',
      checkedAt: new Date().toISOString()
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    patchUpdateState({
      phase: 'downloading',
      percent: Math.round(progress.percent * 10) / 10,
      message: `Downloading update: ${progress.percent.toFixed(1)}%`
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('Update downloaded', info.version)
    patchUpdateState({
      phase: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      message: `Version ${info.version} will be installed when the app quits.`
    })
  })

  autoUpdater.on('error', (error: Error) => {
    const rawMessage = getErrorMessage(error)
    log.error('Auto update failed', rawMessage)
    patchUpdateState({
      phase: 'error',
      percent: null,
      message: getUpdateStatusMessage(error)
    })
  })

  return autoUpdater
}

/**
 * Checks GitHub Releases for an update when running as a packaged app.
 */
const checkForUpdates = async (): Promise<UpdateState> => {
  if (!app.isPackaged) {
    return patchUpdateState({
      phase: 'disabled',
      message: 'Auto updates are disabled in development builds.'
    })
  }

  if (!isAutoUpdateResourceAvailable()) {
    return patchUpdateState({
      phase: 'disabled',
      message: 'Auto update metadata is not available in this local package.'
    })
  }

  try {
    const autoUpdater = configureAutoUpdater()
    await autoUpdater.checkForUpdates()
  } catch (error) {
    patchUpdateState({
      phase: 'error',
      percent: null,
      message: getUpdateStatusMessage(error)
    })
  }

  return browserState.update
}

/**
 * Installs a downloaded update immediately.
 */
const installUpdate = (): void => {
  if (browserState.update.phase !== 'downloaded') {
    return
  }

  const autoUpdater = autoUpdaterInstance ?? configureAutoUpdater()
  isQuitting = true
  autoUpdater.quitAndInstall(false, true)
}

/**
 * Starts the launch-time update check after the renderer windows exist.
 */
const scheduleLaunchUpdateCheck = (): void => {
  if (!isAutoUpdateResourceAvailable()) {
    return
  }

  setTimeout(() => {
    void checkForUpdates()
  }, 5000)
}

/**
 * Starts the Electron application.
 */
const bootstrap = async (): Promise<void> => {
  persistedStore = await createPersistedStore()
  browserState = {
    ...browserState,
    currentUrl: persistedStore.get('currentUrl') ?? normalizeNavigationInput(''),
    historyEntries: persistedStore.get('historyEntries') ?? [],
    webviewPreloadPath: webviewPreloadUrl
  }

  await app.whenReady()
  Menu.setApplicationMenu(null)
  configureSecurityDefaults()
  await registerIpcHandlers()

  mainWindow = await createMainWindow()
  controllerWindow = await createControllerWindow()
  scheduleLaunchUpdateCheck()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow()
      controllerWindow = await createControllerWindow()
    }
  })
}

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

void bootstrap()
