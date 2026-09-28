import { Service, inject } from '@angular/core';
import { ImageHelperService, getHighResThumbnail } from './image-helper.service';

/** Una candidata a carátula: como mínimo la URL, con su tamaño si se conoce. */
export interface ThumbnailCandidate {
  url: string;
  width?: number;
  height?: number;
}

/** `...=w544-h544-l90-rj` y `...=s1200`, los dos formatos que envía YouTube. */
const SIZE_IN_URL = /=(?:w(\d+)-h(\d+)|s(\d+))/;

/**
 * Píxeles que la candidata ya tiene, o `Infinity` si no se pueden deducir.
 */
function ownSize(candidate: ThumbnailCandidate): number {
  if (candidate.width && candidate.height) {
    return Math.max(candidate.width, candidate.height);
  }
  const match = SIZE_IN_URL.exec(candidate.url);
  const size = match ? Number(match[1] ?? match[2] ?? match[3]) : 0;
  return size > 0 ? size : Number.POSITIVE_INFINITY;
}

/**
 * Recorre una lista de miniaturas cuando una falla, sin estado propio.
 *
 * Este recorrido estaba reimplementado en 5 componentes con la misma pareja
 * `linkedSignal` + `Record<string, number>` + `onImageError`, y en
 * `list-search.ts` cuatro veces más para álbum, playlist, artista y avatar. Aquí
 * solo vive una vez.
 */
@Service()
export class ThumbnailFallback {
  private readonly _helper = inject(ImageHelperService);

  /** Devuelve la URL de la miniatura en la posición `index`, ya escalada. */
  public at(
    thumbnails: readonly ThumbnailCandidate[] | null | undefined,
    index: number,
    size = 800,
  ): string {
    const candidate = (thumbnails ?? [])[index];
    if (!candidate?.url) {
      return '';
    }
    // Nunca pedir más píxeles de los que la candidata tiene: dos candidatas
    // distintas reescritas al mismo tamaño acabarían con la misma URL, así que
    // al degradar se volvería a pedir la que ya ha fallado y no se reintentaría
    // nada. Google además responde `400` cuando el tamaño no existe.
    return getHighResThumbnail(candidate.url, Math.min(size, ownSize(candidate)));
  }

  /**
   * Devuelve el índice a probar tras un fallo en `currentIndex`, o `null` si no
   * quedan más candidatas y hay que mostrar el placeholder.
   *
   * Las listas llegan ordenadas de menor a mayor calidad y `Thumbnail` empieza
   * por la última, así que el degradado va hacia atrás. Avanzar nunca tenía
   * sentido: desde el índice más alto la siguiente candidata siempre se salía
   * del rango y un solo fallo dejaba la imagen en el placeholder para siempre.
   */
  public nextIndex(
    thumbnails: readonly ThumbnailCandidate[] | null | undefined,
    currentIndex: number,
  ): number | null {
    if (this._helper.isRateLimited()) {
      return null;
    }
    if (!thumbnails?.length) {
      return null;
    }
    return currentIndex > 0 ? currentIndex - 1 : null;
  }

  /** Registra el fallo de una miniatura para el circuit breaker anti-429. */
  public recordFailure(url: string): void {
    this._helper.recordFailure(url);
  }
}
