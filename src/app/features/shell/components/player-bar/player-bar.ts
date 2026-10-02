import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { AudioVisualizerService } from '../../../../core/services/audio-visualizer.service';
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
  LucideListX,
  LucideGripVertical,
  LucideTrash2,
  LucideX,
  LucideMusic,
  LucideChevronDown,
  LucideAlertCircle,
  LucideGauge,
  LucideVolume2 as LucideSpeaker,
} from '@lucide/angular';
import { PlaybackService } from '../../../../core/services/playback.service';
import { AudioOutputService } from '../../../../core/services/audio-output.service';
import { TrackMetadataService } from '../../../../core/services/track-metadata.service';
import { ImageHelperService } from '../../../../core/services/image-helper.service';
import { getHighResThumbnail } from '../../../../core/services/image-helper.service';
import { CoverPalette } from '../../../../core/services/cover-palette.service';
import { formatTime, formatTimeRange } from '../../../../core/utils/format-time';
import { LikeButton } from '../../../../shared/components/like-button/like-button';

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
    LucideListX,
    LucideGripVertical,
    LucideTrash2,
    LucideX,
    LucideMusic,
    LucideChevronDown,
    LucideAlertCircle,
    LucideGauge,
    LucideSpeaker,
    LikeButton,
  ],
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.css',
  host: {
    '[class.hidden]': '!$song()?.videoId',
  },
})
export class PlayerBar {
  public readonly playbackService = inject(PlaybackService);
  public readonly audioOutput = inject(AudioOutputService);
  private readonly _metadata = inject(TrackMetadataService);
  private readonly _imageHelper = inject(ImageHelperService);
  private readonly _coverPalette = inject(CoverPalette);
  private readonly _router = inject(Router);
  private readonly _injector = inject(Injector);

  /** Track in playback. Used to be the `'song'` key of `GlobalStorage`. */
  public $song = this.playbackService.$stream;
  public $queue = this.playbackService.$queue;
  public $currentIndex = this.playbackService.$currentIndex;
  public $isPlaying = this.playbackService.$isPlaying;
  public $currentTime = this.playbackService.$currentTime;
  public $isMuted = this.playbackService.$isMuted;
  public $volume = this.playbackService.$volume;
  public $playbackRate = this.playbackService.$playbackRate;
  public $artworkError = this.playbackService.$artworkError;
  public $error = this.playbackService.$error;

  public $showQueue = signal(false);
  /** While dragging the seek slider, `timeupdate` must not fight the input. */
  public $isSeeking = signal(false);

  public $dominantColor = linkedSignal({
    source: () => this.playbackService.$currentTrack()?.videoId,
    computation: () => null as [number, number, number] | null,
  });

