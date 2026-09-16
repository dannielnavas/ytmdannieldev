import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class LyricsService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = 'https://lrclib.net/api/get';

  /**
   * Fetches lyrics from Lrclib.
   */
  public getLyrics(trackName: string, artistName: string): Observable<LrclibResponse | null> {
    return this._http
      .get<LrclibResponse>(
        `http://localhost:3000/youtube/lyrics?track_name=${trackName}&artist_name=${artistName}`,
      )
      .pipe(
        catchError(() => {
          return of(null);
        }),
      );
  }

  /**
   * Parses an LRC format string (syncedLyrics) into an array of lines with seconds.
   */
  public parseSyncedLyrics(lrc: string): ParsedLyricLine[] {
    if (!lrc) return [];

    const lines = lrc.split('\n');
    const result: ParsedLyricLine[] = [];

    const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\]/;

    for (const line of lines) {
      const match = timeRegex.exec(line);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const timeInSeconds = minutes * 60 + seconds;

        const text = line.replace(timeRegex, '').trim();

        result.push({ time: timeInSeconds, text });
      }
    }

    return result.sort((a, b) => a.time - b.time);
  }
}
