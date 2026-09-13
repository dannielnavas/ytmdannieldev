import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ColorThiefService } from '@soarlin/angular-color-thief';
import { ImageHelperService } from '../../../../core/services/image-helper.service';
import {
  LucideArrowLeft,
  LucideChevronLeft,
  LucideChevronRight,
  LucideDisc,
  LucideListMusic,
  LucideMusic,
  LucidePlay,
  LucideShuffle,
  LucideSparkles,
  LucideUser,
} from '@lucide/angular';
import { GlobalStorage } from '../../../../core/store/global-storage';
import {
  Album2,
  Artist2,
  IListSearch,
  Playlist,
  Song,
  Thumbnail,
} from '../../../../core/models/list-search';
import { DetailSong } from '../../components/detail-song/detail-song';
import { Search } from '../../../search/search';
import { PlaybackService } from '../../../../core/services/playback.service';
import { QueueItem } from '../../../../core/models/queue.model';

@Component({
  imports: [
    DetailSong,
    Search,
    LucideArrowLeft,
    LucideChevronLeft,
    LucideChevronRight,
    LucideDisc,
    LucideMusic,
    LucidePlay,
    LucideListMusic,
    LucideUser,
    LucideShuffle,
    LucideSparkles,
  ],
  selector: 'app-list-search',
  styleUrl: './list-search.css',
  templateUrl: './list-search.html',
})
export class ListSearch {
  private readonly _globalStore = inject(GlobalStorage);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _colorThief = inject(ColorThiefService);
  private readonly _imageHelper = inject(ImageHelperService);

  public $searchResult = this._globalStore.getStore<IListSearch | IListSearch[]>('search');

  constructor() {
    effect(() => {
      const res = this.$searchResult();
      if (res) {
        this._imageHelper.reset();
      }
    });
  }

  public albums = computed<Album2[]>(() => {
    const res = this.$searchResult();
    if (!res || Array.isArray(res)) return [];
    return res.albums ?? [];
  });

  public songs = computed<Song[]>(() => {
    const res = this.$searchResult();
    if (!res) return [];
    if (Array.isArray(res)) return res as unknown as Song[];
    return res.songs ?? [];
  });

  public playlists = computed<Playlist[]>(() => {
    const res = this.$searchResult();
    if (!res || Array.isArray(res)) return [];
    return res.playlists ?? [];
  });

  public artists = computed<Artist2[]>(() => {
    const res = this.$searchResult();
    if (!res || Array.isArray(res)) return [];
    return res.artists ?? [];
  });

  public selectedArtistIndex = signal<number>(0);

  public currentArtist = computed<Artist2 | null>(() => {
    const list = this.artists();
    if (!list.length) return null;
    const idx = this.selectedArtistIndex();
    return list[idx] ?? list[0];
  });

  // --- Manejo de miniaturas con fallback secuencial para el Artista Principal ---
  public $artistThumbnailIndex = linkedSignal({
    source: this.currentArtist,
    computation: () => 0,
  });

  public $artistHasImageError = linkedSignal({
    source: this.currentArtist,
    computation: () => false,
  });

  public artistThumbnailUrl = computed(() => {
    if (this.$artistHasImageError()) return '';
    const thumbs = this.currentArtist()?.thumbnails;
    if (!thumbs || thumbs.length === 0) return '';
    const index = this.$artistThumbnailIndex();
    if (index >= 0 && index < thumbs.length) {
      return thumbs[index]?.url || '';
    }
    return '';
  });

  public onArtistImageError(): void {
    const currentUrl = this.artistThumbnailUrl();
    this._imageHelper.recordFailure(currentUrl);

    const currentIndex = this.$artistThumbnailIndex();
    const thumbs = this.currentArtist()?.thumbnails;
    if (this._imageHelper.shouldRetry(currentIndex) && thumbs && currentIndex + 1 < thumbs.length) {
      this.$artistThumbnailIndex.set(currentIndex + 1);
    } else {
      this.$artistHasImageError.set(true);
    }
  }

  // --- Manejo de miniaturas con fallback secuencial para Álbumes ---
  private readonly _albumThumbIndexes = signal<Record<string, number>>({});
  private readonly _albumImageErrors = signal<Record<string, boolean>>({});

  public getAlbumThumbnail(album: Album2): string {
    const id = album.albumId || album.playlistId;
    if (this._albumImageErrors()[id]) return '';
    const thumbs = album.thumbnails;
    if (!thumbs || thumbs.length === 0) return '';
    const index = this._albumThumbIndexes()[id] ?? 0;
    if (index >= 0 && index < thumbs.length) {
      return thumbs[index]?.url || '';
    }
    return '';
  }

