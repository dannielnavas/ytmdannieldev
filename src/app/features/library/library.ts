import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  LucideDisc,
  LucideHeart,
  LucideListMusic,
  LucidePlay,
  LucideSearch,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { LikesService, LikedSong } from '../../core/services/likes.service';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { PlaybackService, parseDuration } from '../../core/services/playback.service';
import {
  DashboardAlbumItem,
  DashboardPlaylistItem,
  DashboardResponse,
} from '../../core/models/dashboard';
import { Header } from '../../shared/components/header/header';
import { DetailSongRow } from '../../shared/components/detail-song-row/detail-song-row';
import { ThumbnailUrlPipe } from '../../shared/pipes/thumbnail-url-pipe';
import { SourceSong } from '../../core/models/youtube';

export type LibraryTab = 'all' | 'likes' | 'playlists' | 'albums';

@Component({
  selector: 'app-library',
  imports: [
    FormsModule,
    Header,
    DetailSongRow,
    ThumbnailUrlPipe,
    LucideHeart,
    LucideListMusic,
    LucideDisc,
    LucidePlay,
    LucideSearch,
    LucideSparkles,
    LucideX,
  ],
  templateUrl: './library.html',
  styleUrl: './library.css',
})
export class Library {
  private readonly _likesService = inject(LikesService);
  private readonly _dashboardService = inject(Dashboard);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _router = inject(Router);

  public readonly activeTab = signal<LibraryTab>('all');
  public readonly searchQuery = signal<string>('');

  public readonly resourceLikes = rxResource({
    stream: () => this._likesService.getListLikes(),
    defaultValue: [] as LikedSong[],
  });

  public readonly resourceDashboard = rxResource({
    stream: () => this._dashboardService.getDashboard({ includeYoutube: true }),
    defaultValue: {
      hasPersonalData: false,
      activeView: 'youtube',
      personal: null,
      youtube: [],
    } as DashboardResponse,
  });

  public readonly likedSongs = computed<LikedSong[]>(() => {
    const remote = this.resourceLikes.value();
    if (Array.isArray(remote) && remote.length > 0) {
      return remote;
    }
    return this._likesService.$likedSongs();
  });

  public readonly playlists = computed<DashboardPlaylistItem[]>(() => {
    const dash = this.resourceDashboard.value();
    if (!dash?.youtube) return [];

    const list: DashboardPlaylistItem[] = [];
    const seen = new Set<string>();

    for (const section of dash.youtube) {
      for (const item of section.contents) {
        if (item?.type === 'PLAYLIST' && item.playlistId && !seen.has(item.playlistId)) {
          seen.add(item.playlistId);
          list.push(item);
        }
      }
    }
    return list;
  });

  public readonly albums = computed<DashboardAlbumItem[]>(() => {
    const dash = this.resourceDashboard.value();
    if (!dash?.youtube) return [];

    const list: DashboardAlbumItem[] = [];
    const seen = new Set<string>();

    for (const section of dash.youtube) {
      for (const item of section.contents) {
        if (item?.type === 'ALBUM') {
          const id = item.albumId || item.playlistId;
          if (id && !seen.has(id)) {
            seen.add(id);
            list.push(item);
          }
        }
      }
    }
    return list;
  });

  public readonly filteredLikedSongs = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const songs = this.likedSongs();
    if (!query) return songs;
    return songs.filter(
      (s) =>
        s.name?.toLowerCase().includes(query) ||
        (s.artist && s.artist.toLowerCase().includes(query)),
    );
  });

  public readonly filteredPlaylists = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.playlists();
    if (!query) return list;
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        (p.artist?.name && p.artist.name.toLowerCase().includes(query)),
    );
  });

  public readonly filteredAlbums = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.albums();
    if (!query) return list;
    return list.filter(
      (a) =>
        a.name?.toLowerCase().includes(query) ||
        (a.artist?.name && a.artist.name.toLowerCase().includes(query)),
    );
  });

  public setTab(tab: LibraryTab): void {
    this.activeTab.set(tab);
  }

  public clearSearch(): void {
    this.searchQuery.set('');
  }

  public playAllLikes(): void {
    const songs = this.filteredLikedSongs();
    if (songs.length === 0) return;

    this._playbackService.playQueue(
      songs.map((song) => ({
        id: song.videoId,
        videoId: song.videoId,
        name: song.name,
        artist: song.artist || '',
        duration: parseDuration(song.duration),
        thumbnail: song.thumbnailUrl,
      })),
      0,
      'Tus Me Gusta',
    );
  }

  public onPlaySong(song: LikedSong, index: number): void {
    const list = this.filteredLikedSongs();
    this._playbackService.playQueue(
      list.map((s) => ({
        id: s.videoId,
        videoId: s.videoId,
        name: s.name,
        artist: s.artist || '',
        duration: parseDuration(s.duration),
        thumbnail: s.thumbnailUrl,
      })),
      index,
      'Tus Me Gusta',
    );
  }

  public openPlaylist(id: string): void {
    if (!id) return;
    this._router.navigate(['/playlist', id]);
  }

  public openAlbum(album: DashboardAlbumItem): void {
    const targetId = album.albumId || album.playlistId;
    if (!targetId) return;
    this._router.navigate(['/album', targetId]);
  }

  public goToLikes(): void {
    this._router.navigate(['/likes']);
  }

  public toSourceSong(song: LikedSong): SourceSong {
    return {
      videoId: song.videoId,
      name: song.name,
      artist: { name: song.artist || '', artistId: null },
      duration: song.duration,
      thumbnails: song.thumbnailUrl ? [{ url: song.thumbnailUrl, width: 200, height: 200 }] : [],
    };
  }
}
