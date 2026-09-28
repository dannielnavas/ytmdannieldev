import { DestroyRef, Service, effect, inject, signal, untracked } from '@angular/core';
import { PlaybackService } from './playback.service';

/** Bins requested from the analyser: power of two, per the Web Audio spec. */
const FFT_SIZE = 2048;

/** Bars drawn across the canvas. Fewer bars than bins: the top of the
 *  spectrum is mostly inaudible, and drawing it only adds noise. */
const BAR_COUNT = 48;

/** Peak hold decay per frame, so a bar falls instead of snapping to zero. */
const DECAY = 0.86;

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Real-time spectrum behind the artwork.
 *
 * This replaces the WaveSurfer instance that used to live in `now-playing`:
 * WaveSurfer drew a pre-computed waveform of the decoded audio, which meant a
 * second decode of the same stream and nothing at all for a track that could not
 * be fetched in advance. An `AnalyserNode` on the element that is already
 * playing shows what is actually coming out of the speakers.
 *
 * The `AudioContext` is created lazily, on the first attach, because browsers
 * refuse to start one outside a user gesture; a context created too early stays
 * `suspended` and the spectrum would be flat forever.
 */
@Service()
export class AudioVisualizerService {
  private readonly _playback = inject(PlaybackService);
  private readonly _destroyRef = inject(DestroyRef);

  private _canvas: HTMLCanvasElement | null = null;
  private _context: AudioContext | null = null;
  private _analyser: AnalyserNode | null = null;
  private _source: MediaElementAudioSourceNode | null = null;
  private _frame = 0;
  private _data: Uint8Array<ArrayBuffer> | null = null;
  private _peaks = new Float32Array(BAR_COUNT);

  /** True once the graph is running, so the view can hide a useless canvas. */
  public readonly $active = signal(false);

  public constructor() {
    // Keep the loop in step with playback: running it while paused would burn
    // a frame per second for a flat line.
    effect(() => {
      const playing = this._playback.$isPlaying();
      untracked(() => (playing ? this.start() : this.stop()));
    });

    this._destroyRef.onDestroy(() => this.dispose());
  }

  /**
   * Connects the analyser and starts drawing into the given canvas.
   *
   * Safe to call again with the same canvas, and with a different one: the
   * media element can only ever be connected to one source node, so the graph
   * is built once and only the drawing target changes.
   */
  public attach(canvas: HTMLCanvasElement): void {
    this._canvas = canvas;
    if (!this._connect()) return;
    this.$active.set(true);
    this.start();
  }

  /** Stops drawing but keeps the graph, so re-attaching is instant. */
  public detach(): void {
    this._canvas = null;
    this.stop();
  }

  public start(): void {
    if (this._frame !== 0 || !this.$active() || !this._canvas) return;
    this._frame = requestAnimationFrame(this._draw);
  }

  public stop(): void {
    if (this._frame === 0) return;
    cancelAnimationFrame(this._frame);
    this._frame = 0;
  }

  /** Releases the audio graph. Only meaningful when the app goes away. */
  public dispose(): void {
    this.stop();
    this.detach();
    this._source?.disconnect();
    this._analyser?.disconnect();
    this._analyser = null;
    this._source = null;
    void this._context?.close().catch(() => undefined);
    this._context = null;
    this._canvas = null;
    this.$active.set(false);
  }

  private _connect(): boolean {
    if (this._analyser) return true;

    const ContextCtor =
      globalThis.AudioContext ?? (globalThis as unknown as WebkitWindow).webkitAudioContext ?? null;
    // jsdom and any environment without Web Audio simply get no visualizer.
    if (!ContextCtor) return false;

    try {
      this._context = new ContextCtor();
      this._analyser = this._context.createAnalyser();
      this._analyser.fftSize = FFT_SIZE;
      // The stream is cross-origin, and a tainted buffer would silence the
      // whole graph. `electron/main.ts` adds the CORS header for the API.
      this._analyser.smoothingTimeConstant = 0.8;
      this._source = this._context.createMediaElementSource(this._playback.element());
      this._source.connect(this._analyser);
      // Without this the audio stops being audible: a media element source that
      // is not connected to the destination plays nothing.
      this._analyser.connect(this._context.destination);
      this._data = new Uint8Array(new ArrayBuffer(this._analyser.frequencyBinCount));
    } catch {
      // A context can only be created once per element; if the browser refuses,
      // playback must continue without the visualizer.
      this._context = null;
      this._analyser = null;
      this._source = null;
      return false;
    }

    return true;
  }

  private _draw = (): void => {
    this._frame = 0;
    const canvas = this._canvas;
    const analyser = this._analyser;
    const data = this._data;
    if (!canvas || !analyser || !data) return;

    this._frame = requestAnimationFrame(this._draw);

    // A context created outside a gesture stays suspended until it is resumed.
    if (this._context?.state === 'suspended') {
      void this._context.resume().catch(() => undefined);
    }

    analyser.getByteFrequencyData(data);
    this._render(canvas, data);
  };

  private _render(canvas: HTMLCanvasElement, data: Uint8Array): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The canvas is sized by CSS, so the backing store has to follow the real
    // size and the device pixel ratio to stay sharp.
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const gap = 2 * ratio;
    const barWidth = Math.max(1, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
    // Only the lower part of the spectrum carries anything worth drawing.
    const usable = Math.floor(data.length * 0.55);

    for (let i = 0; i < BAR_COUNT; i++) {
      // Logarithmic spacing: linear buckets would leave the right half flat.
      const from = Math.floor(Math.pow(i / BAR_COUNT, 1.6) * usable);
      const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / BAR_COUNT, 1.6) * usable));

      let sum = 0;
      for (let j = from; j < to; j++) sum += data[j];
      const level = Math.min(1, sum / ((to - from) * 255));

      this._peaks[i] = Math.max(level, this._peaks[i] * DECAY);

      const barHeight = Math.max(ratio, this._peaks[i] * height);
      const x = i * (barWidth + gap);
      const y = height - barHeight;

      const gradient = ctx.createLinearGradient(0, height, 0, y);
      gradient.addColorStop(0, 'rgba(147, 51, 234, 0.35)');
      gradient.addColorStop(1, 'rgba(216, 180, 254, 0.95)');
      ctx.fillStyle = gradient;

      // Rounded bars read better than plain rectangles at this size.
      const radius = Math.min(barWidth / 2, 2 * ratio);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();
    }
  }
}
