/**
 * Configuración global de los tests (Vitest vía `@angular/build:unit-test`).
 *
 * jsdom no implementa la parte de medios ni de canvas del DOM. Sin esto, cada
 * test que toca `HTMLMediaElement.play()` o `canvas.getContext('2d')` imprime
 * un `Not implemented: ...` que hay que ignorar a ojo, y `play()` devuelve
 * `undefined` en vez de una promesa, lo que revienta cualquier
 * `audio.play().then(...)`.
 */

import { afterEach } from 'vitest';

type AnyRecord = Record<string, unknown>;

function define(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}

// --- HTMLMediaElement -------------------------------------------------------

const mediaProto = globalThis.HTMLMediaElement?.prototype as unknown as AnyRecord | undefined;

if (mediaProto) {
  // `paused` is a getter in jsdom, so it has to be shadowed with an own
  // property instead of assigned.
  define(mediaProto, 'play', function play(this: AnyRecord) {
    define(this, 'paused', false);
    return Promise.resolve();
  });
  define(mediaProto, 'pause', function pause(this: AnyRecord) {
    define(this, 'paused', true);
  });
  define(mediaProto, 'load', function load(): void {
    // No-op: no hay decodificador en jsdom.
  });
  // `duration` y `buffered` no existen como propiedades reales en jsdom.
  define(mediaProto, 'buffered', {
    length: 0,
    start: () => 0,
    end: () => 0,
  });
}

// --- Canvas 2D --------------------------------------------------------------

/**
 * Contexto falso con los métodos que usa `app-visualizer` y ColorThief.
 * Register it lazily: `getContext` must exist even if the app never draws.
 */
const canvasContextStub = new Proxy(
  {
    canvas: undefined as unknown,
    measureText: () => ({ width: 0 }),
    // El visualizador de espectro pinta barras con un degradado vertical.
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
  } as AnyRecord,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // Cualquier otro método (fillRect, clearRect, ...) es un no-op.
      return () => undefined;
    },
    set(target, prop: string, value: unknown) {
      target[prop] = value;
      return true;
    },
  },
);

if (globalThis.HTMLCanvasElement) {
  define(globalThis.HTMLCanvasElement.prototype, 'getContext', function getContext(this: unknown) {
    (canvasContextStub as AnyRecord)['canvas'] = this;
    return canvasContextStub;
  });
  // jsdom no implementa OffscreenCanvas; el visualizador lo detecta antes de usar.
  if (!('OffscreenCanvas' in globalThis)) {
    define(globalThis, 'OffscreenCanvas', class OffscreenCanvasStub {});
  }
}

// --- Media Session ----------------------------------------------------------

// jsdom implements neither `navigator.mediaSession` nor `MediaMetadata`.
if (typeof globalThis.MediaMetadata === 'undefined') {
  define(
    globalThis,
    'MediaMetadata',
    class MediaMetadataStub {
      public constructor(init: MediaMetadataInit = {}) {
        Object.assign(this, init);
      }
    },
  );
}

// --- Scrolling --------------------------------------------------------------

// jsdom no implementa `scrollIntoView`, que usan las letras sincronizadas para
// mantener la línea actual centrada.
if (globalThis.Element) {
  define(globalThis.Element.prototype, 'scrollIntoView', function scrollIntoView() {
    return undefined;
  });
}

// --- requestAnimationFrame --------------------------------------------------

// El visualizador usa rAF; en tests no queremos bucles reales que colguen.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  define(
    globalThis,
    'requestAnimationFrame',
    (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number,
  );
  define(globalThis, 'cancelAnimationFrame', (handle: number) => clearTimeout(handle));
}

// --- Storage isolation ------------------------------------------------------

// The jsdom environment is shared by the test files, so a spec that writes a
// snapshot (playback state, lyrics offset) would otherwise leak it into the
// next one, whose assertions on `localStorage.length` are absolute.
afterEach(() => {
  try {
    globalThis.localStorage?.clear();
    globalThis.sessionStorage?.clear();
  } catch {
    // Nothing to isolate.
  }
});
