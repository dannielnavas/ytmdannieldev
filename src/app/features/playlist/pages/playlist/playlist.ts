import { Component, computed, inject, input } from '@angular/core';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of, tap } from 'rxjs';
import { Location } from '@angular/common';
import { Search } from '../../../search/search';
import { PlaylistModel, Song } from '../../../../core/models/playlist.model';
import { DetailHero } from '../../../../shared/components/detail-hero/detail-hero';
import { DetailSongRow } from '../../../../shared/components/detail-song-row/detail-song-row';
import { PlaybackService } from '../../../../core/services/playback.service';
import { LucideArrowLeft, LucideClock, LucideListMusic, LucideMusic } from '@lucide/angular';

@Component({
  imports: [
    Search,
    DetailHero,
    DetailSongRow,
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
  private readonly _playbackService = inject(PlaybackService);
  private readonly _location = inject(Location);

  /** Inyectado desde `:playlistId` por `withComponentInputBinding()`. */
  public readonly playlistId = input<string>('');

  public readonly $playlistId = computed(() => this.playlistId().replace(/^RDAM(?:VM|PL)/, ''));

  public resourceGetPlaylist = rxResource({
    params: () => this.$playlistId(),
    stream: ({ params: id }) => {
      if (!id) {
        return of({} as unknown as PlaylistModel);
      }
      return this._youtubeService.getPlaylist(id).pipe(
        tap((res) => {
          if (!res?.songsList?.length) {
            this.fallbackPlayTrack(id);
          }
        }),
        catchError((err) => {
          console.error(
            'El servicio de playlist falló, intentando reproducir canción con el id de la ruta:',
            err,
          );
          this.fallbackPlayTrack(id);
          return of({} as unknown as PlaylistModel);
        }),
      );
    },
    defaultValue: {} as unknown as PlaylistModel,
  });

  public fallbackPlayTrack(playlistId: string): void {
    if (!playlistId) return;
    this._playbackService.playSingle({ videoId: playlistId, name: '', artist: '', thumbnail: '' });
  }

  public goBack(): void {
    this._location.back();
  }

  public onPlaySong(song: Song, index: number): void {
    const playlist = this.resourceGetPlaylist.value();
    if (!playlist?.songsList?.length) return;

    this._playbackService.playQueue(
      this._playbackService.toQueueItems(playlist.songsList, {
        fallbackThumbnails: playlist.infoPlaylist?.thumbnails,
        size: 800,
      }),
      index,
      playlist.infoPlaylist?.name,
    );
  }

  public onPlayAll(): void {
    const playlist = this.resourceGetPlaylist.value();
    if (!playlist?.songsList?.length) return;
    this.onPlaySong(playlist.songsList[0], 0);
  }

  public onPlayShuffle(): void {
    const playlist = this.resourceGetPlaylist.value();
    if (!playlist?.songsList?.length) return;

    this._playbackService.playShuffled(playlist.songsList, {
      fallbackThumbnails: playlist.infoPlaylist?.thumbnails,
      size: 800,
      sourceTitle: playlist.infoPlaylist?.name,
    });
  }
}
