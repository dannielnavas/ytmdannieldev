import { DestroyRef, Service, effect, inject, signal, untracked } from '@angular/core';
import { PlaybackService } from './playback.service';

/** Bins requested from the analyser: power of two, per the Web Audio spec. */
const FFT_SIZE = 2048;

/** Points sampled across the audio wave curve. */
const POINT_COUNT = 44;

/** Peak hold decay per frame: snappier drop for noticeable, rhythmic movement. */
const DECAY = 0.78;

export type VisualizerStyle = 'waves' | 'bars' | 'mirror' | 'pulse';

export const VISUALIZER_STYLES: { id: VisualizerStyle; label: string }[] = [
  { id: 'waves', label: 'Ondas' },
  { id: 'bars', label: 'Barras' },
  { id: 'mirror', label: 'Espejo' },
  { id: 'pulse', label: 'Pulso' },
];

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
  private _peaks = new Float32Array(POINT_COUNT);
  private _rgb: [number, number, number] = [168, 85, 247];

  /** True once the graph is running, so the view can hide a useless canvas. */
  public readonly $active = signal(false);

  /** Active visualizer style: waves, bars, mirror, or pulse. */
  public readonly $style = signal<VisualizerStyle>(this._loadStyle());

  /** Updates the color palette of the wave from the album artwork dominant color. */
  public setColor(rgb: [number, number, number] | null): void {
    this._rgb = rgb ?? [168, 85, 247];
  }

  public setStyle(style: VisualizerStyle): void {
    this.$style.set(style);
    try {
      localStorage.setItem('sonara.visualizer-style', style);
    } catch {
      // Ignorar en entornos sin localStorage
    }
  }

  public cycleStyle(): VisualizerStyle {
    const current = this.$style();
    const idx = VISUALIZER_STYLES.findIndex((s) => s.id === current);
    const next = VISUALIZER_STYLES[(idx + 1) % VISUALIZER_STYLES.length].id;
    this.setStyle(next);
    return next;
  }

  private _loadStyle(): VisualizerStyle {
    try {
      const saved = localStorage.getItem('sonara.visualizer-style');
      if (saved === 'waves' || saved === 'bars' || saved === 'mirror' || saved === 'pulse') {
        return saved;
      }
    } catch {
      // Ignorar en entornos sin localStorage
    }
    return 'waves';
  }

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
      this._analyser.smoothingTimeConstant = 0.55;
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

    const usable = Math.floor(data.length * 0.65);

    // Compute energetic peak levels across points with dynamic non-linear gain
    for (let i = 0; i < POINT_COUNT; i++) {
      const from = Math.floor(Math.pow(i / POINT_COUNT, 1.4) * usable);
      const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / POINT_COUNT, 1.4) * usable));

      let sum = 0;
      for (let j = from; j < to; j++) sum += data[j];
      const avg = sum / ((to - from) * 255);
      // Non-linear gain boost: amplifies lower and mid frequencies to make movement punchy
      const boosted = Math.min(1, Math.pow(avg * 1.7, 0.82));

      if (boosted > this._peaks[i]) {
        this._peaks[i] = boosted;
      } else {
        this._peaks[i] = Math.max(0, this._peaks[i] * DECAY);
      }
    }

    const [r, g, b] = this._rgb;
    const lightR = Math.min(255, r + 50);
    const lightG = Math.min(255, g + 50);
    const lightB = Math.min(255, b + 50);

    const style = this.$style();
    switch (style) {
      case 'bars':
        this._renderBars(ctx, width, height, ratio, r, g, b, lightR, lightG, lightB);
        break;
      case 'mirror':
        this._renderMirror(ctx, width, height, ratio, r, g, b, lightR, lightG, lightB);
        break;
      case 'pulse':
        this._renderPulse(ctx, width, height, ratio, r, g, b, lightR, lightG, lightB);
        break;
      case 'waves':
      default:
        this._renderWaves(ctx, width, height, ratio, r, g, b, lightR, lightG, lightB);
        break;
    }
  }

  /** Smooth midpoint quadratic Bezier spline curve drawer */
  private _drawSpline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  /** Style 1: Dual-layer smooth glowing Bezier waves */
  private _renderWaves(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    ratio: number,
    r: number,
    g: number,
    b: number,
    lightR: number,
    lightG: number,
    lightB: number,
  ): void {
    const baseY = height - 2 * ratio;
    const maxAmp = height - 4 * ratio;

    // Layer 1: Background harmonic wave
    const points2: { x: number; y: number }[] = [];
    for (let i = 0; i < POINT_COUNT; i++) {
      const taper = Math.sin((i / (POINT_COUNT - 1)) * Math.PI);
      const amp = this._peaks[i] * maxAmp * 0.7 * (0.2 + 0.8 * taper);
      const x = (i / (POINT_COUNT - 1)) * width;
      const y = baseY - Math.max(ratio, amp);
      points2.push({ x, y });
    }

    ctx.save();
    this._drawSpline(ctx, points2);
    ctx.lineTo(width, baseY);
    ctx.lineTo(0, baseY);
    ctx.closePath();
    const grad2 = ctx.createLinearGradient(0, 0, 0, height);
    grad2.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.32)`);
    grad2.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.02)`);
    ctx.fillStyle = grad2;
    ctx.fill();

    this._drawSpline(ctx, points2);
    ctx.strokeStyle = `rgba(${lightR}, ${lightG}, ${lightB}, 0.5)`;
    ctx.lineWidth = 1.6 * ratio;
    ctx.stroke();
    ctx.restore();

    // Layer 2: Main energetic foreground wave
    const points1: { x: number; y: number }[] = [];
    for (let i = 0; i < POINT_COUNT; i++) {
      const taper = Math.sin((i / (POINT_COUNT - 1)) * Math.PI);
      const amp = this._peaks[i] * maxAmp * (0.25 + 0.75 * taper);
      const x = (i / (POINT_COUNT - 1)) * width;
      const y = baseY - Math.max(ratio * 1.5, amp);
      points1.push({ x, y });
    }

    ctx.save();
    this._drawSpline(ctx, points1);
    ctx.lineTo(width, baseY);
    ctx.lineTo(0, baseY);
    ctx.closePath();
    const grad1 = ctx.createLinearGradient(0, 0, 0, height);
    grad1.addColorStop(0, `rgba(${lightR}, ${lightG}, ${lightB}, 0.6)`);
    grad1.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`);
    grad1.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.02)`);
    ctx.fillStyle = grad1;
    ctx.fill();

    // Glowing wave crest stroke
    this._drawSpline(ctx, points1);
    ctx.shadowColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.9)`;
    ctx.shadowBlur = 10 * ratio;
    const strokeGrad = ctx.createLinearGradient(0, 0, width, 0);
    strokeGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
    strokeGrad.addColorStop(0.5, '#ffffff');
    strokeGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.85)`);
    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = 2.4 * ratio;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  /** Style 2: Bouncing spectrum bars with floating glowing caps */
  private _renderBars(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    ratio: number,
    r: number,
    g: number,
    b: number,
    lightR: number,
    lightG: number,
    lightB: number,
  ): void {
    const barCount = 36;
    const baseY = height - 2 * ratio;
    const maxAmp = height - 8 * ratio;
    const totalSlot = width / barCount;
    const barWidth = Math.max(2 * ratio, totalSlot * 0.68);
    const radius = Math.min(barWidth / 2, 4 * ratio);

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const peakIdx = Math.floor((i / barCount) * POINT_COUNT);
      const taper = Math.sin(((i + 0.5) / barCount) * Math.PI);
      const amp = Math.max(3 * ratio, this._peaks[peakIdx] * maxAmp * (0.2 + 0.8 * taper));
      const x = i * totalSlot + (totalSlot - barWidth) / 2;
      const y = baseY - amp;

      // Bar gradient fill
      const barGrad = ctx.createLinearGradient(0, y, 0, baseY);
      barGrad.addColorStop(0, `rgba(${lightR}, ${lightG}, ${lightB}, 0.95)`);
      barGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.55)`);
      barGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.15)`);

      ctx.fillStyle = barGrad;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barWidth, amp, [radius, radius, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, amp);
      }
      ctx.fill();

      // Floating cap on top
      if (amp > 6 * ratio) {
        ctx.shadowColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.85)`;
        ctx.shadowBlur = 6 * ratio;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, Math.max(0, y - 3 * ratio), barWidth, 1.8 * ratio);
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  /** Style 3: Symmetrical mirrored audio wave oscillating from the center */
  private _renderMirror(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    ratio: number,
    r: number,
    g: number,
    b: number,
    lightR: number,
    lightG: number,
    lightB: number,
  ): void {
    const centerY = height / 2;
    const maxAmp = height / 2 - 4 * ratio;

    const topPts: { x: number; y: number }[] = [];
    const btmPts: { x: number; y: number }[] = [];

    for (let i = 0; i < POINT_COUNT; i++) {
      const taper = Math.sin((i / (POINT_COUNT - 1)) * Math.PI);
      const amp = this._peaks[i] * maxAmp * (0.2 + 0.8 * taper);
      const x = (i / (POINT_COUNT - 1)) * width;
      topPts.push({ x, y: centerY - Math.max(ratio, amp) });
      btmPts.push({ x, y: centerY + Math.max(ratio, amp) });
    }

    ctx.save();
    // Fill between top and bottom
    ctx.beginPath();
    ctx.moveTo(topPts[0].x, topPts[0].y);
    for (let i = 0; i < topPts.length - 1; i++) {
      const xc = (topPts[i].x + topPts[i + 1].x) / 2;
      const yc = (topPts[i].y + topPts[i + 1].y) / 2;
      ctx.quadraticCurveTo(topPts[i].x, topPts[i].y, xc, yc);
    }
    ctx.lineTo(topPts[topPts.length - 1].x, topPts[topPts.length - 1].y);

    for (let i = btmPts.length - 1; i > 0; i--) {
      const xc = (btmPts[i].x + btmPts[i - 1].x) / 2;
      const yc = (btmPts[i].y + btmPts[i - 1].y) / 2;
      ctx.quadraticCurveTo(btmPts[i].x, btmPts[i].y, xc, yc);
    }
    ctx.closePath();

    const mirrorGrad = ctx.createLinearGradient(0, 0, 0, height);
    mirrorGrad.addColorStop(0, `rgba(${lightR}, ${lightG}, ${lightB}, 0.5)`);
    mirrorGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.15)`);
    mirrorGrad.addColorStop(1, `rgba(${lightR}, ${lightG}, ${lightB}, 0.5)`);
    ctx.fillStyle = mirrorGrad;
    ctx.fill();

    // Crest strokes
    this._drawSpline(ctx, topPts);
    ctx.shadowColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.9)`;
    ctx.shadowBlur = 8 * ratio;
    ctx.strokeStyle = `rgba(${lightR}, ${lightG}, ${lightB}, 0.85)`;
    ctx.lineWidth = 1.8 * ratio;
    ctx.stroke();

    this._drawSpline(ctx, btmPts);
    ctx.stroke();

    // Center pulsating laser line
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1 * ratio;
    ctx.stroke();
    ctx.restore();
  }

  /** Style 4: Neon ribbon / electric oscilloscope pulse line */
  private _renderPulse(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    ratio: number,
    r: number,
    g: number,
    b: number,
    lightR: number,
    lightG: number,
    lightB: number,
  ): void {
    const centerY = height * 0.6;
    const maxAmp = height * 0.5;

    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < POINT_COUNT; i++) {
      const taper = Math.sin((i / (POINT_COUNT - 1)) * Math.PI);
      const amp = this._peaks[i] * maxAmp * (0.15 + 0.85 * taper);
      const sign = i % 2 === 0 ? -1 : 1;
      const x = (i / (POINT_COUNT - 1)) * width;
      const y = centerY + sign * amp;
      pts.push({ x, y });
    }

    ctx.save();
    // Outer glowing stroke
    this._drawSpline(ctx, pts);
    ctx.shadowColor = `rgba(${lightR}, ${lightG}, ${lightB}, 1)`;
    ctx.shadowBlur = 14 * ratio;
    ctx.strokeStyle = `rgba(${lightR}, ${lightG}, ${lightB}, 0.85)`;
    ctx.lineWidth = 3.2 * ratio;
    ctx.stroke();

    // Inner bright white core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4 * ratio;
    ctx.stroke();

    // Floating spark particles on strong peaks
    for (let i = 0; i < pts.length; i++) {
      if (this._peaks[i] > 0.45) {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, 2.5 * ratio, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
