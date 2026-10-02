import { Component, computed, inject, input, output } from '@angular/core';
import { LucideLoader2, LucideMusic, LucidePause, LucidePlay } from '@lucide/angular';
import { PlaybackService } from '../../../core/services/playback.service';
import { Thumbnail } from '../../../core/services/thumbnail';
import { SourceSong } from '../../../core/models/youtube';
import { LikeButton } from '../like-button/like-button';

/**
 * Fila de canción para las páginas de detalle (álbum, playlist y resultados).
 *
 * Sustituye a `detail-song-album`, `detail-song-playlist` y `detail-song`, cuyos
 * templates eran 99% idénticos (131/132 líneas) y cuyas tres copias ya habían
 * divergido: una no aplicaba upscale de miniatura y otra mostraba '' en vez de
 * '--:--' cuando faltaba la duración.
 */
@Component({
  imports: [LucidePlay, LucidePause, LucideLoader2, LucideMusic, Thumbnail, LikeButton],
  selector: 'app-detail-song-row',
  templateUrl: './detail-song-row.html',
  styleUrl: './detail-song-row.css',
})
export class DetailSongRow {
  private readonly _playbackService = inject(PlaybackService);

  public readonly song = input.required<SourceSong>();
  public readonly index = input(0);

  /** Texto a mostrar cuando la canción no trae artista. */
  public readonly artistFallback = input('Artista desconocido');
  /** Muestra el álbum en una columna adicional (lo usa la vista de búsqueda). */
  public readonly showAlbumColumn = input(false);
  public readonly showDuration = input(true);

  public readonly songSelected = output<SourceSong>();

  public readonly $isPlaying = computed(() => {
    const current = this._playbackService.$stream();
    const song = this.song();
    return !!(current?.videoId && song?.videoId && current.videoId === song.videoId);
  });

  public readonly $isLoading = computed(() => {
    const currentTrack = this._playbackService.$currentTrack();
    const song = this.song();
    return !!(
      this._playbackService.$isBuffering() &&
      currentTrack?.videoId &&
      song?.videoId &&
      currentTrack.videoId === song.videoId
    );
  });

  public readonly formattedDuration = computed(() => {
    const d = this.song()?.duration;
    if (d == null || d === 0) return '--:--';
    if (typeof d === 'string') return d;
    const minutes = Math.floor(d / 60);
    const seconds = Math.floor(d % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  protected selectSong(): void {
    this.songSelected.emit(this.song());
  }
}
