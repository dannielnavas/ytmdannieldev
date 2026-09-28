import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { ThumbnailCandidate, ThumbnailFallback } from './thumbnail-fallback.service';

/**
 * Imagen con degradado de miniaturas: recorre `thumbnails` de mayor a menor
 * calidad cuando una falla, y cae en un placeholder si se agotan.
 *
 * Este comportamiento estaba duplicado en `detail-info-album`,
 * `detail-info-playlist`, `detail-song-album`, `detail-song-playlist`,
 * `detail-song`, `player-bar` y cuatro veces dentro de `list-search.ts`.
 */
@Component({
  selector: 'app-thumb',
  host: { class: 'block overflow-hidden' },
  template: `
    @if (url()) {
      <img
        [src]="url()"
        [alt]="alt()"
        [class]="imgClass()"
        [attr.crossorigin]="crossOrigin()"
        loading="lazy"
        decoding="async"
        (load)="onLoad($event)"
        (error)="onError()"
      />
    } @else {
      <div [class]="placeholderClass()" aria-hidden="true">
        <ng-content select="[thumbPlaceholder]" />
      </div>
    }
  `,
})
export class Thumbnail {
  private readonly _fallback = inject(ThumbnailFallback);

  /** Lista de candidatas, ordenadas de mejor a peor calidad. */
  public readonly thumbnails = input<readonly ThumbnailCandidate[] | null | undefined>([]);
  /** Valor absoluto, usado cuando la imagen viene ya resuelta (p.ej. la cola). */
  public readonly src = input<string | null | undefined>(null);
  public readonly alt = input('');
  public readonly size = input(800);
  public readonly imgClass = input<string>('');
  public readonly placeholderClass = input<string>('h-full w-full bg-purple-950/40');
  /** Necesario para leer píxeles con ColorThief, que exige CORS. */
  public readonly crossOrigin = input<string | null>(null);

  /** Emitido cuando una imagen se ha painted en pantalla. */
  public readonly loaded = output<HTMLImageElement>();

  private readonly $index = linkedSignal(() => (this.thumbnails()?.length ?? 1) - 1);

  public readonly url = computed(() => {
    const explicit = this.src();
    if (explicit) {
      return explicit;
    }
    const list = this.thumbnails() ?? [];
    if (list.length === 0) {
      return '';
    }
    // Empezar por la de mayor calidad, como hacen hoy los componentes.
    const start = Math.min(this.$index(), list.length - 1);
    return this._fallback.at(list, start, this.size());
  });

  protected onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      this.loaded.emit(img);
    }
  }

  protected onError(): void {
    const explicit = this.src();
    if (explicit) {
      return;
    }
    const current = this.url();
    if (current) {
      this._fallback.recordFailure(current);
    }
    const next = this._fallback.nextIndex(this.thumbnails(), this.$index());
    if (next === null) {
      this.$index.set(-1);
    } else {
      this.$index.set(next);
    }
  }
}
