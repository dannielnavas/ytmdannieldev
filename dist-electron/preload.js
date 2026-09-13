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
const safeStorageAPI = {
    isAvailable: () => electron_1.ipcRenderer.invoke('safe-storage:is-available'),
    encryptString: (plainText) => electron_1.ipcRenderer.invoke('safe-storage:encrypt-string', plainText),
    decryptString: (encryptedBase64) => electron_1.ipcRenderer.invoke('safe-storage:decrypt-string', encryptedBase64),
    setItem: (key, value) => electron_1.ipcRenderer.invoke('safe-storage:set-item', key, value),
    getItem: (key) => electron_1.ipcRenderer.sendSync('safe-storage:get-item-sync', key),
    getItemAsync: (key) => electron_1.ipcRenderer.invoke('safe-storage:get-item', key),
    removeItem: (key) => electron_1.ipcRenderer.invoke('safe-storage:remove-item', key),
    clear: () => electron_1.ipcRenderer.invoke('safe-storage:clear'),
    encryptStringAsync: (keyOrText, value) => {
        if (value !== undefined) {
            return electron_1.ipcRenderer.invoke('safe-storage:set-item', keyOrText, value);
        }
        return electron_1.ipcRenderer.invoke('safe-storage:encrypt-string', keyOrText);
    },
    decryptStringAsync: (encryptedBase64) => electron_1.ipcRenderer.invoke('safe-storage:decrypt-string', encryptedBase64),
};
// Exponer la API al proceso de renderizado de manera segura
electron_1.contextBridge.exposeInMainWorld('windowControls', windowControls);
electron_1.contextBridge.exposeInMainWorld('safeStorage', safeStorageAPI);
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    loginWithGoogle: () => electron_1.ipcRenderer.invoke('auth:login-google'),
    getUserData: () => electron_1.ipcRenderer.invoke('auth:get-user-data'),
    safeStorage: safeStorageAPI,
    windowControls,
    ...windowControls,
});
