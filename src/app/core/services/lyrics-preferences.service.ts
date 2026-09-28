import { Service, signal } from '@angular/core';

const STORAGE_KEY = 'sonara.lyrics-preferences.v1';

/** Bumped whenever the shape changes, so old payloads are discarded. */
export const LYRICS_PREFERENCES_VERSION = 1;

/** Beyond a few seconds the lyrics are not "out of sync", they are wrong. */
const MAX_OFFSET_SECONDS = 10;

const STEP_SECONDS = 0.5;

interface PersistedLyricsPreferences {
  version: number;
  offset: number;
}

function clampOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_OFFSET_SECONDS, Math.max(-MAX_OFFSET_SECONDS, value));
}

/**
 * Timing correction for the lyrics of a track.
 *
 * Lrclib timestamps come from a database, not from the audio we are playing, so
 * a track can be two seconds ahead or behind. Without a correction the only
 * option is to live with the wrong line, or to leave the view.
 *
 * The preference is kept in `localStorage` because the offset that works for an
 * album works for the next listen of the same album. It is not a secret.
 */
@Service()
export class LyricsPreferencesService {
  private readonly _offset = signal(this._load());

  /**
   * Seconds added to every lyric timestamp. A positive value makes the lines
   * appear earlier, which is what someone needs when the lyrics run behind.
   */
  public readonly $offset = this._offset.asReadonly();

  /**
   * Written only when the user changes it: an unconditional write on startup
   * would touch the disk of every launch, and the value it stored is the one
   * that was just read.
   */
  public shift(delta: number): void {
    this.set(Math.round((this._offset() + delta) * 100) / 100);
  }

  public set(offset: number): void {
    const value = clampOffset(offset);
    if (value === this._offset()) return;
    this._offset.set(value);
    this._save(value);
  }

  public reset(): void {
    this.set(0);
  }

  public format(offset: number): string {
    if (offset === 0) return '0 s';
    const sign = offset > 0 ? '+' : '−';
    return `${sign}${Math.abs(offset).toFixed(1).replace(/\.0$/, '')} s`;
  }

  private _load(): number {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as PersistedLyricsPreferences;
      if (parsed?.version !== LYRICS_PREFERENCES_VERSION) return 0;
      return clampOffset(parsed.offset);
    } catch {
      // Corrupted or unreadable: the lyrics are still usable, just not aligned.
      return 0;
    }
  }

  private _save(offset: number): void {
    const state: PersistedLyricsPreferences = {
      version: LYRICS_PREFERENCES_VERSION,
      offset,
    };
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode: the correction is lost on the next launch, no big deal.
    }
  }
}
