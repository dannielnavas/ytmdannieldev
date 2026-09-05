import { Injectable, signal, inject, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class WindowControlsService {
  private readonly _ngZone = inject(NgZone);
  readonly isMaximized = signal(false);
  readonly isElectron = typeof window !== 'undefined' && !!window.windowControls;

  constructor() {
    if (this.isElectron && window.windowControls) {
      window.windowControls.isMaximized().then((maximized) => {
        this._ngZone.run(() => this.isMaximized.set(maximized));
      });

      window.windowControls.onMaximizedChange((maximized) => {
        this._ngZone.run(() => this.isMaximized.set(maximized));
      });
    }
  }

  minimize(): void {
    window.windowControls?.minimize();
  }

  maximize(): void {
    window.windowControls?.maximize();
  }

  close(): void {
    window.windowControls?.close();
  }
}
