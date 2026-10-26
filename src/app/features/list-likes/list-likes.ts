import { Component, computed, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import {
  LucideArrowUpDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideHeart,
  LucideLoader2,
  LucidePause,
  LucidePlay,
  LucideSearch,
  LucideShuffle,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { LikesService, LikedSong, toLikedSong } from '../../core/services/likes.service';
import { PlaybackService, parseDuration } from '../../core/services/playback.service';
import { SourceSong } from '../../core/models/youtube';
import { GetLikesParams, PaginatedLikesResponse } from '../../core/models/likes.model';
import { DetailSongRow } from '../../shared/components/detail-song-row/detail-song-row';
import { Header } from '../../shared/components/header/header';

export type LikedSortField = 'likedAt' | 'title' | 'artist' | 'duration';
export type LikedSortOrder = 'ASC' | 'DESC';

@Component({
  selector: 'app-list-likes',
  imports: [
    FormsModule,
    DetailSongRow,
    LucideHeart,
    LucidePlay,
    LucidePause,
    LucideShuffle,
    LucideClock,
    LucideSearch,
    LucideX,
    LucideSparkles,
    LucideArrowUpDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideLoader2,
    Header,
  ],
  templateUrl: './list-likes.html',
  styleUrl: './list-likes.css',
})
export class ListLikes {
  private readonly _likesService = inject(LikesService);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _location = inject(Location);
  private readonly _router = inject(Router);

  /** Filtro de búsqueda en tiempo real */
  public readonly searchQuery = signal('');

  /** Campo y orden para la ordenación */
  public readonly sortBy = signal<LikedSortField>('likedAt');
  public readonly sortOrder = signal<LikedSortOrder>('DESC');

  /** Paginación */
  public readonly page = signal(1);
  public readonly limit = signal(30);

  /** Estado de carga de la radio */
  public readonly isLoadingRadio = signal(false);

  constructor() {
    // Si al desmarcar una canción optimista el número de páginas disminuye, ajustar la página
    effect(() => {
      const maxPages = this.totalPages();
      if (this.page() > maxPages) {
        this.page.set(maxPages);
      }
    });
  }

  /** Recurso reactivo para cargar los favoritos */
  public resourceListLikes = rxResource({
    stream: () =>
      this._likesService.getListLikes().pipe(
        tap((res: any) => {
          const list = Array.isArray(res) ? res : res?.data;
          if (Array.isArray(list) && list.length > 0) {
            if (this._likesService.$likedCount() === 0 && !this._likesService.$hasLoaded()) {
              this._likesService.setLocalSongs(list.map((item) => toLikedSong(item)));
            }
          }
        }),
      ),
    defaultValue: [] as any,
  });

  public readonly rawRemoteData = computed(() => {
    const val = this.resourceListLikes.value();
    if (!val) return null;
    if (Array.isArray(val)) {
      return { data: val as any[], meta: null };
    }
    if (val && typeof val === 'object' && 'data' in val && Array.isArray((val as any).data)) {
      return val as PaginatedLikesResponse;
    }
    return null;
  });

  /** Lista base de canciones con like: reactiva y sincronizada optimistamente con el servicio */
  public readonly baseLikedSongs = computed<LikedSong[]>(() => {
    const serviceSongs = this._likesService.$likedSongs();
    const likedIds = this._likesService.$likedIds();
    const hasLoaded = this._likesService.$hasLoaded();

    const remote = this.rawRemoteData();
    if (remote?.data && remote.data.length > 0) {
      const remoteMapped = remote.data.map((item) => toLikedSong(item));
      const remoteIds = new Set(remoteMapped.map((s) => s.videoId));

      // 1. Canciones agregadas optimistamente desde el servicio que no estaban en la respuesta remota
      const newlyLikedInService = serviceSongs.filter((s) => !remoteIds.has(s.videoId));

      // 2. Canciones remotas que aún conservan like (excluye optimistamente las que se desmarcaron)
      const remainingRemote = remoteMapped.filter((s) =>
        hasLoaded ? likedIds.has(s.videoId) : true,
      );

      return [...newlyLikedInService, ...remainingRemote];
    }

    return serviceSongs;
  });

  /** Canciones normalizadas a `SourceSong` para usar con `DetailSongRow` y la cola */
  public readonly allSourceSongs = computed<SourceSong[]>(() => {
    return this.baseLikedSongs().map((item) => {
      const fallbackUrl = item.videoId
        ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
        : '';
      const mainUrl = item.thumbnailUrl || fallbackUrl;
      const thumbnails = [];
      if (fallbackUrl) {
        thumbnails.push({ url: fallbackUrl, width: 480, height: 360 });
      }
      if (mainUrl && mainUrl !== fallbackUrl) {
        thumbnails.push({ url: mainUrl, width: 800, height: 800 });
      }

      return {
        videoId: item.videoId,
        name: item.name || 'Canción sin título',
        artist: item.artist ? { name: item.artist, artistId: null } : null,
        duration: item.duration ?? null,
        thumbnails: thumbnails.length > 0 ? thumbnails : null,
      };
    });
  });

  /** Canciones filtradas y ordenadas (fallback client-side si el backend devuelve array completo) */
  public readonly filteredSortedSongs = computed<SourceSong[]>(() => {
    const list = this.allSourceSongs();
    const isServerPaginated = Boolean(this.rawRemoteData()?.meta);
    if (isServerPaginated) {
      return list;
    }

    const query = this.searchQuery().trim().toLowerCase();
    let result = query
      ? list.filter(
          (song) =>
            song.name.toLowerCase().includes(query) ||
            (song.artist?.name && song.artist.name.toLowerCase().includes(query)),
        )
      : [...list];

    const sort = this.sortBy();
    const order = this.sortOrder();
    result.sort((a, b) => {
      let comp = 0;
      if (sort === 'title') {
        comp = (a.name || '').localeCompare(b.name || '');
      } else if (sort === 'artist') {
        comp = (a.artist?.name || '').localeCompare(b.artist?.name || '');
      } else if (sort === 'duration') {
        const da = parseDuration(a.duration) ?? 0;
        const db = parseDuration(b.duration) ?? 0;
        comp = da - db;
      }
      return order === 'ASC' ? comp : -comp;
    });

    return result;
  });

  /** Canciones de la página actual para renderizar */
  public readonly songs = computed<SourceSong[]>(() => {
    const list = this.filteredSortedSongs();
    const isServerPaginated = Boolean(this.rawRemoteData()?.meta);
    if (isServerPaginated) {
      return list;
    }
    const start = (this.page() - 1) * this.limit();
    return list.slice(start, start + this.limit());
  });

  /** Total de canciones en la lista */
  public readonly totalCount = computed(() => {
    const meta = this.rawRemoteData()?.meta;
    if (meta && typeof meta.total === 'number') {
      const initialTotal = meta.total;
      const initialCount = this.rawRemoteData()?.data?.length ?? 0;
      const currentCount = this.baseLikedSongs().length;
      return Math.max(0, initialTotal + (currentCount - initialCount));
    }
    return this.filteredSortedSongs().length;
  });

  /** Total de páginas calculadas */
  public readonly totalPages = computed(() => {
    const meta = this.rawRemoteData()?.meta;
    if (meta && typeof meta.totalPages === 'number') {
      return Math.max(1, Math.ceil(this.totalCount() / this.limit()));
    }
    return Math.max(1, Math.ceil(this.filteredSortedSongs().length / this.limit()));
  });

  /** Suma estimada de la duración total en segundos */
  public readonly totalDurationSeconds = computed(() => {
    return this.allSourceSongs().reduce((acc, song) => {
      const d = parseDuration(song.duration);
      return acc + (d ?? 0);
    }, 0);
  });

  /** Formato legible de la duración total (ej. "1 h 15 min" o "42 min") */
  public readonly formattedTotalDuration = computed(() => {
    const totalSecs = this.totalDurationSeconds();
    if (!totalSecs || totalSecs <= 0) return '';
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  });

  /** Miniaturas de las canciones favoritas más recientes para el mosaico del hero */
  public readonly recentThumbnails = computed(() => {
    return this.allSourceSongs()
      .map((s) => s.thumbnails?.[s.thumbnails.length - 1]?.url || s.thumbnails?.[0]?.url)
      .filter((url): url is string => Boolean(url))
      .slice(0, 4);
  });

  public onThumbnailError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.opacity = '0.5';
    }
  }

  /** Indica si la cola actual reproduciéndose proviene de Tus Me Gusta */
  public readonly isPlayingLikes = computed(() => {
    return (
      this._playbackService.$isPlaying() && this._playbackService.$sourceTitle() === 'Tus Me Gusta'
    );
  });

  public setSortField(field: LikedSortField): void {
    if (this.sortBy() === field) {
      this.sortOrder.update((curr) => (curr === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      this.sortBy.set(field);
      this.sortOrder.set('ASC');
    }
    this.page.set(1);
  }

  public toggleSortOrder(): void {
    this.sortOrder.update((curr) => (curr === 'ASC' ? 'DESC' : 'ASC'));
    this.page.set(1);
  }

  public onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.page.set(1);
  }

  public clearSearch(): void {
    this.searchQuery.set('');
    this.page.set(1);
  }

  public prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  public nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  public goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
    }
  }

  /**
   * Reproduce una canción específica de la lista, encolando todas las canciones
   * de favoritos a partir de ese índice y mostrando la PlayerBar.
   */
  public onPlaySong(song: SourceSong, index: number): void {
    const list = this.songs();
    if (!list.length) return;

    const queueItems = this._playbackService.toQueueItems(list, { size: 800 });
    this._playbackService.playQueue(queueItems, index, 'Tus Me Gusta');
  }

  /**
   * Reproduce toda la lista de canciones favoritas desde el principio.
   */
  public onPlayAll(): void {
    const list = this.songs();
    if (!list.length) return;
    this.onPlaySong(list[0], 0);
  }

  /**
   * Reproduce la lista de favoritos en modo aleatorio (shuffle).
   */
  public onPlayShuffle(): void {
    const list = this.filteredSortedSongs().length > 0 ? this.filteredSortedSongs() : this.songs();
    if (!list.length) return;
    this._playbackService.playShuffled(list, {
      size: 800,
      sourceTitle: 'Tus Me Gusta',
    });
  }

  /**
   * Inicia el mix infinito o radio basada en favoritos (GET /likes/radio?limit=25).
   */
  public onPlayLikedRadio(): void {
    if (this.isLoadingRadio()) return;
    this.isLoadingRadio.set(true);

    this._likesService.getLikedRadio(25).subscribe({
      next: (tracks) => {
        this.isLoadingRadio.set(false);
        if (tracks && tracks.length > 0) {
          const queueItems = this._playbackService.toQueueItems(tracks as any[], { size: 800 });
          this._playbackService.playQueue(queueItems, 0, 'Radio de Likes');
        } else {
          this.onPlayShuffle();
        }
      },
      error: () => {
        this.isLoadingRadio.set(false);
        this.onPlayShuffle();
      },
    });
  }

  /**
   * Alterna play / pause de la lista de favoritos si ya está activa,
   * o inicia la reproducción desde el principio.
   */
  public togglePlayLikes(): void {
    if (this.isPlayingLikes()) {
      this._playbackService.pause();
    } else if (
      this._playbackService.$sourceTitle() === 'Tus Me Gusta' &&
      this._playbackService.$stream()
    ) {
      this._playbackService.play();
    } else {
      this.onPlayAll();
    }
  }

  public goBack(): void {
    this._location.back();
  }

  public goToExplore(): void {
    this._router.navigate(['/home']);
  }
}

