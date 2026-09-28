import { Service, inject } from '@angular/core';
import { ColorThiefService } from '@soarlin/angular-color-thief';

export type Rgb = [number, number, number];

/** Side of the square the cover is downscaled to before analysis. */
const ANALYSIS_SIZE = 256;

/**
 * Styles derived from the cover art via ColorThief.
 *
 * `detail-info-album`, `detail-info-playlist` and `list-search` had the same six
 * computeds (`heroGradientStyle`, `glowStyle1`, `glowStyle2`,
 * `artworkShadowStyle`, `playButtonStyle`, `badgeStyle`) with the same rgba
 * interpolation. It lives here once.
 */
@Service()
export class CoverPalette {
  private readonly _colorThief = inject(ColorThiefService);

  /**
   * Scratch canvas used to downscale before sampling. ColorThief reads
   * `getImageData` over the whole source, so analysing a 1024×1024 cover
   * allocated 4.2 MB per pass on the main thread. At 256×256 it is 256 KB.
   */
  private readonly _scratch: HTMLCanvasElement;
  private readonly _scratchContext: CanvasRenderingContext2D | null;

  public constructor() {
    this._scratch = document.createElement('canvas');
    this._scratch.width = ANALYSIS_SIZE;
    this._scratch.height = ANALYSIS_SIZE;
    this._scratchContext = this._scratch.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Reads the dominant color and palette of an already loaded image.
   * Does not propagate exceptions: if the image is cross-origin without CORS,
   * ColorThief throws and the view keeps the default gradient.
   *
   * Only one pass: `getColor()` is an alias for `getPalette()[0]`, so calling
   * both meant two `drawImage` + `getImageData` + `quantize` runs per image.
   */
  public extract(img: HTMLImageElement | null | undefined): { color: Rgb | null; palette: Rgb[] } {
    if (!img) {
      return { color: null, palette: [] };
    }
    const source = this._downscale(img);
    try {
      // The library's type only accepts HTMLImageElement, but a canvas is a
      // valid `drawImage` source and that is exactly the point of the scratch
      // canvas: it makes the sampling small.
      const palette = (this._colorThief.getPalette(source as HTMLImageElement, 5, 10) ??
        []) as Rgb[];
      return { color: palette.length > 0 ? palette[0] : null, palette };
    } catch {
      return { color: null, palette: [] };
    }
  }

  /** Dominant color only, for the common single-color case. */
  public dominant(img: HTMLImageElement | null | undefined): Rgb | null {
    return this.extract(img).color;
  }

  public heroGradient(color: Rgb | null): string {
    if (color) {
      const [r, g, b] = color;
      return `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.45) 0%, rgba(${r}, ${g}, ${b}, 0.12) 55%, rgba(12, 10, 21, 0) 100%)`;
    }
    return 'linear-gradient(180deg, rgba(88, 28, 135, 0.4) 0%, rgba(59, 7, 100, 0.1) 55%, rgba(12, 10, 21, 0) 100%)';
  }

  public glow(color: Rgb | null, strength: number, fallback = '147, 51, 234'): string {
    if (color) {
      const [r, g, b] = color;
      return `radial-gradient(circle, rgba(${r}, ${g}, ${b}, ${strength}) 0%, rgba(${r}, ${g}, ${b}, 0) 70%)`;
    }
    return `radial-gradient(circle, rgba(${fallback}, ${strength}) 0%, rgba(${fallback}, 0) 70%)`;
  }

  public artworkShadow(color: Rgb | null): string {
    if (color) {
      const [r, g, b] = color;
      return `0 25px 50px -12px rgba(${r}, ${g}, ${b}, 0.55)`;
    }
    return '0 25px 50px -12px rgba(88, 28, 135, 0.6)';
  }

  /** Gradient of the play button, using the second color of the palette. */
  public playButton(color: Rgb | null, palette: readonly Rgb[]): Record<string, string> {
    if (color && palette.length > 1) {
      const [r1, g1, b1] = color;
      const [r2, g2, b2] = palette[1];
      return {
        background: `linear-gradient(135deg, rgb(${r1}, ${g1}, ${b1}) 0%, rgb(${r2}, ${g2}, ${b2}) 100%)`,
        'box-shadow': `0 10px 25px -5px rgba(${r1}, ${g1}, ${b1}, 0.5)`,
      };
    }
    if (color) {
      const [r, g, b] = color;
      return {
        background: `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgba(${r}, ${g}, ${b}, 0.8) 100%)`,
        'box-shadow': `0 10px 25px -5px rgba(${r}, ${g}, ${b}, 0.5)`,
      };
    }
    return {};
  }

  public badge(color: Rgb | null, lift = 80): Record<string, string> {
    if (!color) {
      return {};
    }
    const [r, g, b] = color;
    return {
      'background-color': `rgba(${r}, ${g}, ${b}, 0.25)`,
      'border-color': `rgba(${r}, ${g}, ${b}, 0.45)`,
      color: `rgb(${Math.min(255, r + lift)}, ${Math.min(255, g + lift)}, ${Math.min(255, b + lift)})`,
    };
  }

  /**
   * Draws the cover into the scratch canvas, preserving aspect ratio.
   *
   * Falls back to the image itself when there is no canvas or no intrinsic size
   * (an SVG cover, or a `load` that raced the decode) so the caller always gets
   * a source to sample.
   */
  private _downscale(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
    const context = this._scratchContext;
    if (!context) {
      return img;
    }
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      return img;
    }
    if (width <= ANALYSIS_SIZE && height <= ANALYSIS_SIZE) {
      return img;
    }
    const scale = Math.min(ANALYSIS_SIZE / width, ANALYSIS_SIZE / height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    // The scratch canvas is shared: clear all of it, not just the new area, or
    // the previous cover leaks into this sample.
    context.clearRect(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    context.drawImage(img, 0, 0, targetWidth, targetHeight);
    return this._scratch;
  }
}
