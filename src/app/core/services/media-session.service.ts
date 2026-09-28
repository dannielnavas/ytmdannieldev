import { Service, computed, effect, inject } from '@angular/core';
import { PlaybackService } from './playback.service';
import { getHighResThumbnail } from './image-helper.service';

/** How often the OS scrubber position is refreshed, in ms. */
const POSITION_UPDATE_INTERVAL_MS = 1000;

const SEEK_STEP_SECONDS = 10;

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * Bridges playback with the OS media controls (macOS Control Center, Windows
 * Media Overlay, Linux MPRIS).
 *
 * Without this the hardware keys and the notification tray show the app with no
 * metadata and no working buttons, because Chromium only exposes a session for
 * the elements it knows about, and here the `<audio>` is created by a service
 * instead of being in a template.
 */
@Service()
export class MediaSessionService {
  private readonly _playback = inject(PlaybackService);

  private _lastPositionUpdate = 0;
  private _registered = false;

  public constructor() {
    if (!isSupported()) return;

    this._registerActions();
    this._registerMetadata();
    this._registerPosition();
  }

  private _registerActions(): void {
    const session = navigator.mediaSession;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => this._playback.play()],
      ['pause', () => this._playback.pause()],
      ['stop', () => this._playback.stop()],
      ['previoustrack', () => this._playback.previous()],
      ['nexttrack', () => this._playback.playNext()],
      [
        'seekbackward',
        (details) => this._playback.seekBy(-(details.seekOffset ?? SEEK_STEP_SECONDS)),
      ],
      ['seekforward', (details) => this._playback.seekBy(details.seekOffset ?? SEEK_STEP_SECONDS)],
      [
        'seekto',
        (details) => {
          // `seekTime` may be undefined depending on the platform.
          if (typeof details.seekTime === 'number') {
            this._playback.seek(details.seekTime);
          }
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
        this._registered = true;
      } catch {
        // Unknown action for this platform: harmless.
      }
    }
  }

  private _registerMetadata(): void {
    const artwork = computed(() => {
      const url = this._playback.$currentTrack()?.thumbnail ?? '';
      if (!url) return [];
      return [
        { src: getHighResThumbnail(url, 320), sizes: '320x320', type: 'image/jpeg' },
        { src: getHighResThumbnail(url, 1024), sizes: '1024x1024', type: 'image/jpeg' },
      ];
    });

    effect(() => {
      // `stop()` keeps the queue for the next run, but the OS must forget the
      // track: it shows the session state as "nothing is loaded".
      const track = this._playback.$stream() ? this._playback.$currentTrack() : null;
      if (!track) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        return;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist ?? '',
        album: this._playback.$sourceTitle(),
        artwork: artwork(),
      });
    });

    effect(() => {
      const state = this._playback.$isPlaying()
        ? 'playing'
        : this._playback.$stream()
          ? 'paused'
          : 'none';
      navigator.mediaSession.playbackState = state;
    });
  }

  private _registerPosition(): void {
    effect(() => {
      const currentTime = this._playback.$currentTime();
      const duration = this._playback.$effectiveDuration();
      const rate = this._playback.$playbackRate();

      const now = Date.now();
      if (now - this._lastPositionUpdate < POSITION_UPDATE_INTERVAL_MS) return;
      this._lastPositionUpdate = now;

      // The API rejects a state without a valid duration, and the duration is
      // unknown until the metadata of the track loads.
      if (!this._registered || !Number.isFinite(duration) || duration <= 0) return;

      try {
        navigator.mediaSession.setPositionState({
          duration,
          // `playbackRate` 0 is invalid, and 0.25 is the documented floor.
          playbackRate: Math.max(0.25, rate),
          position: Math.min(Math.max(0, currentTime), duration),
        });
      } catch {
        // Some platforms are strict about the bounds: skip this update.
      }
    });
  }
}
