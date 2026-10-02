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
}

export interface UserData {
  name: string;
  avatarUrl?: string | null;
  id?: string;
}

/**
 * Réplica de la interfaz expuesta por `electron/preload.ts`.
 *
 * Las tres deben seguir en sync: preload (implementación), este archivo
 * (tipos del renderer) y los consumidores.
 */
export interface SafeStorageAPI {
  isAvailable: () => Promise<boolean>;
  setItem: (key: string, value: string) => Promise<boolean>;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => Promise<boolean>;
}

declare global {
  interface Window {
    windowControls?: WindowControlsAPI;
    safeStorage?: SafeStorageAPI;
    electronAPI?: {
      windowControls?: WindowControlsAPI;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
      isMaximized?: () => Promise<boolean>;
      onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
      loginWithGoogle: () => Promise<string>;
      getUserData?: () => Promise<UserData>;
      safeStorage?: SafeStorageAPI;
    };
  }
}
