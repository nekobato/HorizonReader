import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OnelineElectronApi, WebviewStatus } from '@shared/app-state'
import { getOnelineApi } from '../electron-api'
import { useBrowserStore } from '../stores/browser'
import MainWindow from './MainWindow.vue'

vi.mock('../electron-api', () => ({ getOnelineApi: vi.fn() }))

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.clearAllMocks()
})

const setup = () => {
  const pinia = createPinia()
  const store = useBrowserStore(pinia)
  const page = { url: 'https://reading.test/article', loading: false }
  store.hydrate({ ...store.state, currentUrl: page.url })

  const reportWebviewStatus = vi.fn(async (status: WebviewStatus) => {
    store.hydrate({ ...store.state, ...status })
  })
  vi.mocked(getOnelineApi).mockReturnValue({
    getState: async () => store.state,
    loadUrl: async () => store.state,
    goBack: async () => undefined,
    goForward: async () => undefined,
    reload: async () => undefined,
    toggleController: async () => undefined,
    setControllerVisible: async () => undefined,
    setHistoryVisible: async () => undefined,
    openHistoryEntry: async () => store.state,
    setSelectionMode: async () => undefined,
    setMainLineHeight: async () => undefined,
    reportDomSelection: async () => undefined,
    reportReadingPosition: async () => undefined,
    checkForUpdates: async () => store.state.update,
    installUpdate: async () => undefined,
    quit: async () => undefined,
    onWebviewCommand: () => () => undefined,
    onStateChanged: () => () => undefined,
    reportWebviewStatus
  } satisfies OnelineElectronApi)

  const wrapper = mount(MainWindow, { global: { plugins: [pinia], stubs: { Icon: true } } })
  wrappers.push(wrapper)
  const webview = wrapper.get('webview').element
  const methods = {
    getURL: () => page.url,
    getTitle: () => 'Reading page',
    canGoBack: () => true,
    canGoForward: () => false,
    isLoading: () => page.loading,
    send: vi.fn(),
    loadURL: vi.fn(async (url: string) => {
      page.url = url
      page.loading = true
    })
  }
  Object.assign(webview, methods)

  const requestRestore = async (url = page.url) => {
    store.hydrate({
      ...store.state,
      currentUrl: url,
      isLoading: true,
      restoreRequest: {
        id: 'history-restore',
        url,
        selectedDom: { selector: '#reading', tagName: 'p', textPreview: 'Reading', lineHeight: 36 },
        scrollY: 108
      }
    })
    await flushPromises()
  }
  const restoreApplied = async () => {
    webview.dispatchEvent(
      Object.assign(new Event('ipc-message'), { channel: 'oneline:restore-applied', args: [] })
    )
    await flushPromises()
  }

  return { store, page, webview, methods, reportWebviewStatus, requestRestore, restoreApplied }
}

describe('history restore status', () => {
  it('clears loading after restoring the already displayed URL without reloading it', async () => {
    const { store, methods, reportWebviewStatus, requestRestore, restoreApplied } = setup()
    await requestRestore()
    expect(methods.loadURL).not.toHaveBeenCalled()
    expect(methods.send).toHaveBeenCalledWith('oneline:restore-reading-state', {
      selectedDom: store.state.restoreRequest?.selectedDom,
      scrollY: 108
    })
    expect(store.state.isLoading).toBe(true)

    await restoreApplied()

    expect(reportWebviewStatus).toHaveBeenCalledWith({
      currentUrl: 'https://reading.test/article',
      title: 'Reading page',
      canGoBack: true,
      canGoForward: false,
      isLoading: false
    })
    expect(store.state.isLoading).toBe(false)
  })

  it('waits for a different page to load before restoring its reading position', async () => {
    const { store, page, webview, methods, requestRestore, restoreApplied } = setup()
    await requestRestore('https://reading.test/next')
    expect(methods.loadURL).toHaveBeenCalledWith('https://reading.test/next')
    expect(methods.send).not.toHaveBeenCalled()
    expect(store.state.isLoading).toBe(true)

    page.loading = false
    webview.dispatchEvent(new Event('did-stop-loading'))
    await flushPromises()
    expect(methods.send).toHaveBeenCalledWith('oneline:restore-reading-state', {
      selectedDom: store.state.restoreRequest?.selectedDom,
      scrollY: 108
    })
    await restoreApplied()
    expect(store.state.currentUrl).toBe('https://reading.test/next')
    expect(store.state.isLoading).toBe(false)
  })

  it('reports the actual webview status if another load is still in progress', async () => {
    const { store, page, reportWebviewStatus, requestRestore, restoreApplied } = setup()
    await requestRestore()
    page.loading = true

    await restoreApplied()

    expect(reportWebviewStatus).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }))
    expect(store.state.isLoading).toBe(true)
  })
})
