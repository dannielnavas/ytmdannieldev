import { Service, signal } from '@angular/core';

const STORAGE_KEY = 'pulso.lyrics-preferences.v2';
const LEGACY_STORAGE_KEY_V1 = 'pulso.lyrics-preferences.v1';
const LEGACY_STORAGE_KEY_SONARA = 'sonara.lyrics-preferences.v1';

/** Bumped whenever the shape changes, so old payloads are discarded. */
export const LYRICS_PREFERENCES_VERSION = 2;

/** Beyond a few seconds the lyrics are not "out of sync", they are wrong. */
const MAX_OFFSET_SECONDS = 10;
const MAX_STORED_TRACKS = 300;
const DEFAULT_TRACK_KEY = '__active__';

interface PersistedLyricsPreferencesV2 {
  version: number;
  lastTrackKey?: string;
  trackOffsets: Record<string, number>;
}

function clampOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const clamped = Math.min(MAX_OFFSET_SECONDS, Math.max(-MAX_OFFSET_SECONDS, value));
  return Math.round(clamped * 100) / 100;
}

/**
 * Timing correction for the lyrics of a track.
 *
 * Persists offsets per-track in `localStorage` so adjusting timing for one
 * live recording, remix, or video intro does not desynchronize other songs.
 */
@Service()
export class LyricsPreferencesService {
  private _trackOffsets: Record<string, number> = {};
  private readonly _currentTrackKey = signal<string>(DEFAULT_TRACK_KEY);
  private readonly _offset = signal<number>(0);

  /**
   * Seconds added to every lyric timestamp for the current track.
   * A positive value makes the lines appear earlier, which is what
   * someone needs when the lyrics run behind.
   */
  public readonly $offset = this._offset.asReadonly();
  public readonly $currentTrackKey = this._currentTrackKey.asReadonly();

  constructor() {
    this._load();
  }

  /**
   * Sets the active track key (videoId or title:artist).
   * Loads the track's saved offset, or 0 if none is saved.
   */
  public setTrack(trackKey: string | null | undefined): void {
    const key = (trackKey || '').trim() || DEFAULT_TRACK_KEY;
    if (key === this._currentTrackKey()) return;
    this._currentTrackKey.set(key);

    const saved = key in this._trackOffsets ? this._trackOffsets[key] : 0;
    this._offset.set(saved);
  }

  /**
   * Shift the offset by delta seconds (e.g. +0.1, -0.1, +0.5, -0.5).
   */
  public shift(delta: number): void {
    this.set(Math.round((this._offset() + delta) * 100) / 100);
  }

  public set(offset: number): void {
    const value = clampOffset(offset);
    if (value === this._offset()) return;
    this._offset.set(value);

    const key = this._currentTrackKey();
    if (key) {
      if (value === 0) {
        delete this._trackOffsets[key];
      } else {
        this._trackOffsets[key] = value;
      }
    }
    this._save();
  }

  public reset(): void {
    this.set(0);
  }

  public format(offset: number): string {
    if (offset === 0) return '0 s';
    const sign = offset > 0 ? '+' : '−';
    const abs = Math.abs(offset);
    const formatted = Number.isInteger(abs) ? abs.toString() : abs.toFixed(1);
    return `${sign}${formatted} s`;
  }

  private _load(): void {
    try {
      // Clear legacy global preferences to avoid stale offsets desyncing tracks
      if (globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY_V1)) {
        globalThis.localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      }
      if (globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY_SONARA)) {
        globalThis.localStorage.removeItem(LEGACY_STORAGE_KEY_SONARA);
      }

      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as PersistedLyricsPreferencesV2;
      if (parsed?.version !== LYRICS_PREFERENCES_VERSION || !parsed.trackOffsets) {
        return;
      }

      const cleanMap: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed.trackOffsets)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          cleanMap[k] = clampOffset(v);
        }
      }
      this._trackOffsets = cleanMap;

      const trackKey = parsed.lastTrackKey || DEFAULT_TRACK_KEY;
      this._currentTrackKey.set(trackKey);
      if (cleanMap[trackKey] !== undefined) {
        this._offset.set(cleanMap[trackKey]);
      }
    } catch {
      // Corrupted or unreadable: fallback to clean state
      this._trackOffsets = {};
      this._offset.set(0);
    }
  }

  private _save(): void {
    const keys = Object.keys(this._trackOffsets);
    // Limit stored keys to prevent localStorage bloat
    if (keys.length > MAX_STORED_TRACKS) {
      for (let i = 0; i < keys.length - MAX_STORED_TRACKS; i++) {
        delete this._trackOffsets[keys[i]];
      }
    }

    const state: PersistedLyricsPreferencesV2 = {
      version: LYRICS_PREFERENCES_VERSION,
      lastTrackKey: this._currentTrackKey(),
      trackOffsets: this._trackOffsets,
    };

    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or storage full: ignore
    }
  }
}

