import { DestroyRef, Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { OSThemeInfo } from '../../../electron';

export type PlatformType = 'darwin' | 'win32' | 'linux';

@Injectable({
  providedIn: 'root',
})
export class WindowControlsService {
  private readonly _ngZone = inject(NgZone);
  private readonly _destroyRef = inject(DestroyRef);
  readonly isMaximized = signal(false);
  readonly isMiniPlayer = signal(false);
  readonly openAtLogin = signal(false);
  readonly osTheme = signal<OSThemeInfo>({
    shouldUseDarkColors: true,
    inHighContrastColors: false,
  });
  readonly isElectron = typeof window !== 'undefined' && !!window.windowControls;
  readonly platform = signal<PlatformType>(this._detectPlatform());
  readonly isMac = computed(() => this.platform() === 'darwin');
  readonly isWindows = computed(() => this.platform() === 'win32');
  readonly isLinux = computed(() => this.platform() === 'linux');

  private _detectPlatform(): PlatformType {
    if (this.isElectron && window.windowControls?.platform) {
      const p = window.windowControls.platform;
      if (p === 'darwin' || p === 'win32' || p === 'linux') {
        return p as PlatformType;
      }
    }
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('mac')) return 'darwin';
      if (ua.includes('win')) return 'win32';
      if (ua.includes('linux')) return 'linux';
    }
    return 'win32';
  }

  constructor() {
    if (this.isElectron && window.windowControls) {
      window.windowControls.isMaximized().then((maximized) => {
        this._ngZone.run(() => this.isMaximized.set(maximized));
      });

      const unMax = window.windowControls.onMaximizedChange((maximized) => {
        this._ngZone.run(() => this.isMaximized.set(maximized));
      });
      this._destroyRef.onDestroy(() => unMax?.());

      window.windowControls.isMiniPlayer?.().then((isMini) => {
        this._ngZone.run(() => this.isMiniPlayer.set(isMini));
      });

      const unMini = window.windowControls.onMiniPlayerChange?.((isMini) => {
        this._ngZone.run(() => this.isMiniPlayer.set(isMini));
      });
      this._destroyRef.onDestroy(() => unMini?.());

      window.windowControls.getLoginItemSettings?.().then((settings) => {
        if (settings) {
          this._ngZone.run(() => this.openAtLogin.set(Boolean(settings.openAtLogin)));
        }
      });

      window.windowControls.getThemeInfo?.().then((theme) => {
        if (theme) {
          this._ngZone.run(() => this._applyTheme(theme));
        }
      });

      const unTheme = window.windowControls.onThemeChange?.((theme) => {
        this._ngZone.run(() => this._applyTheme(theme));
      });
      this._destroyRef.onDestroy(() => unTheme?.());
    }
  }

  private _applyTheme(theme: OSThemeInfo): void {
    this.osTheme.set(theme);
    if (typeof document !== 'undefined' && document.documentElement) {
      if (theme.accentColor) {
        document.documentElement.style.setProperty('--os-accent-color', theme.accentColor);
      } else {
        document.documentElement.style.removeProperty('--os-accent-color');
      }
    }
  }

  async setOpenAtLogin(enabled: boolean): Promise<boolean> {
    if (!this.isElectron || !window.windowControls?.setLoginItemSettings) {
      this.openAtLogin.set(enabled);
      return enabled;
    }
    const updated = await window.windowControls.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    });
    const next = Boolean(updated?.openAtLogin);
    this._ngZone.run(() => this.openAtLogin.set(next));
    return next;
  }

  async toggleOpenAtLogin(): Promise<boolean> {
    return this.setOpenAtLogin(!this.openAtLogin());
  }

  minimize(): void {
    window.windowControls?.minimize();
  }

  minimizeSystem(): void {
    window.windowControls?.minimizeSystem?.();
  }

  toggleMiniPlayer(enabled?: boolean): void {
    if (this.isElectron) {
      window.windowControls?.toggleMiniPlayer(enabled);
    } else {
      this.isMiniPlayer.update((curr) => (typeof enabled === 'boolean' ? enabled : !curr));
    }
  }

  maximize(): void {
    window.windowControls?.maximize();
  }

  close(): void {
    window.windowControls?.close();
  }
}
