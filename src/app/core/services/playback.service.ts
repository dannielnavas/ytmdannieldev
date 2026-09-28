import { computed, DestroyRef, effect, inject, Service, signal } from '@angular/core';
import { PersistedQueueItem, QueueItem } from '../models/queue.model';
import { Dashboard } from './dashboard/dashboard';
import { QueueCandidate, Thumbnail } from '../models/youtube';
import { getHighResThumbnail } from './image-helper.service';
import { AUDIO_FACTORY } from './audio-factory';
import {
  PLAYBACK_STATE_VERSION,
  PersistedPlaybackState,
  PlaybackStateStore,
} from './playback-state.store';

export type RepeatMode = 'off' | 'all' | 'one';

/** Consecutive track errors tolerated before playback stops trying to advance. */
const MAX_CONSECUTIVE_ERRORS = 3;

/** Minimum interval between two writes of the playback position, in ms. */
const POSITION_SAVE_INTERVAL_MS = 5000;

/** Speeds offered by the rate control, in ascending order. */
const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

let queueIdCounter = 0;

function nextQueueId(): string {
  return `q${++queueIdCounter}`;
}

/**
 * Normalizes the `duration` that the different endpoints return.
 *
 * `/youtube/dashboard` sends `duration` as a number for some items and as a
 * string like `"3:45"` for others. `player-bar` only accepted numbers, so the
 * string case silently degraded to a duration of 0.
 */
export function parseDuration(value: number | string | null | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.includes(':')) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
  }
  const parts = trimmed.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return undefined;
  return parts.reduce((acc, part) => acc * 60 + part, 0);
}

/**
 * Owner of the `<audio>` element and the single source of truth for playback.
 *
 * The element used to live in the `player-bar` template, which meant the
 * service could not seek, change volume or handle errors on its own, and three
 * different pieces (service, `player-bar` and `now-playing`) mutated it. Now the
 * service creates it, owns every event listener, and exposes a method per
 * action. Components read signals and call methods; they never write.
 */
@Service()
export class PlaybackService {
  private readonly _dashboard = inject(Dashboard);
  private readonly _createAudio = inject(AUDIO_FACTORY);
  private readonly _store = inject(PlaybackStateStore);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _audio: HTMLAudioElement;

  // --- Queue state. Only this service writes these. -------------------------

  private readonly _queue = signal<QueueItem[]>([]);
  private readonly _currentIndex = signal<number>(-1);
  private readonly _sourceTitle = signal<string>('');
  private readonly _isShuffle = signal<boolean>(false);
  private readonly _repeatMode = signal<RepeatMode>('all');

  public readonly $queue = this._queue.asReadonly();
  public readonly $currentIndex = this._currentIndex.asReadonly();
  public readonly $sourceTitle = this._sourceTitle.asReadonly();
  public readonly $isShuffle = this._isShuffle.asReadonly();
  public readonly $repeatMode = this._repeatMode.asReadonly();

  /** Authoritative order, kept so that turning shuffle off can restore it. */
  private _originalQueue: QueueItem[] = [];

  // --- Audio state. Read-only for components. -------------------------------

  private readonly _isPlaying = signal<boolean>(false);
  private readonly _currentTime = signal<number>(0);
  private readonly _duration = signal<number>(0);
  private readonly _volume = signal<number>(1);
  private readonly _isMuted = signal<boolean>(false);
  private readonly _playbackRate = signal<number>(1);
  private readonly _isBuffering = signal<boolean>(false);
  private readonly _artworkError = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  public readonly $isPlaying = this._isPlaying.asReadonly();
  public readonly $currentTime = this._currentTime.asReadonly();
  public readonly $duration = this._duration.asReadonly();
  public readonly $volume = this._volume.asReadonly();
  public readonly $isMuted = this._isMuted.asReadonly();
  public readonly $playbackRate = this._playbackRate.asReadonly();
  public readonly $isBuffering = this._isBuffering.asReadonly();
  public readonly $artworkError = this._artworkError.asReadonly();
  public readonly $error = this._error.asReadonly();

