import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

// This test uses Chromium layout; jsdom cannot measure a webview's guest viewport.
const profile = mkdtempSync(join(tmpdir(), 'oneline-layout-test-'))
for (const [key, suffix] of [
  ['userData', ''],
  ['sessionData', 'sessions'],
  ['logs', 'logs']
]) {
  const directory = join(profile, suffix)
  mkdirSync(directory, { recursive: true })
  app.setPath(key, directory)
}

const css = readFileSync(new URL('../src/renderer/styles.css', import.meta.url), 'utf8')
const guest =
  'data:text/html,' + encodeURIComponent('<body style="margin:0">Reading fixture</body>')
const html = `<!doctype html><style>${css}</style><div id="app">
  <main class="main-shell">
    <webview class="browser-webview" src="${guest}" webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"></webview>
    <nav class="main-toolbar">
      <div class="main-drag-handle"></div>
      <button class="icon-button" title="Controller"></button>
      <button class="icon-button" title="Select readable DOM"></button>
    </nav>
  </main>
</div>`

const measure = `
  (async () => {
    const webview = document.querySelector('webview')
    document.querySelector('button:last-child').focus()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const rect = element => {
      const bounds = element.getBoundingClientRect()
      return { top: bounds.top, bottom: bounds.bottom, right: bounds.right, height: bounds.height }
    }
    return {
      height: innerHeight, width: innerWidth,
      shell: rect(document.querySelector('.main-shell')),
      webview: rect(webview), toolbar: rect(document.querySelector('.main-toolbar')),
      buttons: Array.from(document.querySelectorAll('button')).map(rect),
      guestHeight: await webview.executeJavaScript('innerHeight')
    }
  })()
`

let window
let exitCode = 0
const timeout = setTimeout(() => {
  console.error('Electron layout test timed out')
  app.exit(1)
}, 15_000)

const run = async () => {
  try {
    await app.whenReady()
    window = new BrowserWindow({
      width: 960,
      height: 72,
      minHeight: 28,
      frame: false,
      show: false,
      webPreferences: {
        webviewTag: true,
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false
      }
    })
    await window.loadURL('data:text/html,' + encodeURIComponent(html))
    await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const webview = document.querySelector('webview')
      const timeout = setTimeout(() => reject(new Error('Guest did not load')), 5000)
      const ready = () => { clearTimeout(timeout); resolve() }
      webview.addEventListener('dom-ready', ready, { once: true })
      // A fast data URL may have finished before the listener was attached.
      if (webview.getURL() && !webview.isLoading()) {
        void webview.executeJavaScript('document.readyState').then(state => {
          if (state === 'complete') ready()
        })
      }
    })
  `)

    for (const height of [28, 36, 44, 72, 96]) {
      window.setContentSize(960, height)
      const layout = await window.webContents.executeJavaScript(measure)
      assert.equal(layout.height, height)
      assert.equal(layout.guestHeight, height, `Guest viewport must fit a ${height}px Main`)
      for (const name of ['shell', 'webview', 'toolbar']) {
        assert.equal(layout[name].top, 0, `${name} must stay at the top after focusing a control`)
        assert.equal(layout[name].height, height, `${name} must fit the selected height`)
        assert.ok(layout[name].right <= layout.width, `${name} must fit horizontally`)
      }
      for (const button of layout.buttons) {
        assert.ok(button.top >= 0 && button.bottom <= height, 'Controls must remain fully visible')
      }
      console.log(
        JSON.stringify({
          height,
          guestHeight: layout.guestHeight,
          toolbarHeight: layout.toolbar.height,
          passed: true
        })
      )
    }
  } catch (error) {
    console.error(error)
    exitCode = 1
  } finally {
    clearTimeout(timeout)
    window?.destroy()
    rmSync(profile, { recursive: true, force: true })
    app.exit(exitCode)
  }
}

void run()
