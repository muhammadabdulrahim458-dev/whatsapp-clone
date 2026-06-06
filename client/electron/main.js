import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Standard title bar with minimize/maximize/close buttons
    titleBarStyle: 'default',
    frame: true,
  })

  // Remove the application menu (File, Edit, etc.) but keep window controls
  mainWindow.setMenu(null)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Failed to load dev server:', err)
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    })
    // Optional: open DevTools for debugging (comment out for production)
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Notification handler – shows only when window is not focused
ipcMain.on('show-notification', (event, { title, body }) => {
  if (mainWindow && !mainWindow.isFocused()) {
    const notification = new Notification({ title, body })
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
    notification.show()
  }
})