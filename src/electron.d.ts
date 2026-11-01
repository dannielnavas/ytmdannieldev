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
      logout?: () => Promise<boolean>;
      getUserData?: () => Promise<UserData>;
      safeStorage?: SafeStorageAPI;
    };
  }
}
