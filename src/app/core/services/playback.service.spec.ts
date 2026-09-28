import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaybackService, parseDuration } from './playback.service';
import { AUDIO_FACTORY } from './audio-factory';
import { FakeAudioElement, createFakeAudioFactory } from '../testing/fake-audio-element';
import { QueueItem } from '../models/queue.model';
import { PLAYBACK_STATE_VERSION } from './playback-state.store';

const STORAGE_KEY = 'sonara.playback-state.v1';

function storedState(): Record<string, unknown> | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

function track(n: number): QueueItem {
  return { id: `id${n}`, videoId: `v${n}`, name: `Song ${n}`, artist: 'Artist', duration: 100 + n };
}

const A = track(1);
const B = track(2);
const C = track(3);

describe('PlaybackService', () => {
  let service: PlaybackService;
  let audio: FakeAudioElement;

  beforeEach(() => {
    localStorage.clear();
    const factory = createFakeAudioFactory();
    audio = factory();

    TestBed.configureTestingModule({
      providers: [
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });
    service = TestBed.inject(PlaybackService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  /** `repeatMode` is read-only from outside: reach a mode through the cycle. */
  function setRepeat(mode: 'off' | 'all' | 'one'): void {
    let guard = 0;
    while (service.$repeatMode() !== mode && guard++ < 4) {
      service.toggleRepeat();
    }
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty queue', () => {
    expect(service.$queue()).toEqual([]);
    expect(service.$currentIndex()).toBe(-1);
    expect(service.$hasNext()).toBe(false);
    expect(service.$hasPrevious()).toBe(false);
  });

  it('configures the element it owns', () => {
    expect(audio.preload).toBe('metadata');
    expect(audio.crossOrigin).toBe('anonymous');
  });

  describe('playQueue', () => {
    it('sets the queue, clamps the start index and exposes the current track', () => {
      service.playQueue([A, B, C], 1, 'My Album');

      expect(service.$queue()).toEqual([A, B, C]);
      expect(service.$currentIndex()).toBe(1);
      expect(service.$currentTrack()).toEqual(B);
      expect(service.$sourceTitle()).toBe('My Album');
    });

    it('clamps an out-of-range index to the last track', () => {
      service.playQueue([A, B, C], 99);
      expect(service.$currentIndex()).toBe(2);
    });

    it('ignores an empty list', () => {
      service.playQueue([], 0);
      expect(service.$queue()).toEqual([]);
      expect(service.$currentIndex()).toBe(-1);
    });

    it('reloads the element so the new source is fetched', () => {
      audio.load = vi.fn();
      service.playQueue([A], 0);

      // Without `load()` the element kept the previous track and never fired
      // `canplay` for the new one.
      expect(audio.load).toHaveBeenCalled();
      expect(audio.src).toContain('v1');
    });

    it('shuffles the new queue when shuffle was already on', () => {
      service.playQueue([A, B, C], 0, 'Mix');
      service.toggleShuffle();

      service.playQueue([A, B, C], 2, 'Otro');

      expect(service.$isShuffle()).toBe(true);
      expect(service.$queue().length).toBe(3);
      expect(service.$currentTrack()?.videoId).toBe('v3');
      expect(
        service
          .$queue()
          .map((item) => item.videoId)
          .sort(),
      ).toEqual(['v1', 'v2', 'v3']);
    });
  });

  describe('playSingle', () => {
    it('appends the track when it is not in the queue', () => {
      service.playSingle(A);
      expect(service.$queue()).toHaveLength(1);
      expect(service.$currentIndex()).toBe(0);
      expect(service.$currentTrack()?.videoId).toBe('v1');
    });

    it('jumps to the existing entry instead of duplicating it', () => {
      service.playQueue([A, B, C], 0);
      service.playSingle(C);

      expect(service.$queue()).toEqual([A, B, C]);
      expect(service.$currentIndex()).toBe(2);
    });
  });

  describe('next / previous', () => {
    it('advances to the next track', () => {
      service.playQueue([A, B, C], 0, 'Mix');
      service.playNext();
      expect(service.$currentIndex()).toBe(1);
    });

    it('wraps to the first track when repeat is "all"', () => {
      service.playQueue([A, B, C], 2);
      service.playNext();
      expect(service.$currentIndex()).toBe(0);
    });

    it('stays on the last track when repeat is "off"', () => {
      setRepeat('off');
      service.playQueue([A, B, C], 2);
      service.playNext();
      expect(service.$currentIndex()).toBe(2);
    });

    it('always advances, even with repeat "one"', () => {
      setRepeat('one');
      service.playQueue([A, B, C], 1);
      service.playNext();
      expect(service.$currentIndex()).toBe(2);
    });

    it('goes back to the previous track', () => {
      service.playQueue([A, B, C], 2);
      service.previous();
      expect(service.$currentIndex()).toBe(1);
    });

    it('restarts the track instead of skipping past 3 seconds', () => {
      service.playQueue([A, B, C], 1);
      audio.currentTime = 10;

      service.previous();

      expect(service.$currentIndex()).toBe(1);
      expect(audio.currentTime).toBe(0);
    });

    it('wraps to the last track from the first one when repeat is "all"', () => {
      service.playQueue([A, B, C], 0);
      service.previous();
      expect(service.$currentIndex()).toBe(2);
    });

    it('rewinds on the first track when repeat is "off"', () => {
      setRepeat('off');
      service.playQueue([A, B, C], 0);
      audio.currentTime = 2;

      service.previous();

      expect(service.$currentIndex()).toBe(0);
      expect(audio.currentTime).toBe(0);
    });
  });

  describe('onTrackEnded', () => {
    beforeEach(() => service.playQueue([A, B, C], 0, 'Mix'));

    it('replays the same track when repeat is "one"', () => {
      setRepeat('one');
      audio.fireEnded();
      expect(service.$currentIndex()).toBe(0);
      expect(service.$currentTrack()).toEqual(A);
    });

    it('advances otherwise', () => {
      audio.fireEnded();
      expect(service.$currentIndex()).toBe(1);
    });

    it('stops at the end of the queue when repeat is "off"', () => {
      setRepeat('off');
      service.playIndex(2);
      audio.fireEnded();

      expect(service.$currentIndex()).toBe(2);
      expect(service.$isPlaying()).toBe(false);
    });
  });

  describe('playIndex', () => {
    it('jumps to a valid index', () => {
      service.playQueue([A, B, C], 0);
      service.playIndex(2);
      expect(service.$currentIndex()).toBe(2);
    });

    it('ignores an out-of-range index', () => {
      service.playQueue([A, B, C], 1);
      service.playIndex(7);
      expect(service.$currentIndex()).toBe(1);
    });
  });

  describe('toggleShuffle', () => {
    beforeEach(() => service.playQueue([A, B, C], 0, 'Mix'));

    it('keeps the current track first and preserves every other track', () => {
      service.toggleShuffle();

      expect(service.$isShuffle()).toBe(true);
      expect(service.$currentIndex()).toBe(0);
      expect(service.$currentTrack()).toEqual(A);
      expect(
        service
          .$queue()
          .slice(1)
          .map((t) => t.videoId)
          .sort(),
      ).toEqual(['v2', 'v3']);
    });

    it('restores the original order when disabled', () => {
      service.toggleShuffle();
      service.toggleShuffle();

      expect(service.$isShuffle()).toBe(false);
      expect(service.$queue()).toEqual([A, B, C]);
      expect(service.$currentIndex()).toBe(0);
    });

    it('keeps duplicated songs when reordering', () => {
      service.playQueue([A, B, { ...A, id: 'other' }], 0);
      service.toggleShuffle();
      service.toggleShuffle();

      expect(service.$queue()).toHaveLength(3);
    });
  });

  describe('toggleRepeat', () => {
    it('cycles all -> one -> off', () => {
      expect(service.$repeatMode()).toBe('all');

      service.toggleRepeat();
      expect(service.$repeatMode()).toBe('one');

      service.toggleRepeat();
      expect(service.$repeatMode()).toBe('off');

      service.toggleRepeat();
      expect(service.$repeatMode()).toBe('all');
    });
  });

  describe('availability', () => {
    it('reports next/previous when repeat is "all"', () => {
      service.playQueue([A, B, C], 0);
      expect(service.$hasNext()).toBe(true);
      expect(service.$hasPrevious()).toBe(true);
    });

    it('reports no next on the last track when repeat is "off"', () => {
      setRepeat('off');
      service.playQueue([A, B, C], 2);
      expect(service.$hasNext()).toBe(false);
      expect(service.$hasPrevious()).toBe(true);
    });

    it('is false on an empty queue regardless of repeat mode', () => {
      expect(service.$hasNext()).toBe(false);
      expect(service.$hasPrevious()).toBe(false);
    });
  });

  describe('transport state', () => {
    it('reflects play and pause on the owned element', () => {
      service.playQueue([A], 0);

      expect(service.$isPlaying()).toBe(true);

      service.pause();
      expect(service.$isPlaying()).toBe(false);
      expect(audio.paused).toBe(true);
    });

    it('toggles play/pause', () => {
      service.playQueue([A], 0);
      service.togglePlay();
      expect(service.$isPlaying()).toBe(false);
      service.togglePlay();
      expect(service.$isPlaying()).toBe(true);
    });

    it('does not throw without a track', () => {
      expect(() => service.play()).not.toThrow();
      expect(() => service.pause()).not.toThrow();
      expect(service.$isPlaying()).toBe(false);
    });

    it('reports buffering until the element has data', () => {
      service.playQueue([A], 0);
      expect(service.$isBuffering()).toBe(true);

      audio.firePlaying();
      expect(service.$isBuffering()).toBe(false);

      audio.fireWaiting();
      expect(service.$isBuffering()).toBe(true);

      audio.fireCanPlay();
      expect(service.$isBuffering()).toBe(false);
    });

    it('exposes the current time and duration', () => {
      service.playQueue([A], 0);
      audio.setDuration(180);
      audio.tick(30);

      expect(service.$duration()).toBe(180);
      expect(service.$currentTime()).toBe(30);
      expect(service.$progressPercent()).toBeCloseTo((30 / 180) * 100);
    });

    it('falls back to the queue duration before metadata arrives', () => {
      service.playQueue([A], 0);
      expect(service.$effectiveDuration()).toBe(A.duration);
    });

    it('stops and clears the stream', () => {
      service.playQueue([A], 0);
      service.stop();

      expect(service.$stream()).toBeNull();
      expect(service.$isPlaying()).toBe(false);
      expect(service.$currentTime()).toBe(0);
    });
  });

  describe('seek', () => {
    beforeEach(() => {
      service.playQueue([A], 0);
      audio.setDuration(200);
    });

    it('moves the clock', () => {
      service.seek(60);
      expect(audio.currentTime).toBe(60);
      expect(service.$currentTime()).toBe(60);
    });

    it('clamps to the duration and to zero', () => {
      service.seek(500);
      expect(audio.currentTime).toBe(200);

      service.seek(-10);
      expect(audio.currentTime).toBe(0);
    });

    it('seeks by percent', () => {
      service.seekToPercent(50);
      expect(audio.currentTime).toBe(100);
    });

    it('seeks by a delta', () => {
      service.seek(30);
      service.seekBy(-10);
      expect(audio.currentTime).toBe(20);
    });
  });

  describe('volume and rate', () => {
    it('clamps and stores the volume', () => {
      service.setVolume(0.5);
      expect(service.$volume()).toBe(0.5);
      expect(audio.volume).toBe(0.5);

      service.setVolume(5);
      expect(service.$volume()).toBe(1);
    });

    it('mutes and restores the previous volume', () => {
      service.setVolume(0.8);
      service.toggleMute();

      expect(service.$isMuted()).toBe(true);
      expect(audio.muted).toBe(true);

      service.toggleMute();
      expect(service.$isMuted()).toBe(false);
      expect(service.$volume()).toBe(0.8);
    });

    it('nudges the volume', () => {
      service.setVolume(0.5);
      service.nudgeVolume(0.25);
      expect(service.$volume()).toBe(0.75);
    });

    it('clamps the rate and preserves the pitch', () => {
      service.setRate(1.5);
      expect(service.$playbackRate()).toBe(1.5);
      expect(audio.playbackRate).toBe(1.5);
      expect(audio.preservesPitch).toBe(true);

      service.setRate(9);
      expect(service.$playbackRate()).toBe(2);
    });

    it('cycles the rate through the presets', () => {
      service.cycleRate();
      expect(service.$playbackRate()).toBe(1.25);

      service.cycleRate();
      expect(service.$playbackRate()).toBe(1.5);

      service.cycleRate();
      expect(service.$playbackRate()).toBe(2);

      // Wraps around to the slowest preset.
      service.cycleRate();
      expect(service.$playbackRate()).toBe(0.5);
    });
  });

  describe('queue mapping', () => {
    it('builds queue items with ids and the best thumbnail', () => {
      const items = service.toQueueItems([
        {
          videoId: 'v9',
          name: 'Nine',
          duration: '3:45',
          thumbnails: [
            { url: 'https://i.ytimg.com/vi/v9/hq.jpg', width: 480, height: 480 },
            { url: 'https://i.ytimg.com/vi/v9/max.jpg', width: 1280, height: 1280 },
          ],
        },
      ]);

      expect(items).toHaveLength(1);
      expect(items[0].id).toBeTruthy();
      expect(items[0].duration).toBe(225);
      expect(items[0].thumbnail).toContain('max.jpg');
    });

    it('skips songs without videoId', () => {
      const items = service.toQueueItems([{ name: 'Sin id' } as never]);
      expect(items).toEqual([]);
    });

    it('normalizes persisted items, assigning ids when missing', () => {
      const items = service.normalizeQueueItems([
        { videoId: 'v1', name: 'One', duration: 120 },
        { videoId: 'v2', name: 'Two', duration: '2:05', id: 'kept' },
        { name: 'Sin videoId' },
      ]);

      expect(items).toHaveLength(2);
      expect(items[0].id).toBeTruthy();
      expect(items[1].id).toBe('kept');
      expect(items[1].duration).toBe(125);
    });
  });

  describe('queue editing', () => {
    function ids(): string[] {
      return service.$queue().map((item) => item.id);
    }

    beforeEach(() => {
      service.playQueue([A, B, C], 0);
    });

    it('moves an entry to another position', () => {
      service.moveInQueue(0, 2);
      expect(ids()).toEqual(['id2', 'id3', 'id1']);
    });

    it('keeps the track that is playing selected after a move', () => {
      service.playIndex(2);
      service.moveInQueue(0, 1);
      expect(ids()).toEqual(['id2', 'id1', 'id3']);
      expect(service.$currentIndex()).toBe(2);
      expect(service.$currentTrack()?.id).toBe('id3');
    });

    it('clamps the target and ignores a move onto itself', () => {
      service.moveInQueue(0, 99);
      expect(ids()).toEqual(['id2', 'id3', 'id1']);

      service.moveInQueue(1, 1);
      expect(ids()).toEqual(['id2', 'id3', 'id1']);
    });

    it('ignores an out-of-range source', () => {
      service.moveInQueue(-1, 0);
      service.moveInQueue(9, 0);
      expect(ids()).toEqual(['id1', 'id2', 'id3']);
    });

    it('removes an entry after the cursor without moving it', () => {
      service.removeFromQueue(2);
      expect(ids()).toEqual(['id1', 'id2']);
      expect(service.$currentIndex()).toBe(0);
    });

    it('shifts the cursor when an entry before it disappears', () => {
      service.playIndex(2);
      service.removeFromQueue(0);
      expect(ids()).toEqual(['id2', 'id3']);
      expect(service.$currentIndex()).toBe(1);
      expect(service.$currentTrack()?.id).toBe('id3');
    });

    it('hands the slot of the removed track to the next one while playing', () => {
      service.playIndex(0);
      service.removeFromQueue(0);
      expect(ids()).toEqual(['id2', 'id3']);
      expect(service.$currentIndex()).toBe(0);
      expect(service.$currentTrack()?.id).toBe('id2');
      expect(service.$isPlaying()).toBe(true);
    });

    it('falls back to the previous entry when the last one is removed', () => {
      service.playIndex(2);
      service.removeFromQueue(2);
      expect(ids()).toEqual(['id1', 'id2']);
      expect(service.$currentTrack()?.id).toBe('id2');
    });

    it('does not start playback when a paused track is removed', () => {
      service.pause();
      service.removeFromQueue(0);
      expect(service.$isPlaying()).toBe(false);
    });

    it('loads the successor of a paused track so play cannot resume the removed one', () => {
      service.playIndex(0);
      service.pause();

      service.removeFromQueue(0);

      expect(service.$currentTrack()?.id).toBe('id2');
      expect(service.$stream()?.videoId).toBe('v2');
      expect(audio.src).toContain('v2');
      expect(service.$isPlaying()).toBe(false);
    });

    it('keeps playing when the removed track had a play still pending', async () => {
      service.pause();
      audio.deferPlay();
      service.play();
      // The element has not started yet: the intent is to play while
      // `$isPlaying` is still false, as happens while a track buffers.
      expect(service.$isPlaying()).toBe(false);

      service.removeFromQueue(0);

      expect(service.$stream()?.videoId).toBe('v2');
      expect(audio.src).toContain('v2');
      audio.resolvePlay();
      await Promise.resolve();
      expect(service.$isPlaying()).toBe(true);
    });

    it('stops when the last entry is removed', () => {
      service.removeFromQueue(2);
      service.removeFromQueue(1);
      service.removeFromQueue(0);
      expect(service.$queue()).toEqual([]);
      expect(service.$isPlaying()).toBe(false);
      expect(service.$stream()).toBeNull();
    });

    it('ignores an out-of-range removal', () => {
      service.removeFromQueue(5);
      expect(ids()).toEqual(['id1', 'id2', 'id3']);
    });

    it('empties the queue on request', () => {
      service.clearQueue();
      expect(service.$queue()).toEqual([]);
      expect(service.$currentIndex()).toBe(-1);
      expect(service.$isPlaying()).toBe(false);
      expect(service.$stream()).toBeNull();
    });

    it('makes the edited order the canonical one, so shuffle off restores it', () => {
      service.moveInQueue(2, 0);
      expect(ids()).toEqual(['id3', 'id1', 'id2']);

      service.toggleShuffle();
      expect(service.$isShuffle()).toBe(true);

      service.toggleShuffle();
      expect(ids()).toEqual(['id3', 'id1', 'id2']);
    });

    it('persists the edited order', () => {
      vi.useFakeTimers();
      try {
        // [id1, id2, id3] -> move the first to the end -> [id2, id3, id1]
        service.moveInQueue(0, 2);
        // ... and drop the head, which is what the trash button does.
        service.removeFromQueue(0);
        TestBed.tick();
        vi.advanceTimersByTime(600);

        const queue = storedState()?.['queue'] as QueueItem[];
        expect(queue.map((item) => item.id)).toEqual(['id3', 'id1']);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('stream errors', () => {
    it('surfaces the message and skips to the next track', () => {
      service.playQueue([A, B, C], 0);
      audio.fireError('network down');

      expect(service.$error()).toBe('network down');
      expect(service.$currentIndex()).toBe(1);
    });

    it('skips each failing track only once', () => {
      service.playQueue([A, B], 0);
      audio.fireError('boom');
      expect(service.$currentIndex()).toBe(1);

      // Second error is on a different track, so it is skipped too and the
      // queue wraps around.
      audio.fireError('boom otra vez');
      expect(service.$currentIndex()).toBe(0);
    });

    it('keeps the message while the next track loads and clears it on canplay', () => {
      service.playQueue([A, B], 0);
      audio.fireError('network down');
      expect(service.$error()).toBe('network down');

      audio.fireCanPlay();
      expect(service.$error()).toBeNull();
    });

    it('gives up after consecutive failures', () => {
      // Five distinct entries: a repeated entry is not retried, so it would
      // never reach the cap.
      service.playQueue([1, 2, 3, 4, 5].map(track), 0);
      for (let i = 0; i < 4; i++) {
        audio.fireError('boom');
      }

      expect(service.$error()).toContain('Varias pistas');
      expect(service.$isPlaying()).toBe(false);
    });

    it('clears the message on request', () => {
      service.playQueue([A, B], 0);
      audio.fireError('boom');
      service.clearError();
      expect(service.$error()).toBeNull();
    });

    it('resets the counter after a track plays', () => {
      service.playQueue([A, B, C], 0);
      audio.fireError('boom');
      expect(service.$currentIndex()).toBe(1);

      audio.fireCanPlay();
      audio.fireError('boom');
      expect(service.$currentIndex()).toBe(2);
    });
  });
});

describe('PlaybackService session restore', () => {
  let service: PlaybackService;
  let audio: FakeAudioElement;

  function build(): void {
    const factory = createFakeAudioFactory();
    audio = factory();

    TestBed.configureTestingModule({
      providers: [
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });
    service = TestBed.inject(PlaybackService);
  }

  function seed(overrides: Record<string, unknown> = {}): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: PLAYBACK_STATE_VERSION,
        queue: [
          { id: 'a', videoId: 'v1', name: 'One', artist: 'Artist', duration: 100 },
          { id: 'b', videoId: 'v2', name: 'Two', artist: 'Artist', duration: '3:45' },
        ],
        currentIndex: 1,
        position: 30,
        volume: 0.4,
        muted: false,
        rate: 1.5,
        shuffle: true,
        repeat: 'one',
        sourceTitle: 'Mi álbum',
        savedAt: 1,
        ...overrides,
      }),
    );
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('starts empty when there is nothing saved', () => {
    build();
    expect(service.$queue()).toEqual([]);
    expect(service.$currentIndex()).toBe(-1);
  });

  it('ignores a corrupted snapshot', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    build();
    expect(service.$queue()).toEqual([]);
  });

  it('rebuilds queue, index, title and modes', () => {
    seed();
    build();

    expect(service.$queue().map((item) => item.videoId)).toEqual(['v1', 'v2']);
    // String duration normalized on the way in.
    expect(service.$queue()[1].duration).toBe(225);
    expect(service.$currentIndex()).toBe(1);
    expect(service.$sourceTitle()).toBe('Mi álbum');
    expect(service.$isShuffle()).toBe(true);
    expect(service.$repeatMode()).toBe('one');
    expect(service.$volume()).toBe(0.4);
    expect(service.$playbackRate()).toBe(1.5);
  });

  it('loads the track without starting playback', () => {
    seed();
    build();

    expect(service.$stream()?.videoId).toBe('v2');
    expect(audio.playCalls).toBe(0);
    expect(service.$isPlaying()).toBe(false);
  });

  it('applies the saved position once the duration is known', () => {
    seed();
    build();

    audio.setDuration(225);
    expect(audio.currentTime).toBe(30);
    expect(service.$currentTime()).toBe(30);

    // The pending position is applied only once.
    audio.setDuration(225);
    expect(audio.currentTime).toBe(30);
  });

  it('mutes when the snapshot was muted', () => {
    seed({ muted: true });
    build();

    expect(service.$isMuted()).toBe(true);
    expect(service.$volume()).toBe(0);
  });

  it('plays from the restored position', () => {
    seed();
    build();
    audio.setDuration(225);

    service.play();

    expect(audio.currentTime).toBe(30);
    expect(service.$isPlaying()).toBe(true);
  });

  it('a track change discards the restored position', () => {
    seed({ currentIndex: 1, position: 30 });
    build();
    audio.setDuration(225);
    expect(audio.currentTime).toBe(30);

    service.playQueue([{ id: 'c', videoId: 'v9', name: 'Nine', duration: 10 }], 0);
    expect(audio.currentTime).toBe(0);
  });

  it('saves the session and restores it in a new instance', () => {
    vi.useFakeTimers();
    build();

    service.playQueue([track(1), track(2), track(3)], 1, 'Mix');
    service.setVolume(0.3);
    service.setRate(1.25);

    // Run the persistence effect and let the store debounce elapse.
    TestBed.tick();
    vi.advanceTimersByTime(600);

    const saved = storedState();
    expect(saved).not.toBeNull();
    expect(saved!['sourceTitle']).toBe('Mix');
    expect(saved!['volume']).toBe(0.3);
    expect(saved!['rate']).toBe(1.25);
    expect(saved!['currentIndex']).toBe(1);
    expect((saved!['queue'] as unknown[]).length).toBe(3);

    // A fresh instance over the same storage comes back with the session.
    TestBed.resetTestingModule();
    const factory = createFakeAudioFactory();
    TestBed.configureTestingModule({
      providers: [
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });
    const restored = TestBed.inject(PlaybackService);

    expect(restored.$sourceTitle()).toBe('Mix');
    expect(restored.$currentIndex()).toBe(1);
    expect(restored.$volume()).toBe(0.3);
    expect(restored.$playbackRate()).toBe(1.25);
    expect(restored.$isShuffle()).toBe(false);
    expect(restored.$queue().map((item) => item.videoId)).toEqual(['v1', 'v2', 'v3']);
  });

  it('persists the shuffle and repeat modes', () => {
    vi.useFakeTimers();
    build();

    service.playQueue([track(1), track(2)], 0);
    service.toggleShuffle();
    service.toggleRepeat();
    TestBed.tick();
    vi.advanceTimersByTime(600);

    expect(storedState()?.['shuffle']).toBe(true);
    expect(storedState()?.['repeat']).toBe('one');
  });

  it('clearPersistedState forgets the session', () => {
    seed();
    build();

    service.clearPersistedState();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    build();
    expect(service.$queue()).toEqual([]);
  });
});

describe('parseDuration', () => {
  it('keeps finite numbers', () => {
    expect(parseDuration(120)).toBe(120);
    expect(parseDuration(Number.NaN)).toBeUndefined();
  });

  it('parses numeric strings', () => {
    expect(parseDuration('120')).toBe(120);
  });

  it('parses m:ss and h:mm:ss', () => {
    expect(parseDuration('3:45')).toBe(225);
    expect(parseDuration('1:02:03')).toBe(3723);
  });

  it('rejects garbage', () => {
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration('abc')).toBeUndefined();
    expect(parseDuration(null)).toBeUndefined();
    expect(parseDuration('3:xx')).toBeUndefined();
  });
});