  public playerBarDynamicStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      const lightR = Math.min(255, r + 45);
      const lightG = Math.min(255, g + 45);
      const lightB = Math.min(255, b + 45);
      return {
        background: `linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(${r}, ${g}, ${b}, 0.2) 30%, rgba(14, 11, 24, 0.28) 100%)`,
        'border-color': `rgba(${lightR}, ${lightG}, ${lightB}, 0.38)`,
        'box-shadow': `inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.65), inset 0 -1px 2px 0 rgba(0, 0, 0, 0.35), 0 20px 45px -10px rgba(0, 0, 0, 0.65), 0 0 35px -5px rgba(${r}, ${g}, ${b}, 0.32)`,
      };
    }
    return {};
  });

  public dominantRgbString = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      return `${color[0]}, ${color[1]}, ${color[2]}`;
    }
    return '140, 90, 220';
  });

  public trackTitle = computed(
    () => this.playbackService.$currentTrack()?.name || this._metadata.$metadata().title || '',
  );

  public trackAuthor = computed(() => {
    const track = this.playbackService.$currentTrack();
    const meta = this._metadata.$metadata();
    return track?.artist || meta.author || meta.channel || '';
  });

  public trackDuration = computed(
    () => this.playbackService.$effectiveDuration() || this._metadata.$metadata().duration || 0,
  );

  public currentArtworkUrl = computed(() => {
    if (this.$artworkError()) return '';
    const track = this.playbackService.$currentTrack();
    if (track?.thumbnail) return getHighResThumbnail(track.thumbnail, 400);
    const metaThumb = this._metadata.$metadata().thumbnail;
    return metaThumb ? getHighResThumbnail(metaThumb, 400) : '';
  });

  public readonly visualizer = inject(AudioVisualizerService);
  public visualizerCanvas = viewChild<ElementRef<HTMLCanvasElement>>('visualizer');
  public $visualizerActive = this.visualizer.$active;

  public $showRemainingTime = signal(true);

  public formattedCurrentTime = computed(() => formatTime(this.$currentTime()));
  public formattedDuration = computed(() => formatTime(this.trackDuration()));
  public formattedRemainingTime = computed(() => {
    const duration = this.trackDuration();
    const current = this.$currentTime();
    const remaining = Math.max(0, duration - current);
    return `-${formatTime(remaining)}`;
  });
  public displayDuration = computed(() =>
    this.$showRemainingTime() ? this.formattedRemainingTime() : this.formattedDuration(),
  );

  public toggleTimeDisplay(): void {
    this.$showRemainingTime.update((v) => !v);
  }

  public seekValueText = computed(() => formatTimeRange(this.$currentTime(), this.trackDuration()));

  /** Visual bars representing music waveform for the seek bar background. */
  public readonly waveformBars = [
    30, 42, 58, 48, 75, 92, 85, 60, 72, 88, 52, 68, 86, 96, 74, 62, 78, 92, 68, 52, 42, 64, 82, 98,
    88, 72, 64, 84, 94, 100, 78, 64, 52, 68, 84, 92, 72, 58, 68, 84, 88, 72, 54, 44, 62, 78, 52, 38,
  ];

  /**
   * Mirrors the service progress, except while the user drags the slider, where
   * the input owns the value.
   */
  public progressPercent = computed(() =>
    this.$isSeeking() ? this._seekPercent() : this.playbackService.$progressPercent(),
  );

  /** Slider value while dragging, owned by the input. */
  private _seekPercent = signal(0);

  constructor() {
    // The audio element lives in the service now, but the metadata still has to
    // be requested by whoever displays the track, and only when the queue does
    // not already provide a name.
    effect(() => {
      const stream = this.$song();
      const track = this.playbackService.$currentTrack();
      const hasOwnName = Boolean(track && track.videoId === stream?.videoId && track.name);
      this._metadata.load(stream?.videoId, hasOwnName);
    });

    effect(() => {
      const canvas = this.visualizerCanvas()?.nativeElement ?? null;
      untracked(() => {
        if (canvas && !this._router.url.includes('/now-playing')) {
          this.visualizer.attach(canvas);
        }
      });
    });

    effect(() => {
      const color = this.$dominantColor();
      this.visualizer.setColor(color);
    });
  }

  public onImageLoad(img: HTMLImageElement): void {
    if (!img) return;
    this.$dominantColor.set(this._coverPalette.dominant(img));
  }

  public onArtworkError(): void {
    this._imageHelper.recordFailure(this.currentArtworkUrl());
    this.playbackService.reportArtworkError();
  }

  // --- Transport ------------------------------------------------------------

  public togglePlay(): void {
    this.playbackService.togglePlay();
  }

  public onNext(): void {
    this.playbackService.playNext();
  }

  public onPrevious(): void {
    this.playbackService.previous();
  }

  public toggleShuffle(): void {
    this.playbackService.toggleShuffle();
  }

  public toggleRepeat(): void {
    this.playbackService.toggleRepeat();
  }

  public openNowPlaying(): void {
    this._router.navigate(['/now-playing']);
  }

  // --- Seek -----------------------------------------------------------------

  public onSeekStart(): void {
    this._seekPercent.set(this.playbackService.$progressPercent());
    this.$isSeeking.set(true);
  }

  public onSeekInput(event: Event): void {
    const percent = Number((event.target as HTMLInputElement).value);
    this._seekPercent.set(percent);
    // Move the clock right away so the thumb does not lag behind the pointer
    // until the next `timeupdate`.
    this.playbackService.seekToPercent(percent);
  }

  public onSeekEnd(): void {
    this.$isSeeking.set(false);
  }

  // --- Volume ---------------------------------------------------------------

  public toggleMute(): void {
    this.playbackService.toggleMute();
  }

  public onVolumeChange(event: Event): void {
    this.playbackService.setVolume(Number((event.target as HTMLInputElement).value));
  }

  public volumeValueText = computed(() => `${Math.round(this.$volume() * 100)} por ciento`);

  // --- Playback rate --------------------------------------------------------

  public rateLabel = computed(() => {
    const rate = this.$playbackRate();
    return `${Number.isInteger(rate) ? rate : rate.toFixed(2).replace(/0+$/, '')}x`;
  });

  public cycleRate(): void {
    this.playbackService.cycleRate();
  }

  // --- Output device --------------------------------------------------------

  public onOutputDeviceChange(event: Event): void {
    void this.audioOutput.select((event.target as HTMLSelectElement).value);
  }

  // --- Queue ----------------------------------------------------------------

  public toggleQueue(): void {
    this.$showQueue.update((v) => !v);
  }

  public selectQueueTrack(index: number): void {
    this.playbackService.playIndex(index);
  }

  // --- Queue editing --------------------------------------------------------

  /** Index of the dragged row and of the row hovered as a drop target. */
  public $dragIndex = signal<number | null>(null);
  public $dropIndex = signal<number | null>(null);

  private readonly _queueRows = viewChildren<ElementRef<HTMLButtonElement>>('queueRow');

  public onDragStart(event: DragEvent, index: number): void {
    this.$dragIndex.set(index);
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    // Firefox refuses to start a drag when the payload is empty.
    event.dataTransfer.setData('text/plain', String(index));
  }

  public onDragOver(event: DragEvent, index: number): void {
    if (this.$dragIndex() === null) return;
    // Without this the browser treats the row as a non-droppable target.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.$dropIndex.set(index);
  }

  public onDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.$dragIndex() ?? Number(event.dataTransfer?.getData('text/plain'));
    this._resetDrag();
    if (!Number.isInteger(from) || from === index) return;

    this.playbackService.moveInQueue(from, index);
    this._focusRow(index);
  }

  public onDragEnd(): void {
    this._resetDrag();
  }

  /**
   * Keyboard equivalent of the drag, following the listbox convention:
   * `Control`/`Cmd` with the arrows reorders, `Delete` removes.
   */
  public onQueueKeydown(event: KeyboardEvent, index: number): void {
    const reorder = event.ctrlKey || event.metaKey;

    if (reorder && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const target = index + (event.key === 'ArrowUp' ? -1 : 1);
      const length = this.$queue().length;
      if (target < 0 || target >= length) return;
      // Also stops the global volume shortcut from reacting to the same key.
      event.preventDefault();
      this.playbackService.moveInQueue(index, target);
      this._focusRow(target);
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      // Focus goes to the entry that takes the place of the removed one.
      const landing = Math.min(index, this.$queue().length - 2);
      this.playbackService.removeFromQueue(index);
      if (landing >= 0) this._focusRow(landing);
      else this._focusList();
    }
  }

  public removeQueueTrack(index: number): void {
    const landing = Math.min(index, this.$queue().length - 2);
    this.playbackService.removeFromQueue(index);
    if (landing >= 0) this._focusRow(landing);
  }

  public clearQueue(): void {
    this.playbackService.clearQueue();
    this._focusList();
  }

  public isDropTarget(index: number): boolean {
    return this.$dropIndex() === index && this.$dragIndex() !== index;
  }

  private _resetDrag(): void {
    this.$dragIndex.set(null);
    this.$dropIndex.set(null);
  }

  /**
   * Focus has to wait for the list to be rendered again, otherwise the row we
   * just moved or removed is still the previous one.
   */
  private _focusRow(index: number): void {
    afterNextRender(() => this._queueRows()[index]?.nativeElement.focus(), {
      injector: this._injector,
    });
  }

  private _focusList(): void {
    afterNextRender(() => document.getElementById('queue-list')?.focus(), {
      injector: this._injector,
    });
  }

  public dismissError(): void {
    this.playbackService.clearError();
  }
}
