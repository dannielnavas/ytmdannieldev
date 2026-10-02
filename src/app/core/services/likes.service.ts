import { Service, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { SourceSong } from '../models/youtube';
import { QueueItem } from '../models/queue.model';
import { ToggleLikeDto, ToggleLikeResponse } from '../models/likes.model';
import { parseDuration } from './playback.service';

export interface LikedSong {
  videoId: string;
  name: string;
  artist?: string;
  thumbnailUrl?: string;
  duration?: number | string | null;
  albumId?: string | null;
  likedAt: number;
}

export function toLikedSong(
  input:
    | LikedSong
    | SourceSong
    | QueueItem
    | {
        videoId?: string;
        youtubeId?: string;
        name?: string;
        title?: string;
        artist?: any;
        thumbnail?: string;
        thumbnailUrl?: string;
        thumbnails?: any[];
        duration?: number | string | null;
        albumId?: string | null;
        likedAt?: number;
        createdAt?: string | Date;
      },
): LikedSong {
  const videoId =
    ('videoId' in input && typeof input.videoId === 'string' && input.videoId) ||
    ('youtubeId' in input &&
      typeof (input as { youtubeId?: string }).youtubeId === 'string' &&
      (input as { youtubeId?: string }).youtubeId) ||
    '';
  const name =
    input.name ||
    ('title' in input && typeof input.title === 'string' ? input.title : '') ||
    'Canción sin título';

  let artistName = '';
  if (typeof input.artist === 'string') {
    artistName = input.artist;
  } else if (input.artist && typeof input.artist === 'object' && 'name' in input.artist) {
    artistName = String(input.artist.name);
  }

  let thumbnailUrl = '';
  if ('thumbnailUrl' in input && typeof input.thumbnailUrl === 'string') {
    thumbnailUrl = input.thumbnailUrl;
  } else if ('thumbnail' in input && typeof input.thumbnail === 'string') {
    thumbnailUrl = input.thumbnail;
  } else if (
    'thumbnails' in input &&
    Array.isArray(input.thumbnails) &&
    input.thumbnails.length > 0
  ) {
    const last = input.thumbnails[input.thumbnails.length - 1];
    thumbnailUrl = last?.url || '';
  }

  let likedAt = Date.now();
  if ('likedAt' in input && typeof input.likedAt === 'number') {
    likedAt = input.likedAt;
  } else if ('createdAt' in input && input.createdAt) {
    const parsed = new Date(input.createdAt).getTime();
    if (!Number.isNaN(parsed)) {
      likedAt = parsed;
    }
  }

  return {
    videoId,
    name,
    artist: artistName,
    thumbnailUrl,
    duration: input.duration ?? null,
    albumId: 'albumId' in input ? (input.albumId ?? null) : null,
    likedAt,
  };
}

/**
 * Servicio centralizado para gestionar canciones favoritas / likes en Sonara.
 * Sincronizado completamente con el backend NestJS (LikesController):
 * - POST /likes/toggle (ToggleLikeDto) -> { isLiked: boolean }
 * - GET  /likes                        -> Track[]
 * - GET  /likes/check/:youtubeId       -> { isLiked: boolean }
 */
@Service()
export class LikesService {
  private readonly _http = inject(HttpClient);

  /**
   * Estado reactivo en memoria con Signals.
   */
  private readonly _likedSongs = signal<LikedSong[]>([]);
  public readonly $likedSongs = this._likedSongs.asReadonly();
  public readonly $likedCount = computed(() => this._likedSongs().length);
  public readonly $likedIds = computed(() => new Set(this._likedSongs().map((s) => s.videoId)));

  /**
   * Bandera para habilitar/deshabilitar sincronización HTTP (activa por defecto).
   */
  public backendSyncEnabled = true;

  /**
   * Endpoints hacia los servicios de likes del backend.
   */
  public readonly endpoints = {
    toggle: () => apiUrl('likes', 'toggle'),
    like: () => apiUrl('likes', 'toggle'),
    unlike: () => apiUrl('likes', 'toggle'),
    favorites: () => apiUrl('likes'),
    check: (youtubeId: string) => apiUrl('likes', 'check', youtubeId),
  };

  /**
   * Determina de manera reactiva e inmediata si una canción tiene me gusta.
   */
  public isLiked(videoId: string | null | undefined): boolean {
    if (!videoId) return false;
    return this.$likedIds().has(videoId);
  }

  /**
   * Alterna el estado de like de una canción.
   * Realiza actualización optimista inmediata en la UI y sincroniza con el backend mediante POST /likes/toggle.
   * Si ocurre un error de red o backend, revierte el estado optimista.
   */
  public toggleLike(
    song:
      | LikedSong
      | SourceSong
      | QueueItem
      | {
          videoId?: string;
          youtubeId?: string;
          name?: string;
          title?: string;
          artist?: any;
          thumbnail?: string;
          thumbnailUrl?: string;
          thumbnails?: any[];
          duration?: number | string | null;
        },
  ): boolean {
    const item = toLikedSong(song as any);
    if (!item.videoId) return false;

    const currentlyLiked = this.isLiked(item.videoId);
    const nextLiked = !currentlyLiked;

    if (this.backendSyncEnabled) {
      this.toggleLike$(item).subscribe();
    } else {
      this._updateLocalState(item, nextLiked);
    }

    return nextLiked;
  }

  /**
   * Observable que envía el toggle al backend y gestiona rollback ante fallos.
   */
  public toggleLike$(
    song:
      | LikedSong
      | SourceSong
      | QueueItem
      | {
          videoId?: string;
          youtubeId?: string;
          name?: string;
          title?: string;
          artist?: any;
          thumbnail?: string;
          thumbnailUrl?: string;
          thumbnails?: any[];
          duration?: number | string | null;
        },
  ): Observable<ToggleLikeResponse> {
    const item = toLikedSong(song as any);
    if (!item.videoId) {
      return of({ isLiked: false });
    }

    const currentlyLiked = this.isLiked(item.videoId);
    const nextLiked = !currentlyLiked;

    // Actualización optimista inmediata
    this._updateLocalState(item, nextLiked);

    const durationSeconds = parseDuration(item.duration) ?? 0;
    const payload: ToggleLikeDto = {
      youtubeId: item.videoId,
      title: item.name,
      artist: item.artist || 'Desconocido',
      duration: durationSeconds,
      ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
    };

    return this._http.post<ToggleLikeResponse>(this.endpoints.toggle(), payload).pipe(
      tap((res) => {
        if (res && typeof res.isLiked === 'boolean' && res.isLiked !== nextLiked) {
          this._updateLocalState(item, res.isLiked);
        }
      }),
      catchError((error) => {
        console.warn(
          `[LikesService] Error alternando like en backend para ${item.videoId}:`,
          error,
        );
        // Rollback al estado previo si falla
        this._updateLocalState(item, currentlyLiked);
        return of({ isLiked: currentlyLiked });
      }),
    );
  }

  /**
   * Agrega una canción a los favoritos si no lo está.
   */
  public like(song: LikedSong | SourceSong | QueueItem | any): void {
    const item = toLikedSong(song);
    if (!item.videoId || this.isLiked(item.videoId)) return;
    this.toggleLike(item);
  }

  /**
   * Quita una canción de los favoritos si lo está.
   */
  public unlike(song: LikedSong | SourceSong | QueueItem | string | any): void {
    const videoId = typeof song === 'string' ? song : song?.videoId || song?.youtubeId;
    if (!videoId || !this.isLiked(videoId)) return;
    this.toggleLike(typeof song === 'string' ? { videoId } : song);
  }

  /**
   * Consulta al backend si una canción específica tiene like (GET /likes/check/:youtubeId).
   */
  public checkLike(youtubeId: string): Observable<boolean> {
    if (!youtubeId) return of(false);
    return this._http.get<{ isLiked: boolean }>(this.endpoints.check(youtubeId)).pipe(
      map((res) => Boolean(res?.isLiked)),
      tap((isLiked) => {
        if (isLiked && !this.isLiked(youtubeId)) {
          this._likedSongs.update((list) => [
            { videoId: youtubeId, name: '', likedAt: Date.now() },
            ...list.filter((s) => s.videoId !== youtubeId),
          ]);
        } else if (!isLiked && this.isLiked(youtubeId)) {
          this._likedSongs.update((list) => list.filter((s) => s.videoId !== youtubeId));
        }
      }),
      catchError(() => of(this.isLiked(youtubeId))),
    );
  }

  /**
   * Recupera las canciones favoritas desde el backend (GET /likes) y actualiza el estado reactivo.
   */
  public fetchFavoritesFromBackend(): Observable<LikedSong[]> {
    const url = this.endpoints.favorites();
    return this._http.get<any[]>(url).pipe(
      map((remoteLikes) => {
        if (!Array.isArray(remoteLikes)) return [];
        return remoteLikes.map((item) => toLikedSong(item));
      }),
      tap((songs) => {
        this._likedSongs.set(songs);
      }),
      catchError((error) => {
        console.warn('[LikesService] Error cargando favoritos del backend:', error);
        return of(this._likedSongs());
      }),
    );
  }

  /**
   * Alias utilizado por componentes como ListLikes para obtener las canciones con like.
   */
  public getListLikes(): Observable<LikedSong[]> {
    return this.fetchFavoritesFromBackend();
  }

  /**
   * Limpia el estado reactivo de me gusta en memoria.
   */
  public clearAll(): void {
    this._likedSongs.set([]);
  }

  /**
   * Métodos auxiliares de compatibilidad.
   */
  public sendLikeToBackend(track: LikedSong): Observable<boolean> {
    return this.toggleLike$(track).pipe(map((res) => res.isLiked));
  }

  public sendUnlikeToBackend(track: LikedSong): Observable<boolean> {
    return this.toggleLike$(track).pipe(map((res) => !res.isLiked));
  }

  private _updateLocalState(item: LikedSong, isLiked: boolean): void {
    if (isLiked) {
      this._likedSongs.update((list) => [item, ...list.filter((s) => s.videoId !== item.videoId)]);
    } else {
      this._likedSongs.update((list) => list.filter((s) => s.videoId !== item.videoId));
    }
  }
}
