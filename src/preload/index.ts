import { contextBridge, ipcRenderer } from 'electron'

import type {
  BrowserState,
  DomSelection,
  OnelineElectronApi,
  ReadingPosition,
  UpdateState,
  WebviewCommand,
  WebviewStatus
} from '@shared/app-state'

/**
 * Registers a typed IPC listener and returns a cleanup callback.
 */
const registerListener = <Payload>(
  channel: string,
  callback: (payload: Payload) => void
): (() => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: Payload): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api: OnelineElectronApi = {
  getState: () => ipcRenderer.invoke('state:get') as Promise<BrowserState>,
  loadUrl: (rawInput) => ipcRenderer.invoke('navigation:load', rawInput) as Promise<BrowserState>,
  goBack: () => ipcRenderer.invoke('navigation:back') as Promise<void>,
  goForward: () => ipcRenderer.invoke('navigation:forward') as Promise<void>,
  reload: () => ipcRenderer.invoke('navigation:reload') as Promise<void>,
  toggleController: () => ipcRenderer.invoke('controller:toggle') as Promise<void>,
  setControllerVisible: (visible) =>
    ipcRenderer.invoke('controller:set-visible', visible) as Promise<void>,
  setHistoryVisible: (visible) =>
    ipcRenderer.invoke('history:set-visible', visible) as Promise<void>,
  openHistoryEntry: (entryId) =>
    ipcRenderer.invoke('history:open', entryId) as Promise<BrowserState>,
  setSelectionMode: (enabled) => ipcRenderer.invoke('selection:set-mode', enabled) as Promise<void>,
  setMainLineHeight: (lineHeight) =>
    ipcRenderer.invoke('main:set-line-height', lineHeight) as Promise<void>,
  reportWebviewStatus: (status: WebviewStatus) =>
    ipcRenderer.invoke('webview:status', status) as Promise<void>,
  reportDomSelection: (selection: DomSelection) =>
    ipcRenderer.invoke('dom:selected', selection) as Promise<void>,
  reportReadingPosition: (position: ReadingPosition) =>
    ipcRenderer.invoke('reading:position', position) as Promise<void>,
  checkForUpdates: () => ipcRenderer.invoke('updates:check') as Promise<UpdateState>,
  installUpdate: () => ipcRenderer.invoke('updates:install') as Promise<void>,
  quit: () => ipcRenderer.invoke('app:quit') as Promise<void>,
  onStateChanged: (callback) => registerListener<BrowserState>('state:changed', callback),
  onWebviewCommand: (callback) => registerListener<WebviewCommand>('webview:command', callback)
}

contextBridge.exposeInMainWorld('oneline', api)
