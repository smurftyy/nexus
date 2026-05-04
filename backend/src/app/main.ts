import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { config } from '../core/config/config'
import { TDEngine } from '../core/engine/tdEngine'
import { registerIpcHandlers } from '../ipc/handlers'

let mainWindow: BrowserWindow | null = null
let tdEngine: TDEngine | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  if (config.appEnv === 'development') {
    void mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'),
    )
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  tdEngine = new TDEngine(config.tdWsPort)
  registerIpcHandlers(tdEngine, () => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  tdEngine?.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