  /**
   * Track loaded in the audio element.
   *
   * It used to live under the `'song'` key of `GlobalStorage`, read by
   * `player-bar`, `now-playing` and three `detail-song-*` components: six
   * reactivities for one value. Now it is a single signal.
   */
  public readonly $stream = signal<{ videoId: string; streamUrl: string } | null>(null);

  /** Whether the user wants audio playing. Survives a track change. */
  private _shouldPlay = false;

  private _previousVolume = 1;
  private _consecutiveErrors = 0;
  /** Id of the track whose error we already retried, to avoid looping. */
  private _errorRetriedFor: string | null = null;

  /** Position to apply once the restored track reports its duration. */
  private _pendingSeek: number | null = null;
  private _lastPositionSave = 0;

  public constructor() {
    this._audio = this._createAudio();
    this._audio.preload = 'metadata';
    // The stream is cross-origin. Without CORS the element refuses to load it
    // at all when this attribute is present, so `electron/main.ts` injects
    // `access-control-allow-origin` for the API origin.
    this._audio.crossOrigin = 'anonymous';
    this._registerListeners();
    this._restoreSession();
    this._registerPersistence();
    this._destroyRef.onDestroy(() => this.dispose());
  }

  /** Exposed for the visualizer, which needs the same element instance. */
  public element(): HTMLAudioElement {
    return this._audio;
  }

  // --- Derived state --------------------------------------------------------

  public readonly $currentTrack = computed<QueueItem | null>(() => {
    const queue = this._queue();
    const index = this._currentIndex();
    return index >= 0 && index < queue.length ? queue[index] : null;
  });

  public readonly $hasNext = computed<boolean>(() => {
    const queue = this._queue();
    if (queue.length === 0) return false;
    if (this._currentIndex() < queue.length - 1) return true;
    return this._repeatMode() === 'all';
  });

  public readonly $hasPrevious = computed<boolean>(() => {
    const queue = this._queue();
    if (queue.length === 0) return false;
    if (this._currentIndex() > 0) return true;
    return this._repeatMode() === 'all';
  });

  /** Effective duration: what the element reports, or the queue's estimate. */
  public readonly $effectiveDuration = computed<number>(
    () => this._duration() || this.$currentTrack()?.duration || 0,
  );

