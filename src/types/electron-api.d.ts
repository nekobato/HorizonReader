import type { OnelineElectronApi } from '@shared/app-state'

declare global {
  interface Window {
    readonly oneline?: OnelineElectronApi
  }

  interface HTMLWebViewElement extends HTMLElement {
    readonly getURL: () => string
    readonly getTitle: () => string
    readonly isLoading: () => boolean
    readonly canGoBack: () => boolean
    readonly canGoForward: () => boolean
    readonly loadURL: (url: string) => Promise<void>
    readonly goBack: () => void
    readonly goForward: () => void
    readonly reload: () => void
    readonly send: (channel: string, ...args: unknown[]) => void
    readonly openDevTools: () => void
  }
}

export {}
