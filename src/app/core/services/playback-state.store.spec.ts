import { TestBed } from '@angular/core/testing';
import { PlaybackStateStore, PLAYBACK_STATE_VERSION } from './playback-state.store';
import { PersistedQueueItem } from '../models/queue.model';

const QUEUE: PersistedQueueItem[] = [
  { id: 'a', videoId: 'v1', name: 'One', artist: 'Artist', duration: 120 },
  { id: 'b', videoId: 'v2', name: 'Two', artist: 'Artist', duration: '3:45' },
];

function state(overrides: Partial<Parameters<PlaybackStateStore['save']>[0]> = {}) {
  return {
    version: PLAYBACK_STATE_VERSION,
    queue: QUEUE,
    currentIndex: 1,
    position: 42,
    volume: 0.6,
    muted: false,
    rate: 1.25,
    shuffle: true,
    repeat: 'one' as const,
    sourceTitle: 'Mi álbum',
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('PlaybackStateStore', () => {
  let store: PlaybackStateStore;

  beforeEach(() => {
    localStorage.clear();
    // Built in an injection context so the store can hook the `DestroyRef`.
    TestBed.configureTestingModule({ providers: [PlaybackStateStore] });
    store = TestBed.inject(PlaybackStateStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('load', () => {
    it('returns null when nothing was saved', () => {
      expect(store.load()).toBeNull();
    });

    it('round-trips a valid snapshot', () => {
      store.save(state());
      store.flush();

      expect(store.load()).toEqual(state());
    });

    it('keeps a string duration for the service to normalize', () => {
      store.save(state());
      store.flush();

      expect(store.load()?.queue[1].duration).toBe('3:45');
    });

    it('discards a snapshot from another version', () => {
      localStorage.setItem('sonara.playback-state.v1', JSON.stringify(state({ version: 99 })));

      expect(store.load()).toBeNull();
      expect(localStorage.getItem('sonara.playback-state.v1')).toBeNull();
    });

    it('discards malformed JSON', () => {
      localStorage.setItem('sonara.playback-state.v1', '{not json');

      expect(store.load()).toBeNull();
    });

    it('discards a snapshot without a queue', () => {
      localStorage.setItem('sonara.playback-state.v1', JSON.stringify(state({ queue: [] })));

      expect(store.load()).toBeNull();
    });

    it('discards a queue with no playable entry', () => {
      localStorage.setItem(
        'sonara.playback-state.v1',
        JSON.stringify(state({ queue: [{ name: 'Sin videoId' }] })),
      );

      expect(store.load()).toBeNull();
    });

    it('clamps out-of-range values instead of applying them', () => {
      localStorage.setItem(
        'sonara.playback-state.v1',
        JSON.stringify(
          state({
            currentIndex: 99,
            position: -5,
            volume: 12,
            rate: 40,
            repeat: 'nope' as never,
          }),
        ),
      );

      const loaded = store.load();

      expect(loaded?.currentIndex).toBe(1);
      expect(loaded?.position).toBe(0);
      expect(loaded?.volume).toBe(1);
      expect(loaded?.rate).toBe(2);
      expect(loaded?.repeat).toBe('all');
    });

    it('falls back to defaults for missing fields', () => {
      localStorage.setItem(
        'sonara.playback-state.v1',
        JSON.stringify({ version: PLAYBACK_STATE_VERSION, queue: QUEUE }),
      );

      const loaded = store.load();

      expect(loaded?.volume).toBe(1);
      expect(loaded?.rate).toBe(1);
      expect(loaded?.shuffle).toBe(false);
      expect(loaded?.sourceTitle).toBe('');
    });
  });

  describe('save', () => {
    it('coalesces rapid writes into one', () => {
      vi.useFakeTimers();

      store.save(state({ position: 1 }));
      store.save(state({ position: 2 }));
      store.save(state({ position: 3 }));

      expect(localStorage.getItem('sonara.playback-state.v1')).toBeNull();

      vi.advanceTimersByTime(500);

      expect(JSON.parse(localStorage.getItem('sonara.playback-state.v1')!).position).toBe(3);
    });

    it('writes the latest snapshot after a new debounce window', () => {
      vi.useFakeTimers();

      store.save(state({ position: 1 }));
      vi.advanceTimersByTime(500);
      store.save(state({ position: 2 }));
      vi.advanceTimersByTime(500);

      expect(JSON.parse(localStorage.getItem('sonara.playback-state.v1')!).position).toBe(2);
    });

    it('flush writes immediately', () => {
      store.save(state({ position: 7 }));
      store.flush();

      expect(JSON.parse(localStorage.getItem('sonara.playback-state.v1')!).position).toBe(7);
    });

    it('flush without a pending write does nothing', () => {
      store.flush();
      expect(localStorage.getItem('sonara.playback-state.v1')).toBeNull();
    });

    it('a pending debounce is cancelled by flush', () => {
      vi.useFakeTimers();

      store.save(state({ position: 1 }));
      store.flush();
      vi.advanceTimersByTime(1000);

      expect(JSON.parse(localStorage.getItem('sonara.playback-state.v1')!).position).toBe(1);
    });

    it('clear removes the snapshot and the pending write', () => {
      vi.useFakeTimers();

      store.save(state());
      store.flush();
      store.clear();

      expect(localStorage.getItem('sonara.playback-state.v1')).toBeNull();

      store.save(state({ position: 9 }));
      store.clear();
      vi.advanceTimersByTime(1000);

      expect(localStorage.getItem('sonara.playback-state.v1')).toBeNull();
    });

    it('survives a storage that throws', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });

      expect(() => {
        store.save(state());
        store.flush();
      }).not.toThrow();

      setItem.mockRestore();
    });
  });
});
