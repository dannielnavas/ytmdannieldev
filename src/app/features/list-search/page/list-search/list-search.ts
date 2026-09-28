import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { CoverPalette } from '../../../../core/services/cover-palette.service';
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
import { SearchStore } from '../../../../core/store/search-store';
import {
  SearchAlbum,
  SearchArtist,
  SearchPlaylist,
  Song,
} from '../../../../core/models/list-search';
import { Thumbnail } from '../../../../core/services/thumbnail';
import { DetailSongRow } from '../../../../shared/components/detail-song-row/detail-song-row';
import { Search } from '../../../search/search';
import { PlaybackService } from '../../../../core/services/playback.service';

@Component({
  imports: [
    DetailSongRow,
    Thumbnail,
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
  private readonly _searchStore = inject(SearchStore);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _cover = inject(CoverPalette);
  private readonly _imageHelper = inject(ImageHelperService);

  /** Resultado tipado, no `Record<string, any>`. */
  public readonly $searchResult = this._searchStore.result;

  constructor() {
    effect(() => {
      if (this.$searchResult()) {
        // Las URLs marcadas como fallidas caducan al cambiar de búsqueda.
        this._imageHelper.reset();
      }
    });
  }

  public albums = computed<SearchAlbum[]>(() => this.$searchResult()?.albums ?? []);
  public songs = computed<Song[]>(() => this.$searchResult()?.songs ?? []);
  public playlists = computed<SearchPlaylist[]>(() => this.$searchResult()?.playlists ?? []);
  public artists = computed<SearchArtist[]>(() => this.$searchResult()?.artists ?? []);

  public selectedArtistIndex = signal<number>(0);

  public currentArtist = computed<SearchArtist | null>(() => {
    const list = this.artists();
    if (!list.length) return null;
    return list[this.selectedArtistIndex()] ?? list[0];
  });

  public readonly queueTitle = computed(() => this.currentArtist()?.name || 'Búsqueda');

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
    const { color, palette } = this._cover.extract(img);
    this.$dominantColor.set(color);
    this.$palette.set(palette);
  }

  public artistCardBgStyle = computed(() => {
    const color = this.$dominantColor();
    if (!color) {
      return {};
    }
    const [r, g, b] = color;
    return {
      background: `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.35) 0%, rgba(${r}, ${g}, ${b}, 0.1) 45%, rgba(12, 10, 21, 0.95) 100%)`,
      'border-color': `rgba(${r}, ${g}, ${b}, 0.35)`,
      'box-shadow': `0 20px 45px -15px rgba(${r}, ${g}, ${b}, 0.35)`,
    };
  });

  public artistGlowStyle = computed(() => this._cover.glow(this.$dominantColor(), 0.45));

  public artistRingStyle = computed(() => {
    const color = this.$dominantColor();
    if (!color) {
      return {};
    }
    const [r, g, b] = color;
    return {
      'border-color': `rgba(${r}, ${g}, ${b}, 0.6)`,
      'box-shadow': `0 0 25px rgba(${r}, ${g}, ${b}, 0.45)`,
    };
  });

  public actionButtonStyle = computed(() => {
    const style = this._cover.playButton(this.$dominantColor(), this.$palette() ?? []);
    return Object.fromEntries(
      Object.entries(style).map(([key, value]) => [key, value.replace('0.5)', '0.45)')]),
    );
  });

  public artistBadgeStyle = computed(() => this._cover.badge(this.$dominantColor(), 90));

  public selectArtist(index: number): void {
    this.selectedArtistIndex.set(index);
  }

  public goBack(): void {
    this._location.back();
  }

  /**
   * El id viaja en la URL, así que ya no hace falta guardar nada en un store
   * global: la página de destino vuelve a pedir los datos por su cuenta.
   */
  public openAlbum(album: SearchAlbum): void {
    const targetId = album.albumId || album.playlistId;
    if (!targetId) return;
    this._router.navigate(['/album', targetId]);
  }

  public openPlaylist(playlist: SearchPlaylist): void {
    if (!playlist?.playlistId) return;
    this._router.navigate(['/playlist', playlist.playlistId]);
  }

  public scrollAlbums(direction: 'left' | 'right', container: HTMLElement): void {
    container.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
  }

  public scrollPlaylists(direction: 'left' | 'right', container: HTMLElement): void {
    container.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
  }

  public onPlaySong(song: Song, index: number): void {
    const songList = this.songs();
    if (!songList.length) return;

    this._playbackService.playQueue(
      this._playbackService.toQueueItems(songList, { size: 800 }),
      index,
      this.queueTitle(),
    );
  }

  public playAllSongs(): void {
    const songList = this.songs();
    if (songList.length) {
      this.onPlaySong(songList[0], 0);
    }
  }

  public shuffleAllSongs(): void {
    const songList = this.songs();
    if (!songList.length) return;

    this._playbackService.playShuffled(songList, {
      size: 800,
      sourceTitle: this.queueTitle(),
    });
  }
}
