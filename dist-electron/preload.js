"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const windowControls = {
    minimize: () => electron_1.ipcRenderer.send('window-minimize'),
    maximize: () => electron_1.ipcRenderer.send('window-maximize'),
    close: () => electron_1.ipcRenderer.send('window-close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window-is-maximized'),
    onMaximizedChange: (callback) => {
        const listener = (_event, isMaximized) => callback(isMaximized);
        electron_1.ipcRenderer.on('window-maximized-change', listener);
        return () => {
            electron_1.ipcRenderer.removeListener('window-maximized-change', listener);
        };
    },
};
// Exponer la API al proceso de renderizado de manera segura
electron_1.contextBridge.exposeInMainWorld('windowControls', windowControls);
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    loginWithGoogle: () => electron_1.ipcRenderer.invoke('auth:login-google'),
    windowControls,
    ...windowControls,
});
