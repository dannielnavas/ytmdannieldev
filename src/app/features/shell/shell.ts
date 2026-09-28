import { Component, inject } from '@angular/core';
import { PlaybackShortcutsService } from '../../core/services/playback-shortcuts.service';
import { MediaSessionService } from '../../core/services/media-session.service';

@Component({
  imports: [],
  selector: 'app-shell',
  styleUrl: './shell.css',
  templateUrl: './shell.html',
})
export class Shell {
  // Injected for their side effects: both register global listeners on the
  // session (keyboard and OS media controls) and must live for the whole app.
  private readonly _shortcuts = inject(PlaybackShortcutsService);
  private readonly _mediaSession = inject(MediaSessionService);
}
