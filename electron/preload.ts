import { contextBridge, ipcRenderer } from 'electron';

export interface WindowControlsAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

const windowControls: WindowControlsAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) =>
      callback(isMaximized);
    ipcRenderer.on('window-maximized-change', listener);
    return () => {
      ipcRenderer.removeListener('window-maximized-change', listener);
    };
  },
};

export interface SafeStorageAPI {
  isAvailable: () => Promise<boolean>;
  encryptString: (plainText: string) => Promise<string>;
  decryptString: (encryptedBase64: string) => Promise<string>;
  setItem: (key: string, value: string) => Promise<boolean>;
  getItem: (key: string) => string | null;
  getItemAsync?: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  encryptStringAsync: (keyOrText: string, value?: string) => Promise<string | boolean>;
  decryptStringAsync: (encryptedBase64: string) => Promise<string>;
}

const safeStorageAPI: SafeStorageAPI = {
  isAvailable: () => ipcRenderer.invoke('safe-storage:is-available'),
  encryptString: (plainText: string) => ipcRenderer.invoke('safe-storage:encrypt-string', plainText),
  decryptString: (encryptedBase64: string) =>
    ipcRenderer.invoke('safe-storage:decrypt-string', encryptedBase64),
  setItem: (key: string, value: string) => ipcRenderer.invoke('safe-storage:set-item', key, value),
  getItem: (key: string): string | null => ipcRenderer.sendSync('safe-storage:get-item-sync', key),
  getItemAsync: (key: string) => ipcRenderer.invoke('safe-storage:get-item', key),
  removeItem: (key: string) => ipcRenderer.invoke('safe-storage:remove-item', key),
  clear: () => ipcRenderer.invoke('safe-storage:clear'),
  encryptStringAsync: (keyOrText: string, value?: string) => {
    if (value !== undefined) {
      return ipcRenderer.invoke('safe-storage:set-item', keyOrText, value);
    }
    return ipcRenderer.invoke('safe-storage:encrypt-string', keyOrText);
  },
  decryptStringAsync: (encryptedBase64: string) =>
    ipcRenderer.invoke('safe-storage:decrypt-string', encryptedBase64),
};

// Exponer la API al proceso de renderizado de manera segura
contextBridge.exposeInMainWorld('windowControls', windowControls);
contextBridge.exposeInMainWorld('safeStorage', safeStorageAPI);
contextBridge.exposeInMainWorld('electronAPI', {
  loginWithGoogle: () => ipcRenderer.invoke('auth:login-google'),
  getUserData: () => ipcRenderer.invoke('auth:get-user-data'),
  safeStorage: safeStorageAPI,
  windowControls,
  ...windowControls,
});
