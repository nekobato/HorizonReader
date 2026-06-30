<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

import type {
  DomSelection,
  ReadingPosition,
  ReadingRestoreRequest,
  ReadingRestoreState,
  WebviewCommand,
  WebviewStatus
} from '@shared/app-state'
import { getOnelineApi } from '../electron-api'
import { useBrowserStore } from '../stores/browser'

type WebviewIpcMessageEvent = Event & {
  readonly channel: string
  readonly args: readonly unknown[]
}

type WebviewNavigationEvent = Event & {
  readonly url?: string
}

const browserStore = useBrowserStore()
const webviewRef = ref<HTMLWebViewElement | null>(null)
const initialUrl = ref(browserStore.state.currentUrl)
const pendingRestore = ref<ReadingRestoreState | null>(null)
const lastRestoreRequestId = ref<string | null>(null)
let removeCommandListener: (() => void) | null = null
let removeStateListener: (() => void) | null = null

const toolbarSelectionLabel = computed(() =>
  browserStore.state.selectionMode ? 'DOM selection active' : 'Select readable DOM'
)

/**
 * Returns the currently mounted webview element.
 */
const getWebview = (): HTMLWebViewElement | null => webviewRef.value

/**
 * Reports the current embedded-page navigation state to Electron.
 */
const reportStatus = async (): Promise<void> => {
  const webview = getWebview()

  if (!webview) {
    return
  }

  const status: WebviewStatus = {
    currentUrl: webview.getURL() || browserStore.state.currentUrl,
    title: webview.getTitle() || webview.getURL() || 'Oneline Browser',
    canGoBack: webview.canGoBack(),
    canGoForward: webview.canGoForward(),
    isLoading: webview.isLoading()
  }

  await browserStore.reportWebviewStatus(status)
}

/**
 * Sends the current DOM-selection state to the embedded page preload.
 */
const syncSelectionModeToWebview = (): void => {
  getWebview()?.send('oneline:set-selection-mode', browserStore.state.selectionMode)
}

/**
 * Sends a pending history restore payload once the page is ready to receive it.
 */
const applyPendingRestore = (): void => {
  const webview = getWebview()

  if (!webview || !pendingRestore.value || webview.isLoading()) {
    return
  }

  webview.send('oneline:restore-reading-state', pendingRestore.value)
}

/**
 * Applies a restore request mirrored through BrowserState.
 */
const applyRestoreRequest = async (request: ReadingRestoreRequest | null): Promise<void> => {
  if (!request || lastRestoreRequestId.value === request.id) {
    return
  }

  const webview = getWebview()
  lastRestoreRequestId.value = request.id
  pendingRestore.value = {
    selectedDom: request.selectedDom,
    scrollY: request.scrollY
  }

  if (!webview) {
    return
  }

  if (webview.getURL() !== request.url) {
    await webview.loadURL(request.url)
  }

  applyPendingRestore()
}

/**
 * Handles commands sent from Electron main to the embedded webview.
 */
const handleWebviewCommand = async (command: WebviewCommand): Promise<void> => {
  const webview = getWebview()

  if (!webview) {
    return
  }

  if (command.type === 'load-url') {
    pendingRestore.value = command.restore ?? null

    if (command.restore && webview.getURL() === command.url) {
      applyPendingRestore()
      return
    }

    await webview.loadURL(command.url)
    applyPendingRestore()
    return
  }

  if (command.type === 'go-back' && webview.canGoBack()) {
    webview.goBack()
    return
  }

  if (command.type === 'go-forward' && webview.canGoForward()) {
    webview.goForward()
    return
  }

  if (command.type === 'reload') {
    webview.reload()
    return
  }

  if (command.type === 'set-selection-mode') {
    webview.send('oneline:set-selection-mode', command.enabled)
  }
}

/**
 * Handles selected DOM metadata sent by the webview preload.
 */
