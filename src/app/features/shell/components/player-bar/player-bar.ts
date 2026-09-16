import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ColorThiefService } from '@soarlin/angular-color-thief';
import {
  LucideSkipBack,
  LucideSkipForward,
  LucidePause,
  LucidePlay,
  LucideVolume2,
  LucideVolume1,
  LucideVolumeX,
  LucideShuffle,
  LucideRepeat,
  LucideRepeat1,
  LucideListMusic,
  LucideX,
  LucideMusic,
  LucideChevronDown,
} from '@lucide/angular';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { StreamResponse } from '../../../../core/models/stream';
import { PlaybackService } from '../../../../core/services/playback.service';

import { of } from 'rxjs';
import { ImageHelperService, getHighResThumbnail } from '../../../../core/services/image-helper.service';

@Component({
  selector: 'app-player-bar',
  imports: [
    LucideSkipBack,
    LucideSkipForward,
    LucidePause,
    LucidePlay,
    LucideVolume2,
    LucideVolume1,
    LucideVolumeX,
    LucideShuffle,
    LucideRepeat,
    LucideRepeat1,
    LucideListMusic,
    LucideX,
    LucideMusic,
    LucideChevronDown,
  ],
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.css',
  host: {
    '[class.hidden]': '!$song()?.videoId',
  },
})
export class PlayerBar {
  private readonly _globalStorage = inject(GlobalStorage);
  private readonly _youtubeService = inject(Dashboard);
  public readonly playbackService = inject(PlaybackService);
  private readonly _imageHelper = inject(ImageHelperService);
  private readonly _colorThief = inject(ColorThiefService);
  private readonly _router = inject(Router);

  public $song = this._globalStorage.getStore<StreamResponse>('song');
  public $audioElementRef = viewChild<ElementRef<HTMLAudioElement>>('player');

  public $dominantColor = linkedSignal({
    source: () => this.playbackService.$currentTrack()?.videoId,
    computation: () => null as [number, number, number] | null,
  });

  public $isPlaying = this.playbackService.$isPlaying;
  public $currentTime = this.playbackService.$currentTime;
  public $duration = this.playbackService.$duration;
  public $volume = this.playbackService.$volume;
  public $isMuted = this.playbackService.$isMuted;
  public $artworkError = this.playbackService.$artworkError;
  public $previousVolume = signal(1);
  public $showQueue = signal(false);

