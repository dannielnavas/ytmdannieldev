import { Component, computed, inject } from '@angular/core';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of, tap } from 'rxjs';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { Location } from '@angular/common';
import { Search } from '../../../search/search';
import { PlaylistModel, SongsList } from '../../../../core/models/playlist.model';
import { DetailInfoPlaylist } from '../../components/detail-info-playlist/detail-info-playlist';
import { DetailSongPlaylist } from '../../components/detail-song-playlist/detail-song-playlist';
import { PlaybackService } from '../../../../core/services/playback.service';
import { QueueItem } from '../../../../core/models/queue.model';
import {
  LucideArrowLeft,
  LucideClock,
  LucideListMusic,
  LucideMusic,
} from '@lucide/angular';
import { getHighResThumbnail } from '../../../../core/services/image-helper.service';

export interface StoredPlaylistData {
  playlistId?: string;
  albumId?: string;
  videoId?: string;
  name?: string;
  artist?: string;
  thumbnail?: string;
}

@Component({
  imports: [
    Search,
    DetailInfoPlaylist,
    DetailSongPlaylist,
    LucideArrowLeft,
    LucideListMusic,
    LucideClock,
    LucideMusic,
  ],
  selector: 'app-playlist',
  styleUrl: './playlist.css',
  templateUrl: './playlist.html',
})
export class Playlist {
  private readonly _youtubeService = inject(Dashboard);
  private readonly _globalStorage = inject(GlobalStorage);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _location = inject(Location);

  public $playlistInfo = this._globalStorage.getStore<StoredPlaylistData>('playlist');
  public $playlistId = computed(() => this.$playlistInfo()?.playlistId || this.$playlistInfo()?.albumId || '');

  public resourceGetPlaylist = rxResource({
    params: () => this.$playlistId(),
    stream: ({ params: id }) => {
      if (!id) {
        return of({} as unknown as PlaylistModel);
      }
      return this._youtubeService.getPlaylist(id).pipe(
        tap((res) => {
          if (!res || !res.songsList || res.songsList.length === 0) {
            this.fallbackPlayTrack();
          }
        }),
        catchError((err) => {
          console.error(
            'El servicio de playlist falló, intentando reproducir canción con ID almacenado:',
            err,
          );
          this.fallbackPlayTrack();
          return of({} as unknown as PlaylistModel);
        }),
      );
    },
    defaultValue: {} as unknown as PlaylistModel,
  });

  public fallbackPlayTrack(): void {
    const playlistInfo = this.$playlistInfo();
    const albumInfo = this._globalStorage.getSnapshot<StoredPlaylistData>('album');

    const rawId =
      playlistInfo?.playlistId ||
      playlistInfo?.albumId ||
      playlistInfo?.videoId ||
      albumInfo?.playlistId ||
      albumInfo?.albumId ||
      albumInfo?.videoId ||
      this.$playlistId();

    if (!rawId) return;

    const cleanId = rawId.replace(/^RDAM(?:VM|PL)/, '');
    if (!cleanId) return;

    this._playbackService.playSingle({
      videoId: cleanId,
      name: playlistInfo?.name || albumInfo?.name || '',
      artist: playlistInfo?.artist || albumInfo?.artist || '',
      thumbnail: getHighResThumbnail(playlistInfo?.thumbnail || albumInfo?.thumbnail || '', 800),
    });
  }

  public goBack(): void {
    this._location.back();
  }

  public onPlaySong(song: SongsList, index: number): void {
    const playlist = this.resourceGetPlaylist.value();
    if (!playlist?.songsList?.length) return;

    const items: QueueItem[] = playlist.songsList.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || '',
      duration: s.duration,
      thumbnail: getHighResThumbnail(
        s.thumbnails?.[s.thumbnails.length - 1]?.url || s.thumbnails?.[0]?.url || '',
        800,
      ),
    }));

    this._playbackService.playQueue(items, index, playlist.infoPlaylist?.name);
  }

  public onPlayAll(): void {
    const playlist = this.resourceGetPlaylist.value();
    if (!playlist?.songsList?.length) return;
    this.onPlaySong(playlist.songsList[0], 0);
  }

  public onPlayShuffle(): void {
    const playlist = this.resourceGetPlaylist.value();
    if (!playlist?.songsList?.length) return;

    const items: QueueItem[] = playlist.songsList.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || '',
      duration: s.duration,
      thumbnail: getHighResThumbnail(
        s.thumbnails?.[s.thumbnails.length - 1]?.url || s.thumbnails?.[0]?.url || '',
        800,
      ),
    }));

    // Iniciar desde un índice aleatorio o mezclar la cola
    const randomIndex = Math.floor(Math.random() * items.length);
    this._playbackService.playQueue(items, randomIndex, playlist.infoPlaylist?.name);
    if (!this._playbackService.$isShuffle()) {
      this._playbackService.toggleShuffle();
    }
  }
}
