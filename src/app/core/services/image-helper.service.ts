import { Injectable } from '@angular/core';

export interface ThumbnailItem {
  url: string;
  width?: number;
  height?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ImageHelperService {
  /** Conjunto de URLs que han fallado para no reintentar solicitarlas */
  private readonly _failedUrls = new Set<string>();

  /** Historial de timestamps de fallos recientes para el Circuit Breaker */
  private _recentErrorTimestamps: number[] = [];

  /** Timestamp hasta el cual el circuit breaker está activo (enfriamiento anti-429) */
  private _cooldownUntil = 0;

  /** Ventana de tiempo (ms) para contar errores concurrentes */
  private readonly ERROR_WINDOW_MS = 3000;

  /** Máximo número de fallos en la ventana antes de disparar el circuit breaker */
  private readonly MAX_ERRORS_BEFORE_BREAKER = 3;

  /** Tiempo de enfriamiento cuando se activa el circuit breaker (12 segundos) */
  private readonly COOLDOWN_DURATION_MS = 12000;

  /**
   * Indica si el sistema está en periodo de enfriamiento debido a una ráfaga de errores (evita 429).
   */
  public isRateLimited(): boolean {
    return Date.now() < this._cooldownUntil;
  }

  /**
   * Registra el fallo de una imagen, añade su URL a la lista negra y evalúa el Circuit Breaker.
   */
  public recordFailure(url?: string): void {
    const now = Date.now();

    if (url) {
      this._failedUrls.add(url);
    }

    // Mantener solo errores dentro de la ventana de tiempo
    this._recentErrorTimestamps = this._recentErrorTimestamps.filter(
      (ts) => now - ts < this.ERROR_WINDOW_MS,
    );
    this._recentErrorTimestamps.push(now);

    // Si se supera el límite de fallos en la ventana, activar modo enfriamiento
    if (this._recentErrorTimestamps.length >= this.MAX_ERRORS_BEFORE_BREAKER) {
      this._cooldownUntil = now + this.COOLDOWN_DURATION_MS;
      this._recentErrorTimestamps = [];
      console.warn(
        `[ImageHelper] Circuit breaker activado por ráfaga de errores. Pausando reintentos de imágenes por ${
          this.COOLDOWN_DURATION_MS / 1000
        }s para prevenir 429.`,
      );
    }
  }

  /**
   * Determina si es seguro reintentar una imagen alternativa.
   * Limita a un único reintento por elemento y bloquea reintentos si el circuit breaker está activo.
   */
  public shouldRetry(attemptCount: number): boolean {
    if (this.isRateLimited()) {
      return false;
    }
    return attemptCount < 1;
  }

  /**
   * Obtiene la mejor miniatura según el tamaño deseado, descartando URLs fallidas.
   */
  public getBestThumbnail(
    thumbnails?: ThumbnailItem[] | null,
    preferredSize: 'small' | 'medium' | 'large' = 'medium',
  ): string {
    if (!thumbnails || thumbnails.length === 0) {
      return '';
    }

    // Filtrar miniaturas que no hayan fallado previamente
    const available = thumbnails.filter((t) => t.url && !this._failedUrls.has(t.url));

    if (available.length === 0) {
      return '';
    }

    if (preferredSize === 'small') {
      // Para filas de canciones o miniaturas pequeñas (~60-120px)
      return available[0]?.url || '';
    }

    if (preferredSize === 'medium') {
      // Para tarjetas de carrusel, álbumes o playlists (~180-300px)
      const midIdx = Math.min(Math.floor(available.length / 2), available.length - 1);
      return available[midIdx]?.url || available[0]?.url || '';
    }

    // Para portadas grandes (cabecera de artista, playlist principal, barra reproductora)
    return available[available.length - 1]?.url || available[0]?.url || '';
  }

  /**
   * Limpia el registro de fallos y el enfriamiento (ej: al realizar una nueva búsqueda).
   */
  public reset(): void {
    this._failedUrls.clear();
    this._recentErrorTimestamps = [];
    this._cooldownUntil = 0;
  }
}