  public playerBarDynamicStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        'border-color': `rgba(${r}, ${g}, ${b}, 0.45)`,
        'box-shadow': `0 15px 35px -5px rgba(${r}, ${g}, ${b}, 0.35)`,
      };
    }
    return {};
  });

  public onImageLoad(img: HTMLImageElement): void {
    if (!img) return;
    try {
      const color = this._colorThief.getColor(img, 10);
      if (color && color.length === 3) {
        this.$dominantColor.set(color);
      }
    } catch {
      // ColorThief fallback silencioso
    }
  }

  public trackTitle = computed(() => {
    const currentTrack = this.playbackService.$currentTrack();
    return currentTrack?.name || this.resourceMetadata.value()?.title || '';
  });

  public trackAuthor = computed(() => {
    const currentTrack = this.playbackService.$currentTrack();
    return (
      currentTrack?.artist ||
      this.resourceMetadata.value()?.author ||
      this.resourceMetadata.value()?.channel ||
      ''
    );
  });

  public trackDuration = computed(() => {
    const currentTrack = this.playbackService.$currentTrack();
    const dur = typeof currentTrack?.duration === 'number' ? currentTrack.duration : 0;
    return dur || this.resourceMetadata.value()?.duration || 0;
  });

  public currentArtworkUrl = computed(() => {
    if (this.$artworkError()) return '';
    const currentTrack = this.playbackService.$currentTrack();
    if (currentTrack?.thumbnail) return getHighResThumbnail(currentTrack.thumbnail, 400);
    const metaThumb = this.resourceMetadata.value()?.thumbnail;
    if (metaThumb) return getHighResThumbnail(metaThumb, 400);
    return '';
  });

  public resourceMetadata = rxResource({
    params: () => {
      const song = this.$song();
      const track = this.playbackService.$currentTrack();
      // Si la pista actual ya tiene título en la cola, evitar consultar el servicio de metadatos
      if (track && track.videoId === song?.videoId && track.name) {
        return '';
      }
      return song?.videoId || '';
    },
    stream: ({ params: videoId }) => {
      if (!videoId) {
        return of({
          title: '',
          duration: 0,
          thumbnail: '',
          channel: '',
          author: '',
          viewCount: 0,
        });
      }
      return this._youtubeService.getMetadata(videoId);
    },
    defaultValue: {
      title: '',
      duration: 0,
      thumbnail: '',
      channel: '',
      author: '',
      viewCount: 0,
    },
  });

  public onArtworkError(): void {
    const url = this.currentArtworkUrl();
    this._imageHelper.recordFailure(url);
    this.$artworkError.set(true);
  }

  public formattedCurrentTime = computed(() => this._formatSeconds(this.$currentTime()));

  public formattedDuration = computed(() => {
    const dur = this.$duration() || this.trackDuration() || 0;
    return this._formatSeconds(dur);
  });

  public progressPercent = computed(() => {
    const dur = this.$duration() || this.trackDuration() || 0;
    if (!dur) return 0;
    return Math.min(100, Math.max(0, (this.$currentTime() / dur) * 100));
  });

  constructor() {
    effect(() => {
      const audio = this.$audioElementRef()?.nativeElement;
      if (audio && audio !== this.playbackService.$audioElement()) {
        this.playbackService.$audioElement.set(audio);
      }
    });

    effect(() => {
      const meta = this.$song();
      if (meta?.videoId) {
        this.playbackService.shouldPlay = true;
        this.$artworkError.set(false);
        this.$currentTime.set(0);
        this.$duration.set(0);
        this.$isPlaying.set(true);
      }
    }, { allowSignalWrites: true });
  }

  public onPlay(): void {
    this.playbackService.shouldPlay = true;
    this.$isPlaying.set(true);
  }

  public openNowPlaying(): void {
    this._router.navigate(['/now-playing']);
  }

  public onPause(): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (audio?.paused) {
      this.$isPlaying.set(false);
    }
  }

  public onCanPlay(): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (audio && this.playbackService.shouldPlay && audio.paused) {
      audio
        .play()
        .then(() => this.$isPlaying.set(true))
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Error al reproducir audio en canplay:', err);
            this.$isPlaying.set(false);
          }
        });
    }
  }

  public togglePlay(): void {
    this.playbackService.togglePlay();
  }

  public onNext(): void {
    this.playbackService.shouldPlay = true;
    this.playbackService.playNext();
  }

  public onPrevious(): void {
    this.playbackService.shouldPlay = true;
    const audio = this.$audioElementRef()?.nativeElement;
    const currentTime = audio ? audio.currentTime : 0;
    const moved = this.playbackService.playPrevious(currentTime);
    if (!moved && audio) {
      audio.currentTime = 0;
      this.$currentTime.set(0);
      audio
        .play()
        .then(() => this.$isPlaying.set(true))
        .catch((err) => console.warn('Error al reiniciar:', err));
    }
  }

  public toggleShuffle(): void {
    this.playbackService.toggleShuffle();
  }

  public toggleRepeat(): void {
    this.playbackService.toggleRepeat();
  }

  public toggleQueue(): void {
    this.$showQueue.update((v) => !v);
  }

  public onTimeUpdate(event: Event): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (!audio) return;
    this.$currentTime.set(audio.currentTime);
  }

  public onLoadedMetadata(event: Event): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (!audio) return;
    if (audio.duration && !isNaN(audio.duration)) {
      this.$duration.set(audio.duration);
    }
  }

  public onSeek(event: Event): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (!audio) return;
    const input = event.target as HTMLInputElement;
    const percent = Number(input.value);
    const metaDur = this.resourceMetadata.value()?.duration;
    const totalDuration = this.$duration() || metaDur || 0;
    if (totalDuration > 0) {
      const targetTime = (percent / 100) * totalDuration;
      audio.currentTime = targetTime;
      this.$currentTime.set(targetTime);
    }
  }

  public onEnded(): void {
    this.playbackService.shouldPlay = true;
    if (this.playbackService.$repeatMode() === 'one') {
      const audio = this.$audioElementRef()?.nativeElement;
      if (audio) {
        audio.currentTime = 0;
        audio
          .play()
          .then(() => this.$isPlaying.set(true))
          .catch((err) => console.warn('Error al repetir pista:', err));
      }
      return;
    }
    const hasNext = this.playbackService.$hasNext();
    if (!hasNext) {
      this.$isPlaying.set(false);
    }
    this.playbackService.onTrackEnded();
  }

  public toggleMute(): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (!audio) return;
    if (this.$isMuted()) {
      const restored = this.$previousVolume() || 0.5;
      audio.volume = restored;
      this.$volume.set(restored);
      this.$isMuted.set(false);
    } else {
      this.$previousVolume.set(audio.volume);
      audio.volume = 0;
      this.$volume.set(0);
      this.$isMuted.set(true);
    }
  }

  public onVolumeChange(event: Event): void {
    const audio = this.$audioElementRef()?.nativeElement;
    if (!audio) return;
    const vol = Number((event.target as HTMLInputElement).value);
    audio.volume = vol;
    this.$volume.set(vol);
    this.$isMuted.set(vol === 0);
  }

  public onError(err: Event): void {
    console.error('Error al reproducir stream de audio:', err);
    this.$isPlaying.set(false);
  }

  public selectQueueTrack(index: number): void {
    this.playbackService.shouldPlay = true;
    this.playbackService.playIndex(index);
  }

  private _formatSeconds(seconds: number): string {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
