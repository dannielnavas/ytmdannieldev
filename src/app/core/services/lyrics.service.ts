import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl } from '../config/api.config';

export interface LrclibResponse {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string | null;
}

export interface ParsedLyricLine {
  time: number; // in seconds
  text: string;
}

@Service()
export class LyricsService {
  private readonly _http = inject(HttpClient);

  /**
   * Fetches lyrics for a track from the backend.
   */
  public getLyrics(trackName: string, artistName: string): Observable<LrclibResponse | null> {
    // Los parámetros se mandan con HttpParams: interpolarlos a mano dejaba pasar
    // títulos con `&`, `=` o `#` sin codificar, que rompían el query string.
    const params = new HttpParams({
      fromObject: { track_name: trackName, artist_name: artistName },
    });

    return this._http.get<LrclibResponse>(apiUrl('youtube', 'lyrics'), { params }).pipe(
      catchError(() => {
        return of(null);
      }),
    );
  }

  /**
   * Parses an LRC format string (syncedLyrics) into an array of lines with seconds.
   *
   * Una misma línea puede llevar varios time tags (`[00:01.00][01:00.00] coro`), y
   * las cabeceras de metadatos (`[ar:]`, `[ti:]`, `[length:]`) no son letra: se ignoran.
   */
  public parseSyncedLyrics(lrc: string): ParsedLyricLine[] {
    if (!lrc) return [];

    // \d+ para que una pista de más de 99 minutos no quede sin parsear.
    const timeRegex = /\[(\d+):(\d{1,2}(?:[.:]\d+)?)\]/g;
    const result: ParsedLyricLine[] = [];

    for (const line of lrc.split('\n')) {
      const times: number[] = [];
      for (const match of line.matchAll(timeRegex)) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2].replace(':', '.'));
        times.push(minutes * 60 + seconds);
      }

      if (times.length === 0) {
        continue; // Cabeceras de metadatos o líneas sin sincronizar.
      }

      // La letra es lo que queda tras quitar todos los time tags de la línea:
      // en `[00:10.00][01:00.00] Chorus` el texto es `Chorus`, no el concatenado.
      const cleanText = line.replace(timeRegex, '').trim();
      for (const time of times) {
        result.push({ time, text: cleanText });
      }
    }

    return result.sort((a, b) => a.time - b.time);
  }
}
