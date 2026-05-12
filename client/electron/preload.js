import { contextBridge } from 'electron';
// Expose a safe API to the renderer (we'll expand later)
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});