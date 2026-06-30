/**
 * Identifies which renderer shell is being displayed by a BrowserWindow.
 */
export type WindowKind = 'main' | 'controller'

/**
 * Describes a command sent from the main process to the Main renderer webview.
 */
export type WebviewCommand =
  | {
      readonly type: 'load-url'
      readonly url: string
      readonly restore?: ReadingRestoreState | null
    }
  | { readonly type: 'go-back' }
  | { readonly type: 'go-forward' }
  | { readonly type: 'reload' }
  | { readonly type: 'set-selection-mode'; readonly enabled: boolean }

/**
 * Describes the selected readable DOM element inside the embedded page.
 */
export interface DomSelection {
  readonly selector: string
  readonly tagName: string
  readonly textPreview: string
  readonly lineHeight: number
}

/**
 * Describes the selected DOM and scroll offset restored from a history entry.
 */
export interface ReadingRestoreState {
  readonly selectedDom: DomSelection | null
  readonly scrollY: number
}

/**
 * Describes a one-shot restore request mirrored through shared state.
 */
export interface ReadingRestoreRequest extends ReadingRestoreState {
  readonly id: string
  readonly url: string
}

/**
 * Describes the current scroll position reported by the embedded page.
 */
export interface ReadingPosition {
  readonly url: string
  readonly scrollY: number
}

/**
 * Describes one persisted browsing history entry.
 */
export interface HistoryEntry {
  readonly id: string
  readonly url: string
  readonly title: string
  readonly visitedAt: string
  readonly updatedAt: string
  readonly selectedDom: DomSelection | null
  readonly scrollY: number
}

/**
 * Describes navigation state reported by the embedded webview.
 */
export interface WebviewStatus {
  readonly currentUrl: string
  readonly title: string
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly isLoading: boolean
}

/**
 * Describes the current auto-update lifecycle status.
 */
export type UpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/**
 * Shared auto-update state mirrored from the Electron main process.
 */
export interface UpdateState {
  readonly phase: UpdatePhase
  readonly currentVersion: string
  readonly availableVersion: string | null
  readonly percent: number | null
  readonly message: string | null
  readonly checkedAt: string | null
}

/**
 * Shared state mirrored to both renderer windows.
 */
export interface BrowserState {
  readonly currentUrl: string
  readonly title: string
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly isLoading: boolean
  readonly controllerVisible: boolean
  readonly historyVisible: boolean
  readonly selectionMode: boolean
  readonly selectedDom: DomSelection | null
  readonly historyEntries: readonly HistoryEntry[]
  readonly restoreRequest: ReadingRestoreRequest | null
  readonly webviewPreloadPath: string
  readonly update: UpdateState
}

/**
 * The IPC bridge exposed from Electron preload to Vue renderers.
 */
export interface OnelineElectronApi {
  readonly getState: () => Promise<BrowserState>
  readonly loadUrl: (rawInput: string) => Promise<BrowserState>
  readonly goBack: () => Promise<void>
  readonly goForward: () => Promise<void>
  readonly reload: () => Promise<void>
  readonly toggleController: () => Promise<void>
  readonly setControllerVisible: (visible: boolean) => Promise<void>
  readonly setHistoryVisible: (visible: boolean) => Promise<void>
  readonly openHistoryEntry: (entryId: string) => Promise<BrowserState>
  readonly setSelectionMode: (enabled: boolean) => Promise<void>
  readonly setMainLineHeight: (lineHeight: number) => Promise<void>
  readonly reportWebviewStatus: (status: WebviewStatus) => Promise<void>
  readonly reportDomSelection: (selection: DomSelection) => Promise<void>
  readonly reportReadingPosition: (position: ReadingPosition) => Promise<void>
  readonly checkForUpdates: () => Promise<UpdateState>
  readonly installUpdate: () => Promise<void>
  readonly quit: () => Promise<void>
  readonly onStateChanged: (callback: (state: BrowserState) => void) => () => void
  readonly onWebviewCommand: (callback: (command: WebviewCommand) => void) => () => void
}
