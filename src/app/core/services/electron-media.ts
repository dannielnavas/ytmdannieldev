import { DestroyRef, Service, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlaybackService } from './playback.service';
import { LikesService } from './likes.service';
import { OSPlaybackState, WindowControlsAPI } from '../../../electron';

/** Minimum interval between progress-only IPC updates to the main process. */
const PROGRESS_IPC_INTERVAL_MS = 2000;

/** Minimum progress delta (0..1) that triggers an immediate taskbar bar update. */
const PROGRESS_DELTA_THRESHOLD = 0.02;

function getControlsBridge(): WindowControlsAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.windowControls ?? window.electronAPI?.windowControls;
}

/**
 * Synchronizes Angular playback state, likes, deep links (`pulso://`), and
 * power lifecycle events with the native operating system via Electron IPC.
 *
 * Keeps the System Tray, macOS Dock menu, Windows Taskbar Thumbnail Toolbars,
 * taskbar progress bar, `powerSaveBlocker`, and native desktop notifications
 * up to date in real time.
 */
@Service()
export class ElectronMedia {
  private readonly _playback = inject(PlaybackService);
  private readonly _likes = inject(LikesService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  private _lastSentVideoId: string | null = null;
  private _lastSentPlaying: boolean | null = null;
  private _lastSentLiked: boolean | null = null;
  private _lastSentProgress = -1;
  private _lastSentAt = 0;

  private _lastObservedVideoId: string | null = null;

  public constructor() {
    this._registerPlaybackStateSync();
    this._registerTrackNotificationSync();
    this._registerDeepLinkListener();
    this._registerPowerListeners();
  }

  /**
   * Parses and routes a `pulso://` deep link inside the Angular application.
   */
  public handleDeepLink(rawUrl: string): void {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    if (!rawUrl.toLowerCase().startsWith('pulso://')) return;

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return;
    }

    // In custom schemes like `pulso://playlist/PL123`, browsers may put `playlist`
    // in `host`/`hostname` and `/PL123` in `pathname`, or `///playlist/PL123` in `pathname`.
    const segments = [parsed.hostname, ...parsed.pathname.split('/')]
      .map((part) => part.trim())
      .filter(Boolean);

    const action = (segments[0] ?? '').toLowerCase();
    const param = segments[1] ?? '';

    switch (action) {
      case 'play':
      case 'watch': {
        const videoId = parsed.searchParams.get('v') || param;
        if (!videoId) return;
        const title = parsed.searchParams.get('title') || 'Pista de YouTube Music';
        const artist = parsed.searchParams.get('artist') || '';
        this._playback.playSingle({
          videoId,
          name: title,
          artist,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
        void this._router.navigate(['/now-playing']);
        break;
      }

      case 'playlist': {
        const playlistId = param || parsed.searchParams.get('list') || '';
        if (playlistId) {
          void this._router.navigate(['/playlist', playlistId]);
        }
        break;
      }

      case 'album': {
        const albumId = param || parsed.searchParams.get('id') || '';
        if (albumId) {
          void this._router.navigate(['/album', albumId]);
        }
        break;
      }

      case 'search': {
        const query = parsed.searchParams.get('q') || param;
        void this._router.navigate(['/search'], query ? { queryParams: { q: query } } : undefined);
        break;
      }

      case 'likes':
      case 'library':
      case 'home':
      case 'now-playing': {
        void this._router.navigate([`/${action}`]);
        break;
      }
    }
  }

  private _registerPlaybackStateSync(): void {
    effect(() => {
      const stream = this._playback.$stream();
      const track = stream ? this._playback.$currentTrack() : null;
      const isPlaying = this._playback.$isPlaying();
      const progressPercent = this._playback.$progressPercent();
      const album = this._playback.$sourceTitle();
      const isLiked = track ? this._likes.isLiked(track.videoId) : false;

      const controls = getControlsBridge();
      if (!controls?.updatePlaybackState) return;

      const videoId = track?.videoId ?? null;
      const progress = track ? Math.min(1, Math.max(0, progressPercent / 100)) : -1;
      const now = Date.now();

      const primaryStateChanged =
        videoId !== this._lastSentVideoId ||
        isPlaying !== this._lastSentPlaying ||
        isLiked !== this._lastSentLiked;

      const progressChangedSignificantly =
        Math.abs(progress - this._lastSentProgress) >= PROGRESS_DELTA_THRESHOLD &&
        now - this._lastSentAt >= PROGRESS_IPC_INTERVAL_MS;

      if (!primaryStateChanged && !progressChangedSignificantly) {
        return;
      }

      this._lastSentVideoId = videoId;
      this._lastSentPlaying = isPlaying;
      this._lastSentLiked = isLiked;
      this._lastSentProgress = progress;
      this._lastSentAt = now;

      const payload: OSPlaybackState = {
        track: track
          ? {
              videoId: track.videoId,
              title: track.name,
              artist: track.artist ?? '',
              ...(album ? { album } : {}),
              ...(track.thumbnail ? { thumbnailUrl: track.thumbnail } : {}),
            }
          : null,
        isPlaying,
        isLiked,
        progress,
      };

      controls.updatePlaybackState(payload);
    });
  }

  private _registerTrackNotificationSync(): void {
    effect(() => {
      const stream = this._playback.$stream();
      const track = stream ? this._playback.$currentTrack() : null;
      const isPlaying = this._playback.$isPlaying();
      const album = this._playback.$sourceTitle();

      if (!track) {
        this._lastObservedVideoId = null;
        return;
      }

      // Avoid firing a desktop notification for a cold-restored session before playback starts.
      if (!isPlaying && this._lastObservedVideoId === null) {
        this._lastObservedVideoId = track.videoId;
        return;
      }

      if (isPlaying && this._lastObservedVideoId !== track.videoId) {
        const shouldNotify = this._lastObservedVideoId !== null;
        this._lastObservedVideoId = track.videoId;

        if (shouldNotify) {
          getControlsBridge()?.notifyTrackChange?.({
            videoId: track.videoId,
            title: track.name,
            artist: track.artist ?? '',
            ...(album ? { album } : {}),
            ...(track.thumbnail ? { thumbnailUrl: track.thumbnail } : {}),
          });
        }
      }
    });
  }

  private _registerDeepLinkListener(): void {
    const controls = getControlsBridge();
    if (!controls?.onDeepLink) return;

    const unsubscribe = controls.onDeepLink((url: string) => {
      this.handleDeepLink(url);
    });
    this._destroyRef.onDestroy(() => unsubscribe());
  }

  private _registerPowerListeners(): void {
    const controls = getControlsBridge();
    if (!controls) return;

    if (controls.onSystemSuspend) {
      const unSuspend = controls.onSystemSuspend(() => {
        if (this._playback.$isPlaying()) {
          this._playback.pause();
        }
      });
      this._destroyRef.onDestroy(() => unSuspend());
    }
  }
}
