import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { Song } from '../../../../core/models/album.model';
import { LucideLoader2, LucideMusic, LucidePause, LucidePlay } from '@lucide/angular';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { StreamResponse } from '../../../../core/models/stream';
import { PlaybackService } from '../../../../core/services/playback.service';
import { ImageHelperService, getHighResThumbnail } from '../../../../core/services/image-helper.service';

@Component({
  imports: [LucidePlay, LucidePause, LucideLoader2, LucideMusic],
  selector: 'app-detail-song-album',
  styleUrl: './detail-song-album.css',
  templateUrl: './detail-song-album.html',
})
export class DetailSongAlbum {
  private readonly _globalStorage = inject(GlobalStorage);
  private readonly _playbackService = inject(PlaybackService);
  private readonly _imageHelper = inject(ImageHelperService);

  public $song = input<Song>();
  public $index = input<number>();

  public songSelected = output<Song>();

  public $currentSong = this._globalStorage.getStore<StreamResponse>('song');

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
    const raw = (index >= 0 && index < thumbs.length) ? thumbs[index]?.url : thumbs[thumbs.length - 1]?.url;
    return getHighResThumbnail(raw || '', 240);
  });

  public onImageError(): void {
    const currentUrl = this.thumbnailUrl();
    this._imageHelper.recordFailure(currentUrl);

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
    if (d == null || d === 0) return '--:--';
    if (typeof d === 'string') return d;
    const minutes = Math.floor(d / 60);
    const seconds = Math.floor(d % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  public selectSong(): void {
    const song = this.$song();
    if (song) {
      this.songSelected.emit(song);
    }
  }
}
