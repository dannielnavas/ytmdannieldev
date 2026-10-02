import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  DashboardQueryOptions,
  DashboardResponse,
  IDashboard,
  PersonalDashboardData,
} from '../../models/dashboard';
import { MetadataResponse, StreamResponse } from '../../models/stream';
import { IListSearch } from '../../models/list-search';
import { PlaylistModel } from '../../models/playlist.model';
import { AlbumResponse } from '../../models/album.model';
import { apiUrl } from '../../config/api.config';

/**
 * Prefijo que YouTube Music antepone a los browse ids y que no forma parte del id real.
 * Estaba hardcodeado en 4 ficheros como `/^RDAM(?:VM|PL)/`.
 */
export const BROWSE_ID_PREFIX = /^RDAM(?:VM|PL)/;

/** Quita el prefijo `RDAMVM`/`RDAMPL` de un browse id. */
export function normalizeBrowseId(id: string | null | undefined): string {
  return (id ?? '').replace(BROWSE_ID_PREFIX, '');
}

@Service()
export class Dashboard {
  private readonly _http = inject(HttpClient);

  /**
   * Retorna la vista híbrida (decide activeView: 'personal' | 'youtube').
   * Acepta query params: ?includeYoutube=true/false y ?refresh=true/false.
   */
  public getDashboard(options?: DashboardQueryOptions): Observable<DashboardResponse> {
    const params: Record<string, string> = {};
    if (options?.includeYoutube !== undefined) {
      params['includeYoutube'] = String(options.includeYoutube);
    }
    if (options?.refresh !== undefined) {
      params['refresh'] = String(options.refresh);
    }
    return this._http.get<DashboardResponse>(apiUrl('dashboard'), { params });
  }

  /**
   * Alias directo de /dashboard (/dashboard/summary).
   */
  public getDashboardSummary(options?: DashboardQueryOptions): Observable<DashboardResponse> {
    const params: Record<string, string> = {};
    if (options?.includeYoutube !== undefined) {
      params['includeYoutube'] = String(options.includeYoutube);
    }
    if (options?.refresh !== undefined) {
      params['refresh'] = String(options.refresh);
    }
    return this._http.get<DashboardResponse>(apiUrl('dashboard', 'summary'), { params });
  }

  /**
   * Retorna únicamente el payload de analíticas personales y Last.fm.
   */
  public getPersonalDashboard(): Observable<PersonalDashboardData> {
    return this._http.get<PersonalDashboardData>(apiUrl('dashboard', 'personal'));
  }

  /**
   * Retorna directamente las secciones de YouTube Music (/youtube/dashboard).
   */
  public getYoutubeDashboard(): Observable<IDashboard[]> {
    return this._http.get<IDashboard[]>(apiUrl('youtube', 'dashboard'));
  }

  /**
   * Obtiene los datos del dashboard híbrido por defecto con includeYoutube=true.
   */
  public getDashboardData(options?: DashboardQueryOptions): Observable<DashboardResponse> {
    return this.getDashboard({ includeYoutube: true, ...options });
  }

  /**
   * Genera la URL absoluta para el elemento <audio [src]>
   */
  public getStreamUrl(videoId: string): string {
    return apiUrl('youtube', 'stream', videoId);
  }

  /**
   * Obtiene los metadatos de un video
   */
  public getMetadata(videoId: string): Observable<MetadataResponse> {
    if (!videoId) {
      return of({
        title: 'Loading...',
        duration: 0,
        thumbnail: '',
        channel: 'Loading...',
        author: 'Loading...',
        viewCount: 0,
      });
    }
    return this._http.get<MetadataResponse>(apiUrl('youtube', 'metadata', videoId));
  }

  public searchSongs(query: string): Observable<IListSearch> {
    return this._http.get<IListSearch>(apiUrl('youtube', 'search'), {
      params: { q: query },
    });
  }

  public getPlaylist(playlistId: string): Observable<PlaylistModel> {
    return this._http.get<PlaylistModel>(apiUrl('youtube', 'playlist', playlistId));
  }

  public getAlbumById(albumId: string): Observable<AlbumResponse> {
    return this._http.get<AlbumResponse>(apiUrl('youtube', 'album', albumId));
  }

  public myLikes(): Observable<[]> {
    return this._http.get<[]>(apiUrl('likes'));
  }
}
