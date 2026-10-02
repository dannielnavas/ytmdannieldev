import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  LucideClock,
  LucideHeart,
  LucidePause,
  LucidePlay,
  LucideSearch,
  LucideShuffle,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { LikesService, LikedSong } from '../../core/services/likes.service';
import { PlaybackService, parseDuration } from '../../core/services/playback.service';
import { SourceSong } from '../../core/models/youtube';
import { DetailSongRow } from '../../shared/components/detail-song-row/detail-song-row';
import { Header } from '../../shared/components/header/header';

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
    LucideSparkles,
    LucideX,
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

  /** Recurso reactivo para cargar los favoritos */
  public resourceListLikes = rxResource({
    stream: () => this._likesService.getListLikes(),
    defaultValue: [] as LikedSong[],
  });

  /** Filtro de búsqueda rápida en la lista de favoritos */
  public readonly searchQuery = signal('');

  /** Lista base de canciones con like: toma los del servicio o el fallback local */
  public readonly baseLikedSongs = computed<LikedSong[]>(() => {
    const remote = this.resourceListLikes.value();
    if (Array.isArray(remote) && remote.length > 0) {
      return remote;
    }
    return this._likesService.$likedSongs();
  });

  /** Canciones normalizadas a `SourceSong` para usar con `DetailSongRow` y la cola */
  public readonly allSourceSongs = computed<SourceSong[]>(() => {
    return this.baseLikedSongs().map((item) => ({
      videoId: item.videoId,
      name: item.name || 'Canción sin título',
      artist: item.artist ? { name: item.artist, artistId: null } : null,
      duration: item.duration ?? null,
      thumbnails: item.thumbnailUrl ? [{ url: item.thumbnailUrl, width: 300, height: 300 }] : null,
    }));
  });

  /** Canciones filtradas por el término de búsqueda */
  public readonly songs = computed<SourceSong[]>(() => {
    const list = this.allSourceSongs();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;

    return list.filter(
      (song) =>
        song.name.toLowerCase().includes(query) ||
        (song.artist?.name && song.artist.name.toLowerCase().includes(query)),
    );
  });

  /** Total de canciones en la lista */
  public readonly totalCount = computed(() => this.allSourceSongs().length);

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
      .map((s) => s.thumbnails?.[0]?.url)
      .filter((url): url is string => Boolean(url))
      .slice(0, 4);
  });

  /** Indica si la cola actual reproduciéndose proviene de Tus Me Gusta */
  public readonly isPlayingLikes = computed(() => {
    return (
      this._playbackService.$isPlaying() && this._playbackService.$sourceTitle() === 'Tus Me Gusta'
    );
  });

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
    const list = this.songs();
    if (!list.length) return;
    this._playbackService.playShuffled(list, {
      size: 800,
      sourceTitle: 'Tus Me Gusta',
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

  public clearSearch(): void {
    this.searchQuery.set('');
  }

  public goBack(): void {
    this._location.back();
  }

  public goToExplore(): void {
    this._router.navigate(['/home']);
  }
}
