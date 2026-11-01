import { Component, inject } from '@angular/core';
import { PlaybackShortcutsService } from '../../core/services/playback-shortcuts.service';
import { MediaSessionService } from '../../core/services/media-session.service';
import { ElectronMedia } from '../../core/services/electron-media';

@Component({
  imports: [],
  selector: 'app-shell',
  styleUrl: './shell.css',
  templateUrl: './shell.html',
})
export class Shell {
  // Injected for their side effects: register global listeners on the
  // session (keyboard, OS media controls, and Electron OS bridge) and must live for the whole app.
  private readonly _shortcuts = inject(PlaybackShortcutsService);
  private readonly _mediaSession = inject(MediaSessionService);
  private readonly _electronMedia = inject(ElectronMedia);
}
