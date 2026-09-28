import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MediaSessionService } from './media-session.service';
import { PlaybackService } from './playback.service';
import { AUDIO_FACTORY } from './audio-factory';
import { FakeAudioElement, createFakeAudioFactory } from '../testing/fake-audio-element';
import { QueueItem } from '../models/queue.model';

type Handler = ((details: MediaSessionActionDetails) => void) | null;

function item(n: number): QueueItem {
  return {
    id: `id${n}`,
    videoId: `v${n}`,
    name: `Song ${n}`,
    artist: 'Artist',
    duration: 200,
    thumbnail: `https://i.ytimg.com/vi/v${n}/hqdefault.jpg`,
  };
}

/** Minimal stand-in for the Chromium implementation. */
function installMediaSession(): {
  actions: Map<string, Handler>;
  setPositionState: ReturnType<typeof vi.fn>;
  playbackState: () => string;
  metadata: () => MediaMetadata | null;
} {
  const actions = new Map<string, Handler>();
  const state = { playbackState: 'none', metadata: null as MediaMetadata | null };
  const setPositionState = vi.fn();

  (navigator as unknown as Record<string, unknown>)['mediaSession'] = {
    playbackState: 'none',
    metadata: null,
    setActionHandler: (action: string, handler: Handler) => actions.set(action, handler),
    setPositionState,
  };

  return {
    actions,
    setPositionState,
    playbackState: () => state.playbackState,
    metadata: () => state.metadata,
  };
}

function readSession(): {
  playbackState: string;
  metadata: MediaMetadata | null;
  setActionHandler: (a: string, h: Handler) => void;
  setPositionState: (s: MediaPositionState) => void;
} {
  return (navigator as unknown as Record<string, unknown>)['mediaSession'] as never;
}

function readMetadata(): MediaMetadata | null {
  return readSession().metadata;
}

function readState(): string {
  return readSession().playbackState;
}

describe('MediaSessionService', () => {
  let playback: PlaybackService;
  let audio: FakeAudioElement;
  let actions: Map<string, Handler>;
  let setPositionState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const session = installMediaSession();
    actions = session.actions;
    setPositionState = session.setPositionState;

    const factory = createFakeAudioFactory();
    audio = factory();

    TestBed.configureTestingModule({
      providers: [
        MediaSessionService,
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });

    playback = TestBed.inject(PlaybackService);
    TestBed.inject(MediaSessionService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('registers the transport actions', () => {
    expect(actions.has('play')).toBe(true);
    expect(actions.has('pause')).toBe(true);
    expect(actions.has('stop')).toBe(true);
    expect(actions.has('previoustrack')).toBe(true);
    expect(actions.has('nexttrack')).toBe(true);
    expect(actions.has('seekbackward')).toBe(true);
    expect(actions.has('seekforward')).toBe(true);
    expect(actions.has('seekto')).toBe(true);
  });

  it('routes the OS controls to the service', () => {
    playback.playQueue([item(1), item(2), item(3)], 0);
    audio.setDuration(200);
    audio.tick(50);

    actions.get('pause')!({} as MediaSessionActionDetails);
    expect(playback.$isPlaying()).toBe(false);

    actions.get('play')!({} as MediaSessionActionDetails);
    expect(playback.$isPlaying()).toBe(true);

    actions.get('nexttrack')!({} as MediaSessionActionDetails);
    expect(playback.$currentIndex()).toBe(1);

    actions.get('previoustrack')!({} as MediaSessionActionDetails);
    expect(playback.$currentIndex()).toBe(0);
  });

  it('honours the seek offsets of the platform', () => {
    playback.playQueue([item(1)], 0);
    audio.setDuration(200);
    audio.tick(50);

    actions.get('seekforward')!({ seekOffset: 15 } as MediaSessionActionDetails);
    expect(audio.currentTime).toBe(65);

    actions.get('seekbackward')!({ seekOffset: 5 } as MediaSessionActionDetails);
    expect(audio.currentTime).toBe(60);

    actions.get('seekforward')!({} as MediaSessionActionDetails);
    expect(audio.currentTime).toBe(70);

    actions.get('seekto')!({ seekTime: 30 } as MediaSessionActionDetails);
    expect(audio.currentTime).toBe(30);
  });

  it('ignores a seekto without a time', () => {
    playback.playQueue([item(1)], 0);
    audio.setDuration(200);
    audio.tick(50);

    actions.get('seekto')!({} as MediaSessionActionDetails);
    expect(audio.currentTime).toBe(50);
  });

  it('publishes the metadata of the track', () => {
    playback.playQueue([item(1), item(2)], 1, 'Mi álbum');
    TestBed.tick();

    const metadata = readMetadata();
    expect(metadata?.title).toBe('Song 2');
    expect(metadata?.artist).toBe('Artist');
    expect(metadata?.album).toBe('Mi álbum');
    expect(metadata?.artwork?.length).toBe(2);
  });

  it('clears the metadata when the queue is emptied', () => {
    playback.playQueue([item(1)], 0);
    TestBed.tick();
    expect(readMetadata()).not.toBeNull();

    playback.stop();
    TestBed.tick();
    expect(readMetadata()).toBeNull();
  });

  it('mirrors the playback state', () => {
    playback.playQueue([item(1)], 0);
    TestBed.tick();
    expect(readState()).toBe('playing');

    playback.pause();
    TestBed.tick();
    expect(readState()).toBe('paused');

    playback.stop();
    TestBed.tick();
    expect(readState()).toBe('none');
  });

  it('publishes the position once the duration is known', () => {
    playback.playQueue([item(1)], 0);
    audio.setDuration(200);
    audio.tick(50);
    TestBed.tick();

    expect(setPositionState).toHaveBeenCalled();
    const state = setPositionState.mock.calls.at(-1)?.[0] as MediaPositionState;
    expect(state.duration).toBe(200);
    expect(state.position).toBe(50);
    expect(state.playbackRate).toBe(1);
  });

  it('does not publish a position without a valid duration', () => {
    // Neither the element nor the queue knows how long the track is, which is
    // the case for a live radio stream.
    playback.playQueue([{ id: 'live', videoId: 'live1', name: 'Live', artist: 'Radio' }], 0);
    TestBed.tick();

    expect(setPositionState).not.toHaveBeenCalled();
  });

  it('never publishes a position outside the duration', () => {
    playback.playQueue([item(1)], 0);
    audio.setDuration(60);
    // The element reports a position beyond the metadata, which happens when
    // the stream ends or when a live radio stream has no real duration.
    audio.tick(90);
    TestBed.tick();

    const state = setPositionState.mock.calls.at(-1)?.[0] as MediaPositionState;
    expect(state.position).toBeLessThanOrEqual(state.duration ?? Infinity);
  });

  it('reports the playback rate', () => {
    playback.playQueue([item(1)], 0);
    audio.setDuration(200);
    playback.setRate(1.5);
    TestBed.tick();

    const state = setPositionState.mock.calls.at(-1)?.[0] as MediaPositionState;
    expect(state.playbackRate).toBe(1.5);
  });
});