  public onAlbumImageError(album: Album2): void {
    const id = album.albumId || album.playlistId;
    const currentUrl = this.getAlbumThumbnail(album);
    this._imageHelper.recordFailure(currentUrl);

    const currentIndex = this._albumThumbIndexes()[id] ?? 0;
    const thumbs = album.thumbnails;
    if (this._imageHelper.shouldRetry(currentIndex) && thumbs && currentIndex + 1 < thumbs.length) {
      this._albumThumbIndexes.update((map) => ({ ...map, [id]: currentIndex + 1 }));
    } else {
      this._albumImageErrors.update((map) => ({ ...map, [id]: true }));
    }
  }

  // --- Manejo de miniaturas con fallback secuencial para Playlists ---
  private readonly _playlistThumbIndexes = signal<Record<string, number>>({});
  private readonly _playlistImageErrors = signal<Record<string, boolean>>({});

  public getPlaylistThumbnail(playlist: Playlist): string {
    const id = playlist.playlistId;
    if (this._playlistImageErrors()[id]) return '';
    const thumbs = playlist.thumbnails;
    if (!thumbs || thumbs.length === 0) return '';
    const index = this._playlistThumbIndexes()[id] ?? 0;
    if (index >= 0 && index < thumbs.length) {
      return thumbs[index]?.url || '';
    }
    return '';
  }

  public onPlaylistImageError(playlist: Playlist): void {
    const id = playlist.playlistId;
    const currentUrl = this.getPlaylistThumbnail(playlist);
    this._imageHelper.recordFailure(currentUrl);

    const currentIndex = this._playlistThumbIndexes()[id] ?? 0;
    const thumbs = playlist.thumbnails;
    if (this._imageHelper.shouldRetry(currentIndex) && thumbs && currentIndex + 1 < thumbs.length) {
      this._playlistThumbIndexes.update((map) => ({ ...map, [id]: currentIndex + 1 }));
    } else {
      this._playlistImageErrors.update((map) => ({ ...map, [id]: true }));
    }
  }

  // --- Manejo de miniaturas con fallback secuencial para Otros Artistas ---
  private readonly _otherArtistThumbIndexes = signal<Record<string, number>>({});
  private readonly _otherArtistImageErrors = signal<Record<string, boolean>>({});

  public getOtherArtistThumbnail(artist: Artist2): string {
    const key = artist.artistId || artist.name;
    if (this._otherArtistImageErrors()[key]) return '';
    const thumbs = artist.thumbnails;
    if (!thumbs || thumbs.length === 0) return '';
    const index = this._otherArtistThumbIndexes()[key] ?? 0;
    if (index >= 0 && index < thumbs.length) {
      return thumbs[index]?.url || '';
    }
    return '';
  }

  public onOtherArtistImageError(artist: Artist2): void {
    const key = artist.artistId || artist.name;
    const currentUrl = this.getOtherArtistThumbnail(artist);
    this._imageHelper.recordFailure(currentUrl);

    const currentIndex = this._otherArtistThumbIndexes()[key] ?? 0;
    const thumbs = artist.thumbnails;
    if (this._imageHelper.shouldRetry(currentIndex) && thumbs && currentIndex + 1 < thumbs.length) {
      this._otherArtistThumbIndexes.update((map) => ({ ...map, [key]: currentIndex + 1 }));
    } else {
      this._otherArtistImageErrors.update((map) => ({ ...map, [key]: true }));
    }
  }

  // --- ColorThief y Estilos Dinámicos ---
  public $dominantColor = linkedSignal({
    source: this.currentArtist,
    computation: () => null as [number, number, number] | null,
  });

  public $palette = linkedSignal({
    source: this.currentArtist,
    computation: () => null as [number, number, number][] | null,
  });

  public onImageLoad(img: HTMLImageElement): void {
    if (!img) return;
    try {
      const color = this._colorThief.getColor(img, 10);
      if (color && color.length === 3) {
        this.$dominantColor.set(color);
      }
      const palette = this._colorThief.getPalette(img, 5, 10);
      if (palette && palette.length > 0) {
        this.$palette.set(palette);
      }
    } catch (err) {
      console.warn('ColorThief: No se pudo extraer la paleta de la imagen:', err);
    }
  }

