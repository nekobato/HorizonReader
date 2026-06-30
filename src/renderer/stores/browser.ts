import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  BrowserState,
  DomSelection,
  ReadingPosition,
  WebviewStatus,
  WindowKind
} from '@shared/app-state'
import { getDefaultHomeUrl } from '@shared/url'
import { getOnelineApi } from '../electron-api'

/**
 * Creates a renderer-safe fallback state before Electron preload hydration.
 */
const createFallbackState = (): BrowserState => ({
  currentUrl: getDefaultHomeUrl(),
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
  webviewPreloadPath: '',
  update: {
    phase: 'disabled',
    currentVersion: '0.0.0',
    availableVersion: null,
    percent: null,
    message: 'Auto updates are not initialized yet.',
    checkedAt: null
  }
})

/**
 * Stores browser state mirrored from the Electron main process.
 */
export const useBrowserStore = defineStore('browser', () => {
  const state = ref<BrowserState>(createFallbackState())
  const isReady = ref(false)
  const windowKind = ref<WindowKind>('main')

  const isMainWindow = computed(() => windowKind.value === 'main')

  /**
   * Updates the local mirror of the Electron-owned browser state.
   */
  const hydrate = (nextState: BrowserState): void => {
    state.value = nextState
    isReady.value = true
  }

  /**
   * Records the renderer shell kind for component selection.
   */
  const setWindowKind = (kind: WindowKind): void => {
    windowKind.value = kind
  }

  /**
   * Asks Electron to navigate the embedded page.
   */
  const loadUrl = async (rawInput: string): Promise<void> => {
    hydrate(await getOnelineApi().loadUrl(rawInput))
  }

  /**
   * Asks Electron to go backward in the webview history.
   */
  const goBack = async (): Promise<void> => {
    await getOnelineApi().goBack()
  }

  /**
   * Asks Electron to go forward in the webview history.
   */
  const goForward = async (): Promise<void> => {
    await getOnelineApi().goForward()
  }

  /**
   * Asks Electron to reload the embedded page.
   */
  const reload = async (): Promise<void> => {
    await getOnelineApi().reload()
  }

  /**
   * Toggles the Controller window visibility.
   */
  const toggleController = async (): Promise<void> => {
    await getOnelineApi().toggleController()
  }

  /**
   * Hides or shows the Controller window.
   */
  const setControllerVisible = async (visible: boolean): Promise<void> => {
    await getOnelineApi().setControllerVisible(visible)
  }

  /**
   * Expands or collapses the Controller history panel.
   */
  const setHistoryVisible = async (visible: boolean): Promise<void> => {
    await getOnelineApi().setHistoryVisible(visible)
  }

  /**
   * Opens a persisted history entry and restores its reading state.
   */
  const openHistoryEntry = async (entryId: string): Promise<void> => {
    hydrate(await getOnelineApi().openHistoryEntry(entryId))
  }

  /**
   * Enables or disables DOM target selection.
   */
  const setSelectionMode = async (enabled: boolean): Promise<void> => {
    await getOnelineApi().setSelectionMode(enabled)
  }

  /**
   * Reports selected DOM metadata from the Main webview host.
   */
  const reportDomSelection = async (selection: DomSelection): Promise<void> => {
    await getOnelineApi().reportDomSelection(selection)
  }

  /**
   * Reports current webview navigation status.
   */
  const reportWebviewStatus = async (status: WebviewStatus): Promise<void> => {
    await getOnelineApi().reportWebviewStatus(status)
  }

  /**
   * Reports current page scroll position from the Main webview host.
   */
  const reportReadingPosition = async (position: ReadingPosition): Promise<void> => {
    await getOnelineApi().reportReadingPosition(position)
  }

  /**
   * Manually checks GitHub Releases for an application update.
   */
  const checkForUpdates = async (): Promise<void> => {
    const update = await getOnelineApi().checkForUpdates()
    hydrate({ ...state.value, update })
  }

  /**
   * Installs a downloaded update immediately.
   */
  const installUpdate = async (): Promise<void> => {
    await getOnelineApi().installUpdate()
  }

  /**
   * Quits the Electron application.
   */
  const quit = async (): Promise<void> => {
    await getOnelineApi().quit()
  }

  return {
    state,
    isReady,
    windowKind,
    isMainWindow,
    hydrate,
    setWindowKind,
    loadUrl,
    goBack,
    goForward,
    reload,
    toggleController,
    setControllerVisible,
    setHistoryVisible,
    openHistoryEntry,
    setSelectionMode,
    reportDomSelection,
    reportWebviewStatus,
    reportReadingPosition,
    checkForUpdates,
    installUpdate,
    quit
  }
})
