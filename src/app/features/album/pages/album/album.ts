import { Component, computed, inject } from '@angular/core';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of, tap } from 'rxjs';
import { Search } from '../../../search/search';
import { Location } from '@angular/common';
import { AlbumResponse, Song } from '../../../../core/models/album.model';
import { DetailInfoAlbum } from '../../components/detail-info-album/detail-info-album';
import { DetailSongAlbum } from '../../components/detail-song-album/detail-song-album';
import { PlaybackService } from '../../../../core/services/playback.service';
import { QueueItem } from '../../../../core/models/queue.model';
import { LucideArrowLeft, LucideClock, LucideDisc, LucideMusic } from '@lucide/angular';

export interface StoredAlbumData {
  albumId?: string;
  playlistId?: string;
  videoId?: string;
  name?: string;
  artist?: string;
  thumbnail?: string;
}

@Component({
  imports: [
    Search,
    DetailInfoAlbum,
    DetailSongAlbum,
    LucideArrowLeft,
    LucideDisc,
    LucideClock,
    LucideMusic,
  ],
  selector: 'app-album',
  styleUrl: './album.css',
  templateUrl: './album.html',
})
export class Album {
  private readonly _youtubeService = inject(Dashboard);
  private readonly _globalStorage = inject(GlobalStorage);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _location = inject(Location);

  public $albumInfo = this._globalStorage.getStore<StoredAlbumData>('album');
  public $albumId = computed(() => this.$albumInfo()?.albumId || this.$albumInfo()?.playlistId || '');

  public resourceAlbum = rxResource({
    params: () => this.$albumId(),
    stream: ({ params: albumId }) => {
      if (!albumId) {
        return of({} as AlbumResponse);
      }
      return this._youtubeService.getAlbumById(albumId).pipe(
        tap((res) => {
          if (!res || !res.songs || res.songs.length === 0) {
            this.fallbackPlayTrack();
          }
        }),
        catchError((err) => {
          console.error(
            'El servicio de álbum falló, intentando reproducir canción con ID almacenado:',
            err,
          );
          this.fallbackPlayTrack();
          return of({} as AlbumResponse);
        }),
      );
    },

    defaultValue: {} as AlbumResponse,
  });

  public fallbackPlayTrack(): void {
    const albumInfo = this.$albumInfo();
    const playlistInfo = this._globalStorage.getSnapshot<StoredAlbumData>('playlist');

    const rawId =
      albumInfo?.albumId ||
      albumInfo?.playlistId ||
      albumInfo?.videoId ||
      playlistInfo?.albumId ||
      playlistInfo?.playlistId ||
      playlistInfo?.videoId ||
      this.$albumId();

    if (!rawId) return;

    const cleanId = rawId.replace(/^RDAM(?:VM|PL)/, '');
    if (!cleanId) return;

    this._playbackService.playSingle({
      videoId: cleanId,
      name: albumInfo?.name || playlistInfo?.name || '',
      artist: albumInfo?.artist || playlistInfo?.artist || '',
      thumbnail: albumInfo?.thumbnail || playlistInfo?.thumbnail || '',
    });
  }

  public totalDuration = computed(() => {
    const songs = this.resourceAlbum.value()?.songs;
    if (!songs || songs.length === 0) return 0;
    return songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  });

  public goBack(): void {
    this._location.back();
  }

  public onPlaySong(song: Song, index: number): void {
    const album = this.resourceAlbum.value();
    if (!album?.songs?.length) return;

    const items: QueueItem[] = album.songs.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || album.artist?.name || '',
      duration: s.duration,
      thumbnail: s.thumbnails?.[0]?.url || album.thumbnails?.[0]?.url || '',
    }));

    this._playbackService.playQueue(items, index, album.name);
  }

  public onPlayAll(): void {
    const album = this.resourceAlbum.value();
    if (!album?.songs?.length) return;
    this.onPlaySong(album.songs[0], 0);
  }

  public onPlayShuffle(): void {
    const album = this.resourceAlbum.value();
    if (!album?.songs?.length) return;

    const items: QueueItem[] = album.songs.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || album.artist?.name || '',
      duration: s.duration,
      thumbnail: s.thumbnails?.[0]?.url || album.thumbnails?.[0]?.url || '',
    }));

    const randomIndex = Math.floor(Math.random() * items.length);
    this._playbackService.playQueue(items, randomIndex, album.name);
    if (!this._playbackService.$isShuffle()) {
      this._playbackService.toggleShuffle();
    }
  }
}