  public artistCardBgStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        background: `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.35) 0%, rgba(${r}, ${g}, ${b}, 0.1) 45%, rgba(12, 10, 21, 0.95) 100%)`,
        'border-color': `rgba(${r}, ${g}, ${b}, 0.35)`,
        'box-shadow': `0 20px 45px -15px rgba(${r}, ${g}, ${b}, 0.35)`,
      };
    }
    return {};
  });

  public artistGlowStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.45) 0%, rgba(${r}, ${g}, ${b}, 0) 70%)`;
    }
    return 'radial-gradient(circle, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0) 70%)';
  });

  public artistRingStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        'border-color': `rgba(${r}, ${g}, ${b}, 0.6)`,
        'box-shadow': `0 0 25px rgba(${r}, ${g}, ${b}, 0.45)`,
      };
    }
    return {};
  });

  public actionButtonStyle = computed(() => {
    const color = this.$dominantColor();
    const palette = this.$palette();
    if (color && palette && palette.length > 1) {
      const [r1, g1, b1] = color;
      const [r2, g2, b2] = palette[1];
      return {
        background: `linear-gradient(135deg, rgb(${r1}, ${g1}, ${b1}) 0%, rgb(${r2}, ${g2}, ${b2}) 100%)`,
        'box-shadow': `0 10px 25px -5px rgba(${r1}, ${g1}, ${b1}, 0.45)`,
      };
    } else if (color) {
      const [r, g, b] = color;
      return {
        background: `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgba(${r}, ${g}, ${b}, 0.85) 100%)`,
        'box-shadow': `0 10px 25px -5px rgba(${r}, ${g}, ${b}, 0.45)`,
      };
    }
    return {};
  });

  public artistBadgeStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        'background-color': `rgba(${r}, ${g}, ${b}, 0.25)`,
        'border-color': `rgba(${r}, ${g}, ${b}, 0.45)`,
        color: `rgb(${Math.min(255, r + 90)}, ${Math.min(255, g + 90)}, ${Math.min(255, b + 90)})`,
      };
    }
    return {};
  });

  public selectArtist(index: number): void {
    this.selectedArtistIndex.set(index);
  }

  public goBack(): void {
    this._location.back();
  }

  public openAlbum(album: Album2): void {
    const thumb = this.getAlbumThumbnail(album);
    if (album.albumId) {
      this._globalStore.setStore('album', {
        albumId: album.albumId,
        playlistId: album.playlistId || '',
        name: album.name,
        artist: album.artist?.name || '',
        thumbnail: thumb,
      });
      this._router.navigate(['/album']);
      return;
    }
    const targetId = album.playlistId;
    if (!targetId) return;
    this._globalStore.setStore('playlist', {
      playlistId: targetId,
      albumId: album.albumId || '',
      name: album.name,
      artist: album.artist?.name || '',
      thumbnail: thumb,
    });
    this._router.navigate(['/playlist']);
  }

  public openPlaylist(playlist: Playlist): void {
    if (!playlist?.playlistId) return;
    const thumb = this.getPlaylistThumbnail(playlist);
    this._globalStore.setStore('playlist', {
      playlistId: playlist.playlistId,
      name: playlist.name,
      artist: playlist.artist?.name || '',
      thumbnail: thumb,
    });
    this._router.navigate(['/playlist']);
  }

  public scrollAlbums(direction: 'left' | 'right', container: HTMLElement): void {
    const scrollAmount = 360;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }

  public scrollPlaylists(direction: 'left' | 'right', container: HTMLElement): void {
    const scrollAmount = 360;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }

  public onPlaySong(song: Song, index: number): void {
    const songList = this.songs();
    if (!songList.length) return;

    const items: QueueItem[] = songList.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || '',
      duration: s.duration,
      thumbnail: s.thumbnails?.[0]?.url || '',
    }));

    this._playbackService.playQueue(items, index, this.currentArtist()?.name || 'Búsqueda');
  }

  public playAllSongs(): void {
    const songList = this.songs();
    if (songList.length > 0) {
      this.onPlaySong(songList[0], 0);
    }
  }

  public shuffleAllSongs(): void {
    const songList = this.songs();
    if (!songList.length) return;

    const items: QueueItem[] = songList.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || '',
      duration: s.duration,
      thumbnail: s.thumbnails?.[0]?.url || '',
    }));

    const randomIndex = Math.floor(Math.random() * items.length);
    this._playbackService.playQueue(items, randomIndex, this.currentArtist()?.name || 'Búsqueda');
    if (!this._playbackService.$isShuffle()) {
      this._playbackService.toggleShuffle();
    }
  }
}
