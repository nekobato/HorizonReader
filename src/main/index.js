'use strict'

import electron from 'electron'
import axios from 'axios'
const { app, BrowserWindow, ipcMain } = electron

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  const screenSize = electron.screen.getPrimaryDisplay().workAreaSize

  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    x: 0,
    // screensize - (window height)
    y: screenSize.height,
    height: 24,
    width: screenSize.width,
    useContentSize: false,
    frame: false
  })

  mainWindow.loadURL(winURL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('GET_NAROU_PAGE', (event, url) => {
    console.log(url)
    axios.get(url)
      .then((res) => {
        mainWindow.webContents.send('RECEIVE_NAROU_PAGE', res.data)
      })
      .catch((err) => {
        console.error(err)
      })
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
