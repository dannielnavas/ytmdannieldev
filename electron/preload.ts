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

/**
 * Superficie mínima de `safeStorage`.
 *
 * Antes se exponían nueve métodos, pero el renderer solo usaba cuatro
 * (`isAvailable`, `setItem`, `getItem`, `removeItem`). Los demás eran un
 * `Record<string, any>` en la práctica: handlers IPC que nadie llamaba y que
 * nadie testeaba. Menos superficie expuesta es más difícil de explotar.
 */
export interface SafeStorageAPI {
  isAvailable: () => Promise<boolean>;
  setItem: (key: string, value: string) => Promise<boolean>;
  /**
   * Síncrono a propósito: el interceptor HTTP necesita el token en el momento
   * de construir la petición, y un guard funcional tampoco puede esperar. El
   * valor está ya en memoria de Electron (`userData/secure-storage.json`), así
   * que el coste es despreciable.
   */
  getItem: (key: string) => string | null;
  removeItem: (key: string) => Promise<boolean>;
}

const safeStorageAPI: SafeStorageAPI = {
  isAvailable: () => ipcRenderer.invoke('safe-storage:is-available'),
  setItem: (key: string, value: string) => ipcRenderer.invoke('safe-storage:set-item', key, value),
  getItem: (key: string): string | null => ipcRenderer.sendSync('safe-storage:get-item-sync', key),
  removeItem: (key: string) => ipcRenderer.invoke('safe-storage:remove-item', key),
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
