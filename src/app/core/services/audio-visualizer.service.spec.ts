import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AudioVisualizerService } from './audio-visualizer.service';
import { PlaybackService } from './playback.service';
import { AUDIO_FACTORY } from './audio-factory';
import { createFakeAudioFactory } from '../testing/fake-audio-element';

type AnyRecord = Record<string, any>;

/** The fakes are index-signature records, so every access has to be dynamic. */
const dyn = (record: AnyRecord, key: string): any => record[key];

const setAudioContext = (value: unknown): void => {
  Object.assign(globalThis as AnyRecord, { AudioContext: value });
};

const unsetAudioContext = (): void => {
  Reflect.deleteProperty(globalThis as AnyRecord, 'AudioContext');
};

interface FakeGraph {
  context: AnyRecord;
  analyser: AnyRecord;
  source: AnyRecord;
  destinations: string[];
}

function installAudioContext(graph?: Partial<FakeGraph>): FakeGraph {
  const state: FakeGraph = {
    context: { state: 'running', resume: vi.fn().mockResolvedValue(undefined) },
    analyser: {
      fftSize: 0,
      smoothingTimeConstant: 0,
      frequencyBinCount: 1024,
      getByteFrequencyData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    source: { connect: vi.fn(), disconnect: vi.fn() },
    destinations: [],
    ...graph,
  };

  const context = {
    ...state.context,
    destination: { id: 'destination' },
    createAnalyser: () => {
      Object.assign(state.analyser, {
        connect: vi.fn((node: AnyRecord) => {
          state.destinations.push(node === context.destination ? 'destination' : 'analyser');
        }),
      });
      return state.analyser;
    },
    createMediaElementSource: vi.fn((element: AnyRecord) => {
      Object.assign(state.source, { element });
      return state.source;
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  state.context = context;

  // The service calls `new AudioContext()`, and a plain object is not a
  // constructor: a function that returns the instance stands in for one.
  const FakeAudioContext = function FakeAudioContext() {
    return context;
  };
  setAudioContext(FakeAudioContext);
  return state;
}

function removeAudioContext(): void {
  unsetAudioContext();
}

describe('AudioVisualizerService', () => {
  let service: AudioVisualizerService;
  let playback: PlaybackService;
  let canvas: HTMLCanvasElement;
  let raf: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    const factory = createFakeAudioFactory();

    TestBed.configureTestingModule({
      providers: [
        AudioVisualizerService,
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });

    service = TestBed.inject(AudioVisualizerService);
    playback = TestBed.inject(PlaybackService);
    canvas = document.createElement('canvas');

    // The loop is driven by hand: a real rAF would keep the test alive.
    raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    unsetAudioContext();
    localStorage.clear();
  });

  it('does nothing when Web Audio is missing', () => {
    unsetAudioContext();

    service.attach(canvas);

    expect(service.$active()).toBe(false);
    expect(raf).not.toHaveBeenCalled();
  });

  it('connects the element to the analyser and to the destination', () => {
    const graph = installAudioContext();

    service.attach(canvas);

    expect(service.$active()).toBe(true);
    // Connecting only the analyser would silence the audio.
    expect(graph['destinations']).toContain('destination');
    expect(dyn(graph.analyser, 'fftSize')).toBe(2048);
    expect(dyn(graph.source, 'element')).toBe(playback.element());
  });

  it('draws a frame per animation frame while playing', () => {
    installAudioContext();
    service.attach(canvas);

    playback.playQueue(
      [
        { id: 'a', videoId: 'v1', name: 'One', artist: 'A', duration: 100 },
        { id: 'b', videoId: 'v2', name: 'Two', artist: 'A', duration: 100 },
      ],
      0,
    );
    TestBed.tick();

    expect(raf).toHaveBeenCalled();
  });

  it('stops the loop when playback pauses', () => {
    installAudioContext();
    service.attach(canvas);

    playback.playQueue([{ id: 'a', videoId: 'v1', name: 'One', artist: 'A', duration: 100 }], 0);
    TestBed.tick();
    const cancel = globalThis.cancelAnimationFrame as unknown as ReturnType<typeof vi.fn>;

    playback.pause();
    TestBed.tick();

    expect(cancel).toHaveBeenCalled();
  });

  it('reuses the graph when the canvas is swapped', () => {
    const graph = installAudioContext();
    service.attach(canvas);
    service.attach(document.createElement('canvas'));

    expect(dyn(graph.context, 'createMediaElementSource')).toHaveBeenCalledTimes(1);
  });

  it('survives a browser that refuses the context', () => {
    const broken = vi.fn(() => {
      throw new Error('no');
    });
    const Broken = function Broken() {
      return {
        createAnalyser: broken,
        createMediaElementSource: broken,
        destination: {},
      };
    };
    setAudioContext(Broken);

    service.attach(canvas);

    expect(service.$active()).toBe(false);
  });

  it('resumes a context that is still suspended', () => {
    const graph = installAudioContext();
    Object.assign(graph.context, { state: 'suspended' });
    service.attach(canvas);

    expect(dyn(graph.context, 'resume')).not.toHaveBeenCalled();
  });

  it('closes the context on dispose', () => {
    const graph = installAudioContext();
    service.attach(canvas);

    service.dispose();

    expect(dyn(graph.context, 'close')).toHaveBeenCalled();
    expect(service.$active()).toBe(false);
  });

  it('forgets the canvas on detach', () => {
    installAudioContext();
    service.attach(canvas);

    service.detach();
    expect(service.$active()).toBe(true);

    // Re-attaching must not require a second media element source.
    expect(() => service.attach(document.createElement('canvas'))).not.toThrow();
  });
});