  public readonly $progressPercent = computed<number>(() => {
    const duration = this.$effectiveDuration();
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (this._currentTime() / duration) * 100));
  });

  // --- Transport ------------------------------------------------------------

  public togglePlay(): void {
    if (this._isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  public play(): void {
    this._shouldPlay = true;
    if (!this.$stream()) return;
    this._invokePlay();
  }

  public pause(): void {
    // A manual pause cancels the pending autostart, so the `canplay` of the
    // current track does not resume behind the user's back.
    this._shouldPlay = false;
    this._audio.pause();
    this._isPlaying.set(false);
    this._isBuffering.set(false);
    this._store.flush();
  }

  public stop(): void {
    this._shouldPlay = false;
    this._audio.pause();
    this._audio.removeAttribute('src');
    this._audio.load();
    this.$stream.set(null);
    this._currentTime.set(0);
    this._duration.set(0);
    this._isPlaying.set(false);
  }

  public previous(): void {
    const queue = this._queue();
    if (queue.length === 0) return;

    // Past the first seconds, the conventional behavior is to restart the
    // track rather than jump to the previous one.
    if (this._audio.currentTime > 3) {
      this.seek(0);
      if (this._shouldPlay) this._invokePlay();
      return;
    }

    const index = this._currentIndex();
    if (index > 0) {
      this.playIndex(index - 1);
    } else if (this._repeatMode() === 'all') {
      this.playIndex(queue.length - 1);
    } else {
      this.seek(0);
    }
  }

  /**
   * Always advances. Repeat-one is handled by `onTrackEnded()`, so the Next
   * button never replays the current track.
   */
  public playNext(): void {
    const queue = this._queue();
    if (queue.length === 0) return;

    const index = this._currentIndex();
    if (index < queue.length - 1) {
      this.playIndex(index + 1);
      return;
    }

    if (this._repeatMode() === 'off') {
      this._isPlaying.set(false);
      return;
    }

    if (this._isShuffle()) {
      // Shuffle bag: reshuffle so a full loop does not replay the same order.
      this._reshuffleCycle();
      this.playIndex(0);
      return;
    }

    this.playIndex(0);
  }

  public playIndex(index: number): void {
    const queue = this._queue();
    if (index < 0 || index >= queue.length) return;
    this._currentIndex.set(index);
    this.playCurrent();
  }

  /**
   * Single implementation of repeat-one. The `player-bar` used to implement it
   * a second time, and the service branch made the Next button replay instead
   * of advancing.
   */
  public onTrackEnded(): void {
    if (this._repeatMode() === 'one') {
      this.playCurrent();
      return;
    }
    if (!this.$hasNext()) {
      this._shouldPlay = false;
      this._isPlaying.set(false);
      return;
    }
    this.playNext();
  }

  /** Loads the selected track into the stream. */
  public playCurrent(): void {
    this._shouldPlay = true;
    // An explicit track change discards the position kept for the restored one.
    this._pendingSeek = null;
    this._loadCurrent();
    this._invokePlay();
  }

  /** Points the element at the current track without starting playback. */
  private _loadCurrent(): void {
    const current = this.$currentTrack();
    if (!current?.videoId) return;

    this._artworkError.set(false);
    this._errorRetriedFor = null;
    this._currentTime.set(0);
    this._duration.set(0);
    this._isBuffering.set(true);

    const streamUrl = this._dashboard.getStreamUrl(current.videoId);
    this.$stream.set({ videoId: current.videoId, streamUrl });

    // Setting `src` does not reload by itself; without `load()` the element
    // keeps the previous track and never fires `canplay` for the new one.
    this._audio.src = streamUrl;
    this._audio.load();
  }

  // --- Seek, volume, rate ---------------------------------------------------

  public seek(seconds: number): void {
    const duration = this._audio.duration;
    const limit = Number.isFinite(duration) && duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const target = Math.min(Math.max(0, seconds), limit);
    this._audio.currentTime = target;
    this._currentTime.set(target);
  }

  public seekToPercent(percent: number): void {
    const duration = this.$effectiveDuration();
    if (duration <= 0) return;
    this.seek((Math.min(100, Math.max(0, percent)) / 100) * duration);
  }

  public seekBy(delta: number): void {
    this.seek(this._audio.currentTime + delta);
  }

  public setVolume(volume: number): void {
    const value = Math.min(1, Math.max(0, volume));
    this._audio.volume = value;
    this._audio.muted = value === 0;
    this._volume.set(value);
    this._isMuted.set(value === 0);
    if (value > 0) this._previousVolume = value;
  }

  public nudgeVolume(delta: number): void {
    this.setVolume(this._volume() + delta);
  }

  public toggleMute(): void {
    if (this._isMuted() || this._volume() === 0) {
      this.setVolume(this._previousVolume || 0.5);
    } else {
      this._previousVolume = this._volume();
      this.setVolume(0);
    }
  }

  public setRate(rate: number): void {
    const value = Math.min(2, Math.max(0.5, rate));
    this._audio.playbackRate = value;
    // Keeps the pitch when speeding up, so voices do not sound like a chipmunk.
    this._audio.preservesPitch = true;
    this._playbackRate.set(value);
  }

  /**
   * Moves to the next preset in the given direction.
   *
   * A custom rate that is not on the list snaps to the closest preset in that
   * direction, instead of jumping to the first one.
   */
  public cycleRate(direction: 'up' | 'down' = 'up'): void {
    const current = this.$playbackRate();
    const index = RATE_PRESETS.findIndex((rate) => Math.abs(rate - current) < 0.001);

    if (index === -1) {
      const next =
        direction === 'up'
          ? RATE_PRESETS.find((rate) => rate > current)
          : [...RATE_PRESETS].reverse().find((rate) => rate < current);
      this.setRate(next ?? (direction === 'up' ? RATE_PRESETS[0] : RATE_PRESETS.at(-1)!));
      return;
    }

    const step = direction === 'up' ? 1 : -1;
    // Wrap around at both ends.
    const next = (index + step + RATE_PRESETS.length) % RATE_PRESETS.length;
    this.setRate(RATE_PRESETS[next]);
  }

  // --- Modes ----------------------------------------------------------------

  /**
   * Toggles shuffle. Turning it on keeps the current track first and shuffles
   * the rest; turning it off restores the original order and the matching index.
   *
   * Comparison happens on `QueueItem.id`, not on `videoId`: the queue may hold
   * the same song twice, and filtering by `videoId` silently deleted those.
   */
  public toggleShuffle(): void {
    if (this._isShuffle()) {
      this._applyOriginalOrder();
      this._isShuffle.set(false);
      return;
    }
    this._isShuffle.set(true);
    this._reshuffleKeepingCurrent();
  }

  public toggleRepeat(): void {
    const current = this._repeatMode();
    this._repeatMode.set(current === 'off' ? 'all' : current === 'all' ? 'one' : 'off');
  }

  public reportArtworkError(): void {
    this._artworkError.set(true);
  }

  public clearError(): void {
    this._error.set(null);
  }

  public dispose(): void {
    this._store.flush();
    this._audio.pause();
    this._audio.removeAttribute('src');
    this._audio.load();
  }

  /** Forgets the saved session, e.g. when the user clears the queue. */
  public clearPersistedState(): void {
    this._store.clear();
  }

  // --- Queue construction ---------------------------------------------------

  /**
   * Converts songs from any endpoint into `QueueItem`, resolving the thumbnail
   * to the best quality available and optionally falling back to the
   * container's thumbnails.
   *
   * This mapper was copy-pasted in 7 places (album, playlist, list-search,
   * home) and the copies had already diverged.
   */
  public toQueueItems(
    songs: readonly QueueCandidate[],
    options: { fallbackThumbnails?: readonly Thumbnail[] | null; size?: number } = {},
  ): QueueItem[] {
    const { fallbackThumbnails, size = 800 } = options;

    return songs
      .filter((song): song is QueueCandidate & { videoId: string } => Boolean(song?.videoId))
      .map((song) => {
        const own = song.thumbnails ?? [];
        const fallback = fallbackThumbnails ?? [];
        const raw =
          own[own.length - 1]?.url ||
          fallback[fallback.length - 1]?.url ||
          own[0]?.url ||
          fallback[0]?.url ||
          '';

        return {
          id: nextQueueId(),
          videoId: song.videoId,
          name: song.name,
          artist: song.artist?.name || '',
          duration: parseDuration(song.duration),
          thumbnail: getHighResThumbnail(raw, size),
        };
      });
  }

  /** Wraps existing items (from persistence) assigning ids when missing. */
  public normalizeQueueItems(items: readonly PersistedQueueItem[]): QueueItem[] {
    return items
      .filter((item): item is PersistedQueueItem & { videoId: string } => Boolean(item?.videoId))
      .map((item) => ({
        id: item.id || nextQueueId(),
        videoId: item.videoId,
        name: item.name ?? 'Pista desconocida',
        artist: item.artist,
        duration: parseDuration(item.duration),
        thumbnail: item.thumbnail,
      }));
  }

  /** Loads a full list as the queue and plays from the given index. */
  public playQueue(items: QueueItem[], startIndex = 0, sourceTitle?: string): void {
    if (!items || items.length === 0) return;

    this._originalQueue = [...items];
    this._sourceTitle.set(sourceTitle || '');

    if (this._isShuffle()) {
      // Reshuffle even if the mode was already on. `playShuffled` used to skip
      // this, so the UI said "shuffle" while playback was sequential.
      const index = Math.min(Math.max(0, startIndex), items.length - 1);
      this._queue.set(this._shuffleFrom(items, items[index]));
      this._currentIndex.set(0);
    } else {
      this._queue.set([...items]);
      this._currentIndex.set(Math.max(0, Math.min(startIndex, items.length - 1)));
    }

    this.playCurrent();
  }

  /**
   * Plays a set of songs from a random track with shuffle enabled.
   *
   * This block used to be copy-pasted byte for byte in `album.ts`,
   * `playlist.ts` and `list-search.ts`.
   */
  public playShuffled(
    songs: readonly QueueCandidate[],
    options: {
      fallbackThumbnails?: readonly Thumbnail[] | null;
      size?: number;
      sourceTitle?: string;
    } = {},
  ): void {
    const items = this.toQueueItems(songs, options);
    if (items.length === 0) return;

    const randomIndex = Math.floor(Math.random() * items.length);
    // Enable the flag before `playQueue`, which builds the shuffled order only
    // when it is on. This is what used to be missed, leaving the UI claiming
    // "shuffle" while playback ran sequentially.
    this._isShuffle.set(true);
    this.playQueue(items, randomIndex, options.sourceTitle);
  }

  /**
   * Adds or replaces the current song, playing a single track.
   *
   * If the video is already queued we jump to it instead of duplicating it.
   */
  public playSingle(item: Omit<QueueItem, 'id'> & { id?: string }): void {
    const existingIndex = this._queue().findIndex((q) => q.videoId === item.videoId);
    if (existingIndex !== -1) {
      this.playIndex(existingIndex);
      return;
    }

    const entry: QueueItem = { ...item, id: item.id || nextQueueId() };
    const newQueue = [...this._queue(), entry];
    this._originalQueue = [...newQueue];
    this._queue.set(newQueue);
    this._currentIndex.set(newQueue.length - 1);
    this.playCurrent();
  }

  // --- Queue editing --------------------------------------------------------

  /**
   * Moves an entry to another position.
   *
   * The cursor follows the *track* that is playing, not the index: with the
   * naive index arithmetic the current song would jump to a different entry as
   * soon as something moved across it. And since a manual order is an explicit
   * statement of intent, the visible order becomes the canonical one, so
   * turning shuffle off does not undo the edit.
   */
  public moveInQueue(from: number, to: number): void {
    const queue = this._queue();
    if (from < 0 || from >= queue.length) return;

    const target = Math.max(0, Math.min(to, queue.length - 1));
    if (target === from) return;

    const next = [...queue];
    const [entry] = next.splice(from, 1);
    next.splice(target, 0, entry);

    const currentId = this.$currentTrack()?.id;
    this._queue.set(next);
    this._originalQueue = [...next];
    this._currentIndex.set(
      currentId === undefined
        ? target
        : Math.max(
            0,
            next.findIndex((i) => i.id === currentId),
          ),
    );
    this._store.flush();
  }

  /**
   * Removes one entry.
   *
   * Removing the track that is playing takes over its slot, which is where the
   * listener expects the next song to start, and playback is only restarted if
   * it was running.
   */
  public removeFromQueue(index: number): void {
    const queue = this._queue();
    if (index < 0 || index >= queue.length) return;

    const isCurrent = index === this._currentIndex();
    // `_shouldPlay` also covers a `play()` still waiting for `canplay`, where
    // `_isPlaying` is already false but the sound is on its way.
    const shouldResume = this._shouldPlay;
    const next = queue.filter((_, i) => i !== index);

    if (next.length === 0) {
      this._queue.set([]);
      this._originalQueue = [];
      this._currentIndex.set(-1);
      this.stop();
      this._store.flush();
      return;
    }

    this._queue.set(next);
    this._originalQueue = [...next];

    if (isCurrent) {
      this._currentIndex.set(Math.min(index, next.length - 1));
      // The element has to follow the cursor: the UI already shows the
      // successor, so leaving the removed track loaded would make the next press
      // of play resume a track that is no longer in the queue. Any pending seek
      // belonged to the removed track and is discarded.
      this._pendingSeek = null;
      this._loadCurrent();
      if (shouldResume) this._invokePlay();
    } else {
      // Everything before the cursor shifted one place to the left.
      const cursor = this._currentIndex();
      this._currentIndex.set(index < cursor ? cursor - 1 : cursor);
    }

    this._store.flush();
  }

  /** Empties the queue and stops playback. */
  public clearQueue(): void {
    this._queue.set([]);
    this._originalQueue = [];
    this._currentIndex.set(-1);
    this.stop();
    this._store.flush();
  }

  // --- Session persistence --------------------------------------------------

  /**
   * Rebuilds the previous session without starting playback.
   *
   * Autoplay is not attempted: the browser and Electron both block it, and
   * starting music on its own when the app opens is not what the user asked
   * for. The track is loaded and the position applied on the first play.
   */
  private _restoreSession(): void {
    const state = this._store.load();
    if (!state) return;

    const queue = this.normalizeQueueItems(state.queue);
    if (queue.length === 0) return;

    this._originalQueue = [...queue];
    this._queue.set(queue);
    this._currentIndex.set(Math.min(Math.max(0, state.currentIndex), queue.length - 1));
    this._sourceTitle.set(state.sourceTitle);
    this._isShuffle.set(state.shuffle);
    this._repeatMode.set(state.repeat);
    this.setVolume(state.muted ? 0 : state.volume);
    this.setRate(state.rate);

    this._pendingSeek = state.position > 0 ? state.position : null;
    this._loadCurrent();
  }

  /**
   * Persists queue and settings on every change. The store coalesces the
   * writes, because the position alone ticks four times per second.
   */
  private _registerPersistence(): void {
    effect(() => {
      // Tracked dependencies: any of these changing is worth a snapshot.
      this._queue();
      this._currentIndex();
      this._sourceTitle();
      this._isShuffle();
      this._repeatMode();
      this._volume();
      this._isMuted();
      this._playbackRate();
      this._scheduleSave();
    });

    // A plain function: it is not reactive, only a safety net for the moment
    // the window goes away and no `dispose` is guaranteed.
    const onUnload = () => this._store.flush();
    globalThis.addEventListener?.('beforeunload', onUnload);
    this._destroyRef.onDestroy(() => globalThis.removeEventListener?.('beforeunload', onUnload));
  }

  private _savePosition(): void {
    const now = Date.now();
    if (now - this._lastPositionSave < POSITION_SAVE_INTERVAL_MS) return;
    this._lastPositionSave = now;
    this._scheduleSave();
  }

  private _scheduleSave(): void {
    this._store.save(this._snapshot());
  }

  private _snapshot(): PersistedPlaybackState {
    return {
      version: PLAYBACK_STATE_VERSION,
      queue: this._queue(),
      currentIndex: this._currentIndex(),
      position: this._audio.currentTime || 0,
      volume: this._volume(),
      muted: this._isMuted(),
      rate: this._playbackRate(),
      shuffle: this._isShuffle(),
      repeat: this._repeatMode(),
      sourceTitle: this._sourceTitle(),
      savedAt: Date.now(),
    };
  }

  private _applyPendingSeek(): void {
    const target = this._pendingSeek;
    if (target === null) return;
    this._pendingSeek = null;
    this.seek(target);
  }

  // --- Internals ------------------------------------------------------------

  private _invokePlay(): void {
    const result = this._audio.play() as Promise<void> | undefined;
    if (!result || typeof result.then !== 'function') {
      // jsdom and old engines may not return a promise.
      this._isPlaying.set(true);
      return;
    }
    result
      .then(() => {
        this._isPlaying.set(true);
        this._isBuffering.set(false);
      })
      .catch((err: Error) => {
        // A new track interrupting the previous one is normal, not an error.
        if (err?.name === 'AbortError') return;
        console.warn('Error al reproducir audio:', err);
        this._isPlaying.set(false);
      });
  }

  private _registerListeners(): void {
    const audio = this._audio;

    audio.addEventListener('timeupdate', () => {
      this._currentTime.set(audio.currentTime);
      this._savePosition();
    });

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this._duration.set(audio.duration);
        this._applyPendingSeek();
      }
    };
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);

    audio.addEventListener('play', () => this._isPlaying.set(true));
    audio.addEventListener('playing', () => {
      this._isPlaying.set(true);
      this._isBuffering.set(false);
      // A track that really played resets the outage counter: the cap is about
      // consecutive failures, not about failures over a whole session.
      this._consecutiveErrors = 0;
    });
    audio.addEventListener('pause', () => {
      // Only the element knows whether it is really paused, for instance when
      // a track change interrupts the previous audio.
      if (audio.paused) this._isPlaying.set(false);
    });
    audio.addEventListener('waiting', () => this._isBuffering.set(true));
    audio.addEventListener('canplay', () => {
      this._isBuffering.set(false);
      // The message of a failed track survives the automatic skip: it is only
      // cleared once the next track is actually playable, so the user learns
      // why the song changed.
      this._error.set(null);
      this._consecutiveErrors = 0;
      if (this._shouldPlay && audio.paused) this._invokePlay();
    });
    audio.addEventListener('ended', () => {
      this._isPlaying.set(false);
      this.onTrackEnded();
    });
    audio.addEventListener('ratechange', () => this._playbackRate.set(audio.playbackRate));
    audio.addEventListener('volumechange', () => {
      this._volume.set(audio.volume);
      this._isMuted.set(audio.muted || audio.volume === 0);
    });
    audio.addEventListener('error', () => this._handleStreamError());
  }

  /**
   * A failed stream used to only log to the console: playback silently stopped
   * with no feedback. Now it surfaces the error and skips to the next track,
   * with a cap so a backend outage does not burn through the whole queue.
   */
  private _handleStreamError(): void {
    const track = this.$currentTrack();
    this._isPlaying.set(false);
    this._isBuffering.set(false);

    const message = this._audio.error?.message || 'No se pudo reproducir esta pista.';
    this._error.set(message);

    if (!track || this._errorRetriedFor === track.id) return;
    this._errorRetriedFor = track.id;
    this._consecutiveErrors++;

    if (this._consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
      this._error.set(
        'Varias pistas seguidas fallaron. Comprueba tu conexión o vuelve a iniciar sesión.',
      );
      this._shouldPlay = false;
      return;
    }

    this.playNext();
  }

  private _reshuffleKeepingCurrent(): void {
    const current = this.$currentTrack();
    const base = this._originalQueue;
    if (base.length === 0) return;

    if (!current) {
      this._queue.set(this._shuffleArray(base));
      this._currentIndex.set(0);
      return;
    }

    const rest = base.filter((item) => item.id !== current.id);
    this._queue.set([current, ...this._shuffleArray(rest)]);
    this._currentIndex.set(0);
  }

  private _applyOriginalOrder(): void {
    const current = this.$currentTrack();
    this._queue.set([...this._originalQueue]);
    if (!current) {
      this._currentIndex.set(-1);
      return;
    }
    const index = this._originalQueue.findIndex((item) => item.id === current.id);
    this._currentIndex.set(index !== -1 ? index : 0);
  }

  /**
   * Reorders the queue for a new listening cycle: unheard tracks first, in
   * random order, and the ones already played moved to the back.
   */
  private _reshuffleCycle(): void {
    const queue = this._queue();
    if (queue.length < 2) return;

    const unplayed = queue.slice(this._currentIndex() + 1);
    const played = queue.slice(0, this._currentIndex() + 1);
    if (unplayed.length === 0) return;

    this._queue.set([...this._shuffleArray(unplayed), ...this._shuffleArray(played)]);
  }

  /** Returns `items` rotated so that `pinned` is first, and the rest shuffled. */
  private _shuffleFrom(items: readonly QueueItem[], pinned: QueueItem): QueueItem[] {
    const rest = items.filter((item) => item.id !== pinned.id);
    return [pinned, ...this._shuffleArray(rest)];
  }

  private _shuffleArray<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
