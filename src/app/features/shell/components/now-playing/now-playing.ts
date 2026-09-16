import {
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { PlaybackService } from '../../../../core/services/playback.service';
import { LyricsService, ParsedLyricLine } from '../../../../core/services/lyrics.service';
import { Dashboard } from '../../../../core/services/dashboard/dashboard';
import { ColorThiefService } from '@soarlin/angular-color-thief';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { getHighResThumbnail } from '../../../../core/services/image-helper.service';
import {
  LucideChevronDown,
  LucidePlay,
  LucidePause,
  LucideSkipBack,
  LucideSkipForward,
  LucideShuffle,
  LucideRepeat,
  LucideRepeat1,
  LucideMusic,
} from '@lucide/angular';
import WaveSurfer from 'wavesurfer.js';
import { StreamResponse } from '../../../../core/models/stream';

@Component({
  selector: 'app-now-playing',
  imports: [
    LucideChevronDown,
    LucidePlay,
    LucidePause,
    LucideSkipBack,
    LucideSkipForward,
    LucideShuffle,
    LucideRepeat,
    LucideRepeat1,
    LucideMusic,
  ],
  templateUrl: './now-playing.html',
  styleUrl: './now-playing.css',
})
export class NowPlaying implements OnDestroy, AfterViewInit {
  public readonly playbackService = inject(PlaybackService);
  private readonly _lyricsService = inject(LyricsService);
  private readonly _youtubeService = inject(Dashboard);
  private readonly _router = inject(Router);
  private readonly _colorThief = inject(ColorThiefService);
  private readonly _globalStorage = inject(GlobalStorage);

  public $song = this._globalStorage.getStore<StreamResponse>('song');
  public $dominantColor = signal<[number, number, number] | null>(null);

  public waveformContainer = viewChild<ElementRef<HTMLElement>>('waveform');
  private _wavesurfer: WaveSurfer | null = null;

  public backgroundStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        background: `radial-gradient(circle at 50% 0%, rgba(${r}, ${g}, ${b}, 0.5) 0%, rgba(${r}, ${g}, ${b}, 0.1) 50%, #0c0a15 100%)`,
      };
    }
    return { background: '#0c0a15' };
  });

  public resourceMetadata = rxResource({
    params: () => this.$song()?.videoId || '',
    stream: ({ params: videoId }) => {
      if (!videoId) return of(null);
      const track = this.playbackService.$currentTrack();
      if (track && track.videoId === videoId && track.name) {
        // Fallback for metadata if already in queue
        return of({
          title: track.name,
          duration: typeof track.duration === 'number' ? track.duration : 0,
          thumbnail: track.thumbnail || '',
          author: track.artist || '',
          channel: '',
          viewCount: 0,
        });
      }
      return this._youtubeService.getMetadata(videoId);
    },
  });

  public trackTitle = computed(
    () => this.playbackService.$currentTrack()?.name || this.resourceMetadata.value()?.title || '',
  );
  public trackAuthor = computed(
    () =>
      this.playbackService.$currentTrack()?.artist || this.resourceMetadata.value()?.author || '',
  );
  public trackDuration = computed(() => {
    const dur = this.playbackService.$duration();
    return dur ? dur : this.resourceMetadata.value()?.duration || 0;
  });
  public currentArtworkUrl = computed(() => {
    const raw =
      this.playbackService.$currentTrack()?.thumbnail ||
      this.resourceMetadata.value()?.thumbnail ||
      '';
    return getHighResThumbnail(raw, 1024);
  });

  public formattedCurrentTime = computed(() =>
    this._formatSeconds(this.playbackService.$currentTime()),
  );
  public formattedDuration = computed(() => this._formatSeconds(this.trackDuration()));
  public progressPercent = computed(() => {
    const dur = this.trackDuration();
    if (!dur) return 0;
    return Math.min(100, Math.max(0, (this.playbackService.$currentTime() / dur) * 100));
  });

  public lyricsResource = rxResource({
    params: () => ({
      title: this.trackTitle(),
      author: this.trackAuthor(),
      dur: this.trackDuration(),
    }),
    stream: ({ params }) => {
      if (!params.title) return of(null);
      return this._lyricsService.getLyrics(params.title, params.author);
    },
  });

  public parsedLyrics = computed(() => {
    const data = this.lyricsResource.value();
    if (data?.syncedLyrics) {
      return this._lyricsService.parseSyncedLyrics(data.syncedLyrics);
    }
    return [];
  });

  public currentLyricIndex = computed(() => {
    const lyrics = this.parsedLyrics();
    if (!lyrics.length) return -1;
    const time = this.playbackService.$currentTime();

    // Find the last lyric line that has passed
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (time >= lyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  });

  constructor() {
    effect(() => {
      // Sync wavesurfer with audio element
      const audio = this.playbackService.$audioElement();
      if (audio && this._wavesurfer && !this._wavesurfer.getMediaElement()) {
        // Wavesurfer setup with existing media element
      }
    });

    effect(() => {
      // Scroll to current lyric
      const idx = this.currentLyricIndex();
      if (idx !== -1) {
        const el = document.getElementById(`lyric-${idx}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  public ngAfterViewInit(): void {
    this._initWavesurfer();
  }

  public ngOnDestroy(): void {
    if (this._wavesurfer) {
      this._wavesurfer.destroy();
    }
  }

  private _initWavesurfer(): void {
    const container = this.waveformContainer()?.nativeElement;
    if (!container) return;

    this._wavesurfer = WaveSurfer.create({
      container: container,
      waveColor: 'rgba(167, 139, 250, 0.4)', // purple-400
      progressColor: 'rgba(192, 132, 252, 0.8)', // purple-300
      cursorColor: 'transparent',
      barWidth: 3,
      barGap: 3,
      barRadius: 3,
      height: 60,
      normalize: true,
      mediaControls: false,
    });

    // Try to attach the existing audio element
    const audio = this.playbackService.$audioElement();
    if (audio) {
      this._wavesurfer.load(audio.src);
    }
  }

  public onImageLoad(img: HTMLImageElement): void {
    if (!img) return;
    try {
      const color = this._colorThief.getColor(img, 10);
      if (color && color.length === 3) {
        this.$dominantColor.set(color);
      }
    } catch {}
  }

  public goBack(): void {
    window.history.back(); // or router.navigate(['/'])
  }

  public togglePlay(): void {
    this.playbackService.togglePlay();
  }

  public onSeek(event: Event): void {
    const audio = this.playbackService.$audioElement();
    if (!audio) return;
    const input = event.target as HTMLInputElement;
    const percent = Number(input.value);
    const dur = this.trackDuration();
    if (dur > 0) {
      audio.currentTime = (percent / 100) * dur;
    }
  }

  private _formatSeconds(seconds: number): string {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
