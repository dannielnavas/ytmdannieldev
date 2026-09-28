import { DestroyRef, Service, inject } from '@angular/core';
import { PlaybackService } from './playback.service';

const VOLUME_STEP = 0.05;
const SEEK_STEP_SECONDS = 10;

/** Elements where a keystroke belongs to the user, not to the player. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  // `isContentEditable` is not implemented everywhere, and the attribute is what
  // actually decides in the browser.
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true;

  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // Range and checkbox do not eat text, so the shortcuts keep working.
    const type = (target as HTMLInputElement).type;
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
  }
  return false;
}

/**
 * Global keyboard shortcuts.
 *
 * Key handling used to be spread across components, so the same key behaved
 * differently depending on the route, and nothing worked while typing in the
 * search box. Now there is one table, and it stands down whenever the
 * keystroke belongs to a field.
 *
 * `Space` is bound on `window` with `preventDefault()`: the focused control is
 * usually a button, and activating it on space would fire two commands at once.
 */
@Service()
export class PlaybackShortcutsService {
  private readonly _playback = inject(PlaybackService);
  private _onKeyDown = (event: KeyboardEvent): void => this._handle(event);

  public constructor() {
    globalThis.addEventListener?.('keydown', this._onKeyDown);
    inject(DestroyRef).onDestroy(() =>
      globalThis.removeEventListener?.('keydown', this._onKeyDown),
    );
  }

  private _handle(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target)) return;
    if (!this._playback.$stream()) return;

    const step = event.shiftKey ? SEEK_STEP_SECONDS : 0;

    switch (event.key) {
      case ' ':
      case 'Spacebar':
      case 'k':
      case 'K':
        this._playback.togglePlay();
        break;

      case 'ArrowRight':
        if (step) this._playback.seekBy(step);
        else this._playback.playNext();
        break;

      case 'ArrowLeft':
        if (step) this._playback.seekBy(-step);
        else this._playback.previous();
        break;

      case 'ArrowUp':
        this._playback.nudgeVolume(VOLUME_STEP);
        break;

      case 'ArrowDown':
        this._playback.nudgeVolume(-VOLUME_STEP);
        break;

      case 'm':
      case 'M':
        this._playback.toggleMute();
        break;

      case 's':
      case 'S':
        this._playback.toggleShuffle();
        break;

      case 'r':
      case 'R':
        this._playback.toggleRepeat();
        break;

      case '+':
      case '=':
        this._playback.cycleRate();
        break;

      case '-':
      case '_':
        this._playback.cycleRate('down');
        break;

      case 'Home':
        this._playback.seek(0);
        break;

      default:
        // Digits jump to a percentage of the track.
        if (!/^\d$/.test(event.key)) return;
        this._playback.seekToPercent(Number(event.key) * 10);
        break;
    }

    event.preventDefault();
  }
}
