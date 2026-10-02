import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { PlaybackService } from '../../../../core/services/playback.service';
import { AudioVisualizerService } from '../../../../core/services/audio-visualizer.service';
import { WindowControlsService } from '../../../../core/services/window-controls.service';
import { CoverPalette, Rgb } from '../../../../core/services/cover-palette.service';
import { TrackMetadataService } from '../../../../core/services/track-metadata.service';
import { getHighResThumbnail } from '../../../../core/services/image-helper.service';
import {
  LucidePlay,
  LucidePause,
  LucideSkipBack,
  LucideSkipForward,
  LucideMaximize2,
  LucideMinus,
  LucideX,
  LucideMusic,
} from '@lucide/angular';

@Component({
  selector: 'app-mini-player',
  imports: [
    LucidePlay,
    LucidePause,
    LucideSkipBack,
    LucideSkipForward,
    LucideMaximize2,
    LucideMinus,
    LucideX,
    LucideMusic,
  ],
  templateUrl: './mini-player.component.html',
  styleUrl: './mini-player.component.css',
})
export class MiniPlayerComponent {
  public readonly playbackService = inject(PlaybackService);
  public readonly visualizer = inject(AudioVisualizerService);
  public readonly controls = inject(WindowControlsService);
  private readonly _coverPalette = inject(CoverPalette);
  private readonly _metadata = inject(TrackMetadataService);

  public visualizerCanvas = viewChild<ElementRef<HTMLCanvasElement>>('miniVisualizer');
  public $dominantColor = signal<Rgb | null>(null);

  public trackTitle = computed(
    () =>
      this.playbackService.$currentTrack()?.name || this._metadata.$metadata().title || 'Sonara',
  );

  public trackAuthor = computed(
    () =>
      this.playbackService.$currentTrack()?.artist ||
      this._metadata.$metadata().author ||
      this._metadata.$metadata().channel ||
      'Reproductor',
  );

  public currentArtworkUrl = computed(() => {
    const raw =
      this.playbackService.$currentTrack()?.thumbnail || this._metadata.$metadata().thumbnail || '';
    return raw ? getHighResThumbnail(raw, 300) : '';
  });

  public dominantRgbString = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      return `${color[0]}, ${color[1]}, ${color[2]}`;
    }
    return '140, 90, 220';
  });

  constructor() {
    effect(() => {
      const canvas = this.visualizerCanvas()?.nativeElement;
      if (canvas) {
        this.visualizer.attach(canvas);
      }
    });

    effect(() => {
      const color = this.$dominantColor();
      this.visualizer.setColor(color);
    });
  }

  public onImageLoad(img: HTMLImageElement): void {
    if (!img) return;
    const color = this._coverPalette.dominant(img);
    if (color) {
      this.$dominantColor.set(color);
    }
  }

  public cycleVisualizerStyle(): void {
    this.visualizer.cycleStyle();
  }

  public restoreFullWindow(): void {
    this.controls.toggleMiniPlayer(false);
  }

  public minimizeToTaskbar(): void {
    this.controls.minimizeSystem();
  }

  public close(): void {
    this.controls.close();
  }
}
