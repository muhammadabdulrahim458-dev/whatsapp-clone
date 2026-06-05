import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
})