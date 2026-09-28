import type { QueueItem } from '../models/queue.model';

/**
 * Doble de `HTMLAudioElement` para tests.
 *
 * El `PlaybackService` es dueño del elemento de audio, así que sin un doble las
 * pruebas dependerían de jsdom (que no decodifica, no tiene `duration` real y su
 * `play()` no dispara eventos). Este doble implementa lo justo: almacena el
 * estado, dispara los eventos que el servicio escucha y permite provocar `error`
 * o `ended` a demanda.
 */
export class FakeAudioElement {
  public src = '';
  public currentTime = 0;
  public duration = Number.NaN;
  public volume = 1;
  public muted = false;
  public paused = true;
  public playbackRate = 1;
  public preservesPitch = true;
  public preload = 'none';
  public crossOrigin: string | null = null;
  public ended = false;
  public error: { code: number; message: string } | null = null;

  /** `setSinkId` es asíncrono y falla con `NotAllowedError` en algunos entornos. */
  public sinkIdValue = '';
  public setSinkIdCalls: string[] = [];
  public setSinkIdError: string | null = null;

  public playCalls = 0;
  public pauseCalls = 0;

  private _playDeferred = false;
  private _resolvePlay: (() => void) | null = null;

  private readonly _listeners = new Map<string, Set<(event: Event) => void>>();

  public addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const key = type;
    const set = this._listeners.get(key) ?? new Set();
    set.add(listener as (event: Event) => void);
    this._listeners.set(key, set);
  }

  public removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this._listeners.get(type)?.delete(listener as (event: Event) => void);
  }

  public play(): Promise<void> {
    this.playCalls++;
    this.paused = false;
    if (this._playDeferred) {
      // A real element resolves `play()` only when it actually starts, which is
      // after the data arrives. The service sees the intent before the state.
      return new Promise<void>((resolve) => (this._resolvePlay = resolve));
    }
    // Only `play`: a real element emits `playing` once data is available, which
    // after a network error never happens. Tests trigger it on demand.
    this.emit('play');
    return Promise.resolve();
  }

  /**
   * Leaves the next `play()` pending, like a track that is still buffering. The
   * service then has the intention to play without reporting that it is playing.
   */
  public deferPlay(): void {
    this._playDeferred = true;
  }

  /** Ends a `deferPlay()`: the element starts and the promise resolves. */
  public resolvePlay(): void {
    this._playDeferred = false;
    this._resolvePlay?.();
    this._resolvePlay = null;
    this.emit('play');
  }

  public pause(): void {
    this.pauseCalls++;
    if (this.paused) return;
    this.paused = true;
    this.emit('pause');
  }

  public load(): void {
    // A real element drops the previous resource on `load()`.
    this.currentTime = 0;
    this.ended = false;
  }

  /** The service detaches the source on `stop()` and on destroy. */
  public removeAttribute(name: string): void {
    if (name === 'src') {
      this.src = '';
    }
  }

  public async setSinkId(sinkId: string): Promise<void> {
    this.setSinkIdCalls.push(sinkId);
    if (this.setSinkIdError) {
      const error = new Error(this.setSinkIdError) as Error & { name: string };
      error.name = this.setSinkIdError;
      throw error;
    }
    this.sinkIdValue = sinkId;
  }

  public emit(type: string, detail: Record<string, unknown> = {}): void {
    const event = { type, target: this, ...detail } as unknown as Event;
    for (const listener of this._listeners.get(type) ?? []) {
      listener(event);
    }
  }

  // --- Utilidades para los tests -------------------------------------------

  /** Simula que el navegador ya conoce la duración de la pista. */
  public setDuration(seconds: number): void {
    this.duration = seconds;
    this.emit('loadedmetadata');
    this.emit('durationchange');
  }

  /** Avanza el reloj como lo haría `timeupdate` (~4 Hz en un navegador real). */
  public tick(seconds: number): void {
    this.currentTime = seconds;
    this.emit('timeupdate');
  }

  /** Dispara `canplay`, momento en el que el servicio autoarranca si toca. */
  public fireCanPlay(): void {
    this.emit('canplay');
  }

  /** Data started flowing: what a real element emits once it has audio. */
  public firePlaying(): void {
    this.emit('playing');
  }

  public fireWaiting(): void {
    this.emit('waiting');
  }

  public fireEnded(): void {
    this.ended = true;
    this.paused = true;
    this.emit('ended');
  }

  public fireError(message = 'fallo de red'): void {
    this.error = { code: 4, message };
    this.paused = true;
    this.emit('error');
  }
}

/**
 * Constructor fake que devuelve siempre el mismo doble, para inyectarlo en el
 * `PlaybackService` desde `TestBed`.
 */
export function createFakeAudioFactory(): () => FakeAudioElement {
  const element = new FakeAudioElement();
  return () => element;
}

let fakeId = 0;

/** Cola mínima para tests, con `id` único como exige `QueueItem`. */
export function makeQueueItem(name: string, videoId = name): QueueItem {
  return { id: `f${++fakeId}`, videoId, name, artist: 'Artista' };
}
