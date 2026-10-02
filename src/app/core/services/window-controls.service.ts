import { Injectable, signal, inject, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class WindowControlsService {
  private readonly _ngZone = inject(NgZone);
  readonly isMaximized = signal(false);
  readonly isMiniPlayer = signal(false);
  readonly isElectron = typeof window !== 'undefined' && !!window.windowControls;

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
