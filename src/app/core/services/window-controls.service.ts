import { Injectable, signal, computed, inject, NgZone } from '@angular/core';

export type PlatformType = 'darwin' | 'win32' | 'linux';

@Injectable({
  providedIn: 'root',
})
export class WindowControlsService {
  private readonly _ngZone = inject(NgZone);
  readonly isMaximized = signal(false);
  readonly isMiniPlayer = signal(false);
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

      window.windowControls.onMaximizedChange((maximized) => {
        this._ngZone.run(() => this.isMaximized.set(maximized));
      });

      window.windowControls.isMiniPlayer?.().then((isMini) => {
        this._ngZone.run(() => this.isMiniPlayer.set(isMini));
      });

      window.windowControls.onMiniPlayerChange?.((isMini) => {
        this._ngZone.run(() => this.isMiniPlayer.set(isMini));
      });
    }
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
