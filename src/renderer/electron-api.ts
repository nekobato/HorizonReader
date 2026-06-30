import type {
  BrowserState,
  DomSelection,
  HistoryEntry,
  OnelineElectronApi,
  ReadingPosition,
  WebviewCommand,
  WebviewStatus
} from '@shared/app-state'
import { recordHistoryPosition, recordHistorySelection, recordHistoryVisit } from '@shared/history'
import { getDefaultHomeUrl, normalizeNavigationInput } from '@shared/url'

let fallbackState: BrowserState = {
  currentUrl: getDefaultHomeUrl(),
  title: 'Oneline Browser',
  canGoBack: false,
  canGoForward: false,
  isLoading: false,
  controllerVisible: true,
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
    message: 'Auto updates are unavailable in browser-only renderer QA.',
    checkedAt: null
  }
}

const stateListeners = new Set<(state: BrowserState) => void>()
const commandListeners = new Set<(command: WebviewCommand) => void>()

/**
 * Applies a fallback history update for browser-only renderer QA.
 */
const patchFallbackHistory = (entries: readonly HistoryEntry[]): void => {
  patchFallbackState({ historyEntries: entries })
}

/**
 * Emits fallback state updates for browser-only renderer QA.
 */
const emitFallbackState = (): void => {
  for (const listener of stateListeners) {
    listener(fallbackState)
  }
}

/**
 * Applies a fallback state patch for browser-only renderer QA.
 */
const patchFallbackState = (patch: Partial<BrowserState>): BrowserState => {
  fallbackState = { ...fallbackState, ...patch }
  emitFallbackState()
  return fallbackState
}

/**
 * Provides a no-op Electron bridge for running renderer pages in a regular browser.
 */
const fallbackApi: OnelineElectronApi = {
  getState: async () => fallbackState,
  loadUrl: async (rawInput) => {
    const url = normalizeNavigationInput(rawInput)
    patchFallbackHistory(
      recordHistoryVisit(fallbackState.historyEntries, {
        id: crypto.randomUUID(),
        url,
        title: url,
        visitedAt: new Date().toISOString()
      })
    )
    const nextState = patchFallbackState({
      currentUrl: url,
      title: url,
      isLoading: false,
      historyVisible: false,
      restoreRequest: null
    })

    for (const listener of commandListeners) {
      listener({ type: 'load-url', url })
    }

    return nextState
  },
  goBack: async () => undefined,
  goForward: async () => undefined,
  reload: async () => undefined,
  toggleController: async () =>
    patchFallbackState({ controllerVisible: !fallbackState.controllerVisible }) && undefined,
  setControllerVisible: async (visible) =>
    patchFallbackState({ controllerVisible: visible }) && undefined,
  setHistoryVisible: async (visible) =>
    patchFallbackState({ historyVisible: visible, controllerVisible: true }) && undefined,
  openHistoryEntry: async (entryId) => {
    const entry = fallbackState.historyEntries.find((historyEntry) => historyEntry.id === entryId)

    if (!entry) {
      return fallbackState
    }

    patchFallbackState({
      currentUrl: entry.url,
      title: entry.title,
      isLoading: false,
      historyVisible: false,
      selectedDom: entry.selectedDom,
      restoreRequest: {
        id: crypto.randomUUID(),
        url: entry.url,
        selectedDom: entry.selectedDom,
        scrollY: entry.scrollY
      }
    })

    for (const listener of commandListeners) {
      listener({
        type: 'load-url',
        url: entry.url,
        restore: { selectedDom: entry.selectedDom, scrollY: entry.scrollY }
      })
    }

    return fallbackState
  },
  setSelectionMode: async (enabled) => patchFallbackState({ selectionMode: enabled }) && undefined,
  setMainLineHeight: async (_lineHeight) => undefined,
  reportWebviewStatus: async (status: WebviewStatus) => {
    patchFallbackHistory(
      recordHistoryVisit(fallbackState.historyEntries, {
        id: crypto.randomUUID(),
        url: status.currentUrl,
        title: status.title,
        visitedAt: new Date().toISOString()
      })
    )
    patchFallbackState({
      currentUrl: status.currentUrl,
      title: status.title,
      canGoBack: status.canGoBack,
      canGoForward: status.canGoForward,
      isLoading: status.isLoading
    })
  },
  reportDomSelection: async (selection: DomSelection) => {
    patchFallbackHistory(
      recordHistorySelection(fallbackState.historyEntries, {
        url: fallbackState.currentUrl,
        selectedDom: selection,
        updatedAt: new Date().toISOString()
      })
    )
    patchFallbackState({ selectedDom: selection, selectionMode: false })
  },
  reportReadingPosition: async (position: ReadingPosition) => {
    patchFallbackHistory(
      recordHistoryPosition(fallbackState.historyEntries, position, new Date().toISOString())
    )
  },
  checkForUpdates: async () =>
    patchFallbackState({
      update: {
        ...fallbackState.update,
        phase: 'disabled',
        message: 'Auto updates are unavailable in browser-only renderer QA.'
      }
    }).update,
  installUpdate: async () => undefined,
  quit: async () => undefined,
  onStateChanged: (callback) => {
    stateListeners.add(callback)
    return () => stateListeners.delete(callback)
  },
  onWebviewCommand: (callback) => {
    commandListeners.add(callback)
    return () => commandListeners.delete(callback)
  }
}

/**
 * Returns the real Electron bridge when present, otherwise the renderer QA fallback.
 */
export const getOnelineApi = (): OnelineElectronApi => window.oneline ?? fallbackApi
