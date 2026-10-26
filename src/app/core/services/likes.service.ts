import { Service, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { SourceSong } from '../models/youtube';
import { QueueItem } from '../models/queue.model';
import {
  GetLikesParams,
  PaginatedLikesResponse,
  ToggleLikeDto,
  ToggleLikeResponse,
  Track,
} from '../models/likes.model';
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
        youtube_id?: string;
        name?: string;
        title?: string;
        artist?: any;
        thumbnail?: string;
        thumbnailUrl?: string;
        thumbnail_url?: string;
        thumbnails?: any[];
        duration?: number | string | null;
        albumId?: string | null;
        likedAt?: number;
        createdAt?: string | Date;
        created_at?: string | Date;
      },
): LikedSong {
  const raw: any = input || {};

  const videoId =
    (typeof raw.videoId === 'string' && raw.videoId) ||
    (typeof raw.youtubeId === 'string' && raw.youtubeId) ||
    (typeof raw.youtube_id === 'string' && raw.youtube_id) ||
    '';

  const name = raw.name || (typeof raw.title === 'string' ? raw.title : '') || 'Canción sin título';

  let artistName = '';
  if (typeof raw.artist === 'string') {
    artistName = raw.artist;
  } else if (raw.artist && typeof raw.artist === 'object' && 'name' in raw.artist) {
    artistName = String(raw.artist.name);
  } else if (typeof raw.author === 'string') {
    artistName = raw.author;
  } else if (typeof raw.channel === 'string') {
    artistName = raw.channel;
  }

  let thumbnailUrl = '';
  if (typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl.trim()) {
    thumbnailUrl = raw.thumbnailUrl.trim();
  } else if (typeof raw.thumbnail_url === 'string' && raw.thumbnail_url.trim()) {
    thumbnailUrl = raw.thumbnail_url.trim();
  } else if (typeof raw.thumbnail === 'string' && raw.thumbnail.trim()) {
    thumbnailUrl = raw.thumbnail.trim();
  } else if (typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) {
    thumbnailUrl = raw.imageUrl.trim();
  } else if (typeof raw.image_url === 'string' && raw.image_url.trim()) {
    thumbnailUrl = raw.image_url.trim();
  } else if (typeof raw.image === 'string' && raw.image.trim()) {
    thumbnailUrl = raw.image.trim();
  } else if (typeof raw.coverUrl === 'string' && raw.coverUrl.trim()) {
    thumbnailUrl = raw.coverUrl.trim();
  } else if (typeof raw.cover === 'string' && raw.cover.trim()) {
    thumbnailUrl = raw.cover.trim();
  } else if (Array.isArray(raw.thumbnails) && raw.thumbnails.length > 0) {
    const last = raw.thumbnails[raw.thumbnails.length - 1];
    thumbnailUrl = last?.url || (typeof last === 'string' ? last : '');
  }

  // Fallback garantizado: si no hay carátula pero tenemos videoId de YouTube
  if (!thumbnailUrl && videoId) {
    thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  let likedAt = Date.now();
  if ('likedAt' in raw && typeof raw.likedAt === 'number') {
    likedAt = raw.likedAt;
  } else if (raw.createdAt) {
    const parsed = new Date(raw.createdAt).getTime();
    if (!Number.isNaN(parsed)) {
      likedAt = parsed;
    }
  } else if (raw.created_at) {
    const parsed = new Date(raw.created_at).getTime();
    if (!Number.isNaN(parsed)) {
      likedAt = parsed;
    }
  }

  return {
    videoId,
    name,
    artist: artistName,
    thumbnailUrl,
    duration: raw.duration ?? null,
    albumId: raw.albumId ?? null,
    likedAt,
  };
}

/**
 * Servicio centralizado para gestionar canciones favoritas / likes en Pulso.
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

  private readonly _hasLoaded = signal(false);
  public readonly $hasLoaded = this._hasLoaded.asReadonly();

  /** Delta acumulado de likes/unlikes realizados optimistamente antes o durante la carga */
  private readonly _optimisticDelta = signal(0);
  public readonly $optimisticDelta = this._optimisticDelta.asReadonly();

  /**
   * Sincroniza localmente las canciones favoritas.
   */
  public setLocalSongs(songs: LikedSong[]): void {
    this._likedSongs.set(songs);
    this._hasLoaded.set(true);
    this._optimisticDelta.set(0);
  }

  /**
   * Registra canciones que se sabe que tienen like (ej. desde dashboard, joyas olvidadas o mixes)
   * sin sobrescribir las existentes ni borrar otras canciones.
   */
  public registerKnownLiked(songs: (LikedSong | any)[]): void {
    if (!songs || songs.length === 0) return;
    const current = this._likedSongs();
    const existingIds = new Set(current.map((s) => s.videoId));
    const toAdd: LikedSong[] = [];
    for (const raw of songs) {
      const item = toLikedSong(raw);
      if (item.videoId && !existingIds.has(item.videoId)) {
        existingIds.add(item.videoId);
        toAdd.push(item);
      }
    }
    if (toAdd.length > 0) {
      this._likedSongs.set([...current, ...toAdd]);
    }
  }

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
    checkBulk: () => apiUrl('likes', 'check-bulk'),
    radio: () => apiUrl('likes', 'radio'),
    forgotten: () => apiUrl('likes', 'forgotten'),
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
    this._optimisticDelta.update((d) => (nextLiked ? d + 1 : d - 1));

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
          this._optimisticDelta.update((d) => (res.isLiked ? d + 1 : d - 1));
        }
      }),
      catchError((error) => {
        console.warn(
          `[LikesService] Error alternando like en backend para ${item.videoId}:`,
          error,
        );
        // Rollback al estado previo si falla
        this._updateLocalState(item, currentlyLiked);
        this._optimisticDelta.update((d) => (currentlyLiked ? d + 1 : d - 1));
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
   * Obtiene canciones con 'me gusta' desde el backend admitiendo parámetros de búsqueda,
   * ordenación y paginación (GET /likes?page=&limit=&search=&sortBy=&order=).
   */
  public getLikedTracks(
    params?: GetLikesParams,
  ): Observable<PaginatedLikesResponse | Track[]> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params?.order) httpParams = httpParams.set('order', params.order);

    return this._http.get<any>(this.endpoints.favorites(), { params: httpParams });
  }

  /**
   * Solicita el estado de me gusta para una lista de IDs de YouTube en una sola petición (POST /likes/check-bulk).
   */
  public checkLikesBulk(
    youtubeIds: string[],
  ): Observable<{ likedIds: string[]; map: Record<string, boolean> }> {
    if (!youtubeIds || youtubeIds.length === 0) {
      return of({ likedIds: [], map: {} });
    }

    return this._http
      .post<{ likedIds: string[]; map: Record<string, boolean> }>(
        this.endpoints.checkBulk(),
        { youtubeIds },
      )
      .pipe(
        tap((res) => {
          if (res?.likedIds && Array.isArray(res.likedIds)) {
            const currentMap = new Map(this._likedSongs().map((s) => [s.videoId, s]));
            let changed = false;
            for (const id of res.likedIds) {
              if (!currentMap.has(id)) {
                currentMap.set(id, { videoId: id, name: '', likedAt: Date.now() });
                changed = true;
              }
            }
            if (changed) {
              this._likedSongs.set(Array.from(currentMap.values()));
            }
          }
        }),
        catchError((error) => {
          console.warn('[LikesService] Error verificando me gusta masivos:', error);
          const map: Record<string, boolean> = {};
          const likedIds: string[] = [];
          for (const id of youtubeIds) {
            const liked = this.isLiked(id);
            map[id] = liked;
            if (liked) likedIds.push(id);
          }
          return of({ likedIds, map });
        }),
      );
  }

  /**
   * Obtiene una selección de canciones para la "Radio de Likes" / "Mi Mix de Favoritas" (GET /likes/radio?limit=25).
   */
  public getLikedRadio(limit = 25): Observable<Track[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this._http.get<any>(this.endpoints.radio(), { params }).pipe(
      map((res) => (Array.isArray(res) ? res : res?.data || [])),
      catchError((err) => {
        console.warn('[LikesService] Error obteniendo radio de me gusta:', err);
        return of([]);
      }),
    );
  }

  /**
   * Obtiene canciones guardadas hace tiempo ("Joyas Olvidadas") para el Dashboard (GET /likes/forgotten?limit=10).
   */
  public getForgottenGems(limit = 10): Observable<Track[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this._http.get<any>(this.endpoints.forgotten(), { params }).pipe(
      map((res) => (Array.isArray(res) ? res : res?.data || [])),
      catchError((err) => {
        console.warn('[LikesService] Error obteniendo joyas olvidadas:', err);
        return of([]);
      }),
    );
  }

  /**
   * Recupera las canciones favoritas desde el backend (GET /likes) y actualiza el estado reactivo.
   */
  public fetchFavoritesFromBackend(params?: GetLikesParams): Observable<LikedSong[]> {
    return this.getLikedTracks(params).pipe(
      map((remoteLikes: any) => {
        const list = Array.isArray(remoteLikes) ? remoteLikes : remoteLikes?.data;
        if (!Array.isArray(list)) return [];
        return list.map((item: any) => toLikedSong(item));
      }),
      tap((songs) => {
        this._likedSongs.set(songs);
        this._hasLoaded.set(true);
        this._optimisticDelta.set(0);
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
  public getListLikes(params?: GetLikesParams): Observable<LikedSong[]> {
    return this.fetchFavoritesFromBackend(params);
  }

  /**
   * Limpia el estado reactivo de me gusta en memoria.
   */
  public clearAll(): void {
    this._likedSongs.set([]);
    this._hasLoaded.set(true);
    this._optimisticDelta.set(0);
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
