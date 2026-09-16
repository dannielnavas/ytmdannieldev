import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { LucideLoader2, LucideMusic, LucidePause, LucidePlay } from '@lucide/angular';
import { Song } from '../../../../core/models/list-search';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { StreamResponse } from '../../../../core/models/stream';
import { PlaybackService } from '../../../../core/services/playback.service';

import { ImageHelperService, getHighResThumbnail } from '../../../../core/services/image-helper.service';

@Component({
  imports: [LucidePlay, LucidePause, LucideLoader2, LucideMusic],
  selector: 'app-detail-song',
  styleUrl: './detail-song.css',
  templateUrl: './detail-song.html',
})
export class DetailSong {
  private readonly _dashboard = inject(Dashboard);
  private readonly _globalStorage = inject(GlobalStorage);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _imageHelper = inject(ImageHelperService);

  public $song = input<Song>();
  public $index = input<number>();
  public songSelected = output<Song>();

  public $isLoadingManual = signal(false);
  public $currentSong = this._globalStorage.getStore<StreamResponse>('song');

  // Manejo de miniaturas con fallback: inicia en la primera (0), y si falla prueba la siguiente
  public $thumbnailIndex = linkedSignal({
    source: this.$song,
    computation: () => 0,
  });

  public $hasImageError = linkedSignal({
    source: this.$song,
    computation: () => false,
  });

  public $isPlaying = computed(() => {
    const current = this.$currentSong();
    const song = this.$song();
    return !!(current?.videoId && song?.videoId && current.videoId === song.videoId);
  });

  public $isLoading = computed(() => {
    if (this.$isLoadingManual()) return true;
    const currentTrack = this._playbackService.$currentTrack();
    const song = this.$song();
    const isServiceLoading = this._playbackService.$isLoadingSong();
    return !!(
      isServiceLoading &&
      currentTrack?.videoId &&
      song?.videoId &&
      currentTrack.videoId === song.videoId
    );
  });

  public thumbnailUrl = computed(() => {
    if (this.$hasImageError()) return '';
    const thumbs = this.$song()?.thumbnails;
    if (!thumbs || thumbs.length === 0) return '';
    const index = this.$thumbnailIndex();
    if (index >= 0 && index < thumbs.length) {
      return getHighResThumbnail(thumbs[index]?.url, 240);
    }
    return '';
  });

  public onImageError(): void {
    const currentUrl = this.thumbnailUrl();
    this._imageHelper.recordFailure(currentUrl);

    // Evitar tormenta de reintentos: máximo 1 intento y solo si no hay ráfaga de 429
    const currentAttempt = this.$thumbnailIndex();
    const thumbs = this.$song()?.thumbnails;
    if (
      this._imageHelper.shouldRetry(currentAttempt) &&
      thumbs &&
      currentAttempt + 1 < thumbs.length
    ) {
      this.$thumbnailIndex.set(currentAttempt + 1);
    } else {
      this.$hasImageError.set(true);
    }
  }

  public formattedDuration = computed(() => {
    const d = this.$song()?.duration;
    if (d == null || d === 0) return '';
    if (typeof d === 'string') return d;
    const minutes = Math.floor(d / 60);
    const seconds = Math.floor(d % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  public playSong(): void {
    const song = this.$song();
    if (!song?.videoId) return;

    this.songSelected.emit(song);
  }
}