const handleIpcMessage = async (event: Event): Promise<void> => {
  const message = event as WebviewIpcMessageEvent

  if (message.channel === 'oneline:dom-selected') {
    const [selection] = message.args as [DomSelection]
    await browserStore.reportDomSelection(selection)
    return
  }

  if (message.channel === 'oneline:reading-position') {
    const [position] = message.args as [ReadingPosition]
    await browserStore.reportReadingPosition(position)
    return
  }

  if (message.channel === 'oneline:restore-applied') {
    pendingRestore.value = null
  }
}

/**
 * Reports completed loading and retries any pending history restore.
 */
const handleLoadStopped = async (): Promise<void> => {
  await reportStatus()
  applyPendingRestore()
}

/**
 * Reports navigation after a URL-changing webview event.
 */
const handleNavigation = async (_event: WebviewNavigationEvent): Promise<void> => {
  await reportStatus()
  applyPendingRestore()
}

/**
 * Synchronizes page preload state after the embedded document is ready.
 */
const handleDomReady = (): void => {
  syncSelectionModeToWebview()
  applyPendingRestore()
}

/**
 * Toggles the Controller window from the Main toolbar.
 */
const toggleController = async (): Promise<void> => {
  await browserStore.toggleController()
}

/**
 * Toggles readable DOM selection mode.
 */
const toggleSelectionMode = async (): Promise<void> => {
  await browserStore.setSelectionMode(!browserStore.state.selectionMode)
}

watch(
  () => browserStore.state.selectionMode,
  () => syncSelectionModeToWebview()
)

watch(
  () => browserStore.state.restoreRequest?.id ?? null,
  () => {
    void applyRestoreRequest(browserStore.state.restoreRequest)
  }
)

onMounted(() => {
  removeCommandListener = getOnelineApi().onWebviewCommand(handleWebviewCommand)
  removeStateListener = getOnelineApi().onStateChanged((state) => {
    void applyRestoreRequest(state.restoreRequest)
  })

  const webview = getWebview()

  if (!webview) {
    return
  }

  webview.addEventListener('did-start-loading', reportStatus)
  webview.addEventListener('did-stop-loading', handleLoadStopped)
  webview.addEventListener('did-navigate', handleNavigation)
  webview.addEventListener('did-navigate-in-page', handleNavigation)
  webview.addEventListener('page-title-updated', reportStatus)
  webview.addEventListener('dom-ready', handleDomReady)
  webview.addEventListener('ipc-message', handleIpcMessage)
  void applyRestoreRequest(browserStore.state.restoreRequest)
})

onUnmounted(() => {
  const webview = getWebview()

  webview?.removeEventListener('did-start-loading', reportStatus)
  webview?.removeEventListener('did-stop-loading', handleLoadStopped)
  webview?.removeEventListener('did-navigate', handleNavigation)
  webview?.removeEventListener('did-navigate-in-page', handleNavigation)
  webview?.removeEventListener('page-title-updated', reportStatus)
  webview?.removeEventListener('dom-ready', handleDomReady)
  webview?.removeEventListener('ipc-message', handleIpcMessage)
  removeCommandListener?.()
  removeStateListener?.()
})
</script>

<template>
  <main class="main-shell">
    <webview
      ref="webviewRef"
      class="browser-webview"
      :src="initialUrl"
      :preload="browserStore.state.webviewPreloadPath"
      partition="persist:oneline-browser"
      webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
    />

    <nav class="main-toolbar" aria-label="Oneline browser controls">
      <div class="main-drag-handle" title="Move window" aria-hidden="true"></div>
      <button class="icon-button" type="button" title="Controller" @click="toggleController">
        <Icon icon="mingcute:remote-control-line" />
      </button>
      <button
        class="icon-button"
        :class="{ 'is-active': browserStore.state.selectionMode }"
        type="button"
        :title="toolbarSelectionLabel"
        @click="toggleSelectionMode"
      >
        <Icon icon="mingcute:align-left-line" />
      </button>
    </nav>
  </main>
</template>
