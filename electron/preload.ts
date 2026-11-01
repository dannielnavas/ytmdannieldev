import { contextBridge, ipcRenderer } from 'electron';

export type MediaControlAction =
  'toggle-play' | 'play' | 'pause' | 'next' | 'previous' | 'stop' | 'toggle-like';

export interface OSPlaybackTrack {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  thumbnailUrl?: string;
}

export interface OSPlaybackState {
  track: OSPlaybackTrack | null;
  isPlaying: boolean;
  isLiked: boolean;
  /** Progress between 0 and 1, or -1 when no active progress should be shown. */
  progress: number;
}

export interface OSTrackNotification {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  thumbnailUrl?: string;
}

export interface OSThemeInfo {
  shouldUseDarkColors: boolean;
  inHighContrastColors: boolean;
  accentColor?: string;
}

export interface LoginItemConfig {
  openAtLogin: boolean;
  openAsHidden?: boolean;
}

export interface WindowControlsAPI {
  minimize: () => void;
  minimizeSystem?: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
  toggleMiniPlayer: (enabled?: boolean) => void;
  isMiniPlayer: () => Promise<boolean>;
  onMiniPlayerChange: (callback: (isMini: boolean) => void) => () => void;
  onMediaControl?: (callback: (action: MediaControlAction) => void) => () => void;
  updatePlaybackState?: (state: OSPlaybackState) => void;
  notifyTrackChange?: (notification: OSTrackNotification) => void;
  getLoginItemSettings?: () => Promise<LoginItemConfig>;
  setLoginItemSettings?: (config: LoginItemConfig) => Promise<LoginItemConfig>;
  getThemeInfo?: () => Promise<OSThemeInfo>;
  onThemeChange?: (callback: (theme: OSThemeInfo) => void) => () => void;
  onDeepLink?: (callback: (url: string) => void) => () => void;
  onSystemSuspend?: (callback: () => void) => () => void;
  onSystemResume?: (callback: () => void) => () => void;
  platform?: string;
}

const windowControls: WindowControlsAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  minimizeSystem: () => ipcRenderer.send('window-minimize-system'),
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
  toggleMiniPlayer: (enabled?: boolean) => ipcRenderer.send('window-toggle-mini-player', enabled),
  isMiniPlayer: () => ipcRenderer.invoke('window-is-mini-player'),
  onMiniPlayerChange: (callback: (isMini: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMini: boolean) => callback(isMini);
    ipcRenderer.on('window-mini-player-change', listener);
    return () => {
      ipcRenderer.removeListener('window-mini-player-change', listener);
    };
  },
  onMediaControl: (callback: (action: MediaControlAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MediaControlAction) =>
      callback(action);
    ipcRenderer.on('window-media-control', listener);
    return () => {
      ipcRenderer.removeListener('window-media-control', listener);
    };
  },
  updatePlaybackState: (state: OSPlaybackState) => ipcRenderer.send('os:playback-state', state),
  notifyTrackChange: (notification: OSTrackNotification) =>
    ipcRenderer.send('os:track-notification', notification),
  getLoginItemSettings: () => ipcRenderer.invoke('os:get-login-item'),
  setLoginItemSettings: (config: LoginItemConfig) =>
    ipcRenderer.invoke('os:set-login-item', config),
  getThemeInfo: () => ipcRenderer.invoke('os:get-theme-info'),
  onThemeChange: (callback: (theme: OSThemeInfo) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: OSThemeInfo) => callback(theme);
    ipcRenderer.on('os:theme-changed', listener);
    return () => {
      ipcRenderer.removeListener('os:theme-changed', listener);
    };
  },
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('os:deep-link', listener);
    return () => {
      ipcRenderer.removeListener('os:deep-link', listener);
    };
  },
  onSystemSuspend: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('os:power-suspend', listener);
    return () => {
      ipcRenderer.removeListener('os:power-suspend', listener);
    };
  },
  onSystemResume: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('os:power-resume', listener);
    return () => {
      ipcRenderer.removeListener('os:power-resume', listener);
    };
  },
  platform: process.platform,
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
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUserData: () => ipcRenderer.invoke('auth:get-user-data'),
  safeStorage: safeStorageAPI,
  windowControls,
  ...windowControls,
});
