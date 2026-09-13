import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IDashboard } from '../../models/dashboard';
import { IStream, MetadataResponse, StreamResponse } from '../../models/stream';
import { IListSearch } from '../../models/list-search';
import { PlaylistModel } from '../../models/playlist.model';
import { AlbumResponse } from '../../models/album.model';

@Injectable({
  providedIn: 'root',
})
export class Dashboard {
  private readonly _http = inject(HttpClient);

  public getDashboardData(): Observable<IDashboard[]> {
    return this._http.get<IDashboard[]>('https://ytmdannieldev-back.vercel.app/youtube/dashboard');
  }

  /**
   * Consulta los metadatos del stream para un videoId
   */
  public stream(videoId: string): Observable<StreamResponse> {
    return this._http.get<StreamResponse>(
      `https://ytmdannieldev-back.vercel.app/youtube/stream?videoId=${encodeURIComponent(videoId)}`,
    );
  }
  /**
   * Genera la URL absoluta para el elemento <audio [src]>
   */
  public getStreamUrl(videoId: string): string {
    return `https://ytmdannieldev-back.vercel.app/youtube/stream/${encodeURIComponent(videoId)}`;
  }

  /**
   * Obtiene los metadatos de un video
   */
  public getMetadata(videoId: string): Observable<MetadataResponse> {
    console.log('videoId', videoId);
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
    return this._http.get<MetadataResponse>(
      `https://ytmdannieldev-back.vercel.app/youtube/metadata/${encodeURIComponent(videoId)}`,
    );
  }

  public searchSongs(query: string): Observable<IListSearch> {
    return this._http.get<IListSearch>(
      `https://ytmdannieldev-back.vercel.app/youtube/search?q=${encodeURIComponent(query)}`,
    );
  }

  public getPlaylist(playlistId: string) {
    return this._http.get<PlaylistModel>(
      `https://ytmdannieldev-back.vercel.app/youtube/playlist/${encodeURIComponent(playlistId)}`,
    );
  }

  public getAlbumById(albumId: string) {
    return this._http.get<AlbumResponse>(
      `https://ytmdannieldev-back.vercel.app/youtube/album/${encodeURIComponent(albumId)}`,
    );
  }
}
