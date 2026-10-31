import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TitleBarComponent } from '../../../../shared/components/title-bar/title-bar.component';
import { PlayerBar } from '../player-bar/player-bar';
import { MiniPlayerComponent } from '../mini-player/mini-player.component';
import { WindowControlsService } from '../../../../core/services/window-controls.service';
import { PlaybackShortcutsService } from '../../../../core/services/playback-shortcuts.service';
import { MediaSessionService } from '../../../../core/services/media-session.service';
import { AudioOutputService } from '../../../../core/services/audio-output.service';

@Component({
  imports: [RouterOutlet, TitleBarComponent, PlayerBar, MiniPlayerComponent],
  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly _router = inject(Router);
  // Injected for their global side effects across the entire app lifecycle:
  // keyboard shortcuts, OS/Bluetooth headphone media session (WH-1000XM5, AirPods Max),
  // and headphone disconnect auto-pause.
  private readonly _shortcuts = inject(PlaybackShortcutsService);
  private readonly _mediaSession = inject(MediaSessionService);
  private readonly _audioOutput = inject(AudioOutputService);
  public readonly controls = inject(WindowControlsService);

  public $title = signal('Pulso');
  public $isNowPlaying = signal<boolean>(this._router.url.includes('/now-playing'));
  public $isMiniPlayer = this.controls.isMiniPlayer;

  constructor() {
    this._router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.$isNowPlaying.set(this._router.url.includes('/now-playing'));
    });
  }

  public onOutletActivate(component: any): void {
    const isNow =
      component?.constructor?.name === 'NowPlaying' || this._router.url.includes('/now-playing');
    this.$isNowPlaying.set(isNow);
  }

  public onOutletDeactivate(): void {
    this.$isNowPlaying.set(this._router.url.includes('/now-playing'));
  }
}
