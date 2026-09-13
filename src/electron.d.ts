export interface WindowControlsAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface UserData {
  name: string;
  avatarUrl?: string | null;
  id?: string;
}

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
