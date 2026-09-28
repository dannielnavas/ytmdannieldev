import { DestroyRef, Service, inject } from '@angular/core';
import { PersistedQueueItem } from '../models/queue.model';
import { RepeatMode } from './playback.service';

/** Bumped whenever the shape changes, so old payloads are discarded. */
export const PLAYBACK_STATE_VERSION = 1;

const STORAGE_KEY = 'sonara.playback-state.v1';

/** Minimum interval between position writes, in ms. */
const SAVE_DEBOUNCE_MS = 400;

export interface PersistedPlaybackState {
  version: number;
  queue: PersistedQueueItem[];
  currentIndex: number;
  /** Seconds into the current track. */
  position: number;
  volume: number;
  muted: boolean;
  rate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  sourceTitle: string;
  savedAt: number;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function isRepeatMode(value: unknown): value is RepeatMode {
  return value === 'off' || value === 'all' || value === 'one';
}

/**
 * Plain `localStorage` snapshot of the listening session.
 *
 * This is *not* a secret: it is the queue the user was listening to, so it does
 * not belong in `safeStorage` and does not need encryption. The auth cookie
 * keeps using `secure-storage.json` and never comes through here.
 *
 * Everything read back is validated: a corrupted or hand-edited payload must
 * never be able to break playback, so an invalid shape is discarded instead of
 * partially applied.
 */
@Service()
export class PlaybackStateStore {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _pending: PersistedPlaybackState | null = null;

  public constructor() {
    // A pending debounce must not outlive the service. In the app this never
    // happens (the store lives as long as the window, and `beforeunload`
    // flushes), but in a test a stray timer would write into the next test's
    // storage.
    inject(DestroyRef).onDestroy(() => this._discard());
  }

  private _discard(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._pending = null;
  }

  /** Latest valid snapshot, or `null` if there is nothing to restore. */
  public load(): PersistedPlaybackState | null {
    let raw: string | null = null;
    try {
      raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      // Private mode or storage disabled: session restore simply does not work.
      return null;
    }
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.clear();
      return null;
    }

    const state = this.validate(parsed);
    if (!state) {
      this.clear();
      return null;
    }
    return state;
  }

  /**
   * Coalesces the writes: the position changes four times per second and each
   * `localStorage.setItem` is a synchronous disk write.
   */
  public save(state: PersistedPlaybackState): void {
    this._pending = state;
    if (this._timer !== null) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Writes immediately, for events that may end the process (`beforeunload`). */
  public flush(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    const state = this._pending;
    this._pending = null;
    if (!state) return;

    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded: losing the restore point is better than breaking audio.
    }
  }

  public clear(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._pending = null;
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private validate(parsed: unknown): PersistedPlaybackState | null {
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<PersistedPlaybackState>;

    if (candidate.version !== PLAYBACK_STATE_VERSION) return null;
    if (!Array.isArray(candidate.queue) || candidate.queue.length === 0) return null;
    // Without a videoId there is nothing to play: the queue is worthless.
    if (!candidate.queue.some((item) => item && typeof item.videoId === 'string')) return null;

    return {
      version: PLAYBACK_STATE_VERSION,
      queue: candidate.queue,
      currentIndex: clamp(candidate.currentIndex, -1, candidate.queue.length - 1, 0),
      position: clamp(candidate.position, 0, 24 * 60 * 60, 0),
      volume: clamp(candidate.volume, 0, 1, 1),
      muted: candidate.muted === true,
      rate: clamp(candidate.rate, 0.5, 2, 1),
      shuffle: candidate.shuffle === true,
      repeat: isRepeatMode(candidate.repeat) ? candidate.repeat : 'all',
      sourceTitle: typeof candidate.sourceTitle === 'string' ? candidate.sourceTitle : '',
      savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : 0,
    };
  }
}
