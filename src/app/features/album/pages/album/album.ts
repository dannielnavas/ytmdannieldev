import { Component, computed, inject, input } from '@angular/core';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of, tap } from 'rxjs';
import { Search } from '../../../search/search';
import { Location } from '@angular/common';
import { AlbumResponse, Song } from '../../../../core/models/album.model';
import { DetailHero } from '../../../../shared/components/detail-hero/detail-hero';
import { DetailSongRow } from '../../../../shared/components/detail-song-row/detail-song-row';
import { PlaybackService } from '../../../../core/services/playback.service';
import { LucideArrowLeft, LucideClock, LucideDisc, LucideMusic } from '@lucide/angular';

@Component({
  imports: [
    Search,
    DetailHero,
    DetailSongRow,
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
  private readonly _playbackService = inject(PlaybackService);
  private readonly _location = inject(Location);

  /**
   * Inyectado por `withComponentInputBinding()` desde `:albumId` en la ruta.
   *
   * Antes el id viajaba por la clave `'album'` de `GlobalStorage`, un
   * `Record<string, any>` global. Eso obligaba a que cada navegación escribiera
   * en ese store, impedía compartir enlaces y hacía que una recarga de página
   * abriera un álbum vacío.
   */
  public readonly albumId = input<string>('');

  /** Los id de álbum pueden venir como `RDAMVM...` / `RDAMPL...`. */
  public readonly $albumId = computed(() => this.albumId().replace(/^RDAM(?:VM|PL)/, ''));

  public resourceAlbum = rxResource({
    params: () => this.$albumId(),
    stream: ({ params: albumId }) => {
      if (!albumId) {
        return of({} as AlbumResponse);
      }
      return this._youtubeService.getAlbumById(albumId).pipe(
        tap((res) => {
          if (!res?.songs?.length) {
            this.fallbackPlayTrack(albumId);
          }
        }),
        catchError((err) => {
          console.error(
            'El servicio de álbum falló, intentando reproducir canción con el id de la ruta:',
            err,
          );
          this.fallbackPlayTrack(albumId);
          return of({} as AlbumResponse);
        }),
      );
    },

    defaultValue: {} as AlbumResponse,
  });

  /** Si el backend no devuelve pistas, al menos reproduce el propio álbum. */
  public fallbackPlayTrack(albumId: string): void {
    if (!albumId) return;
    this._playbackService.playSingle({ videoId: albumId, name: '', artist: '', thumbnail: '' });
  }

  public totalDuration = computed(() => {
    const songs = this.resourceAlbum.value()?.songs;
    if (!songs?.length) return 0;
    // `duration` puede venir como string ("3:45") o null, así que solo suman los numéricos.
    return songs.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
  });

  public goBack(): void {
    this._location.back();
  }

  public onPlaySong(song: Song, index: number): void {
    const album = this.resourceAlbum.value();
    if (!album?.songs?.length) return;

    this._playbackService.playQueue(
      this._playbackService.toQueueItems(album.songs, {
        fallbackThumbnails: album.thumbnails,
        size: 800,
      }),
      index,
      album.name,
    );
  }

  public onPlayAll(): void {
    const album = this.resourceAlbum.value();
    if (!album?.songs?.length) return;
    this.onPlaySong(album.songs[0], 0);
  }

  public onPlayShuffle(): void {
    const album = this.resourceAlbum.value();
    if (!album?.songs?.length) return;

    this._playbackService.playShuffled(album.songs, {
      fallbackThumbnails: album.thumbnails,
      size: 800,
      sourceTitle: album.name,
    });
  }
}
