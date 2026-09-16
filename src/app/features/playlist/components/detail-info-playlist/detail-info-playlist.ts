import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { InfoPlaylist } from '../../../../core/models/playlist.model';
import { ColorThiefService } from '@soarlin/angular-color-thief';
import { ImageHelperService, getHighResThumbnail } from '../../../../core/services/image-helper.service';
import {
  LucidePlay,
  LucideShuffle,
  LucideMusic,
  LucideListMusic,
  LucideSparkles,
} from '@lucide/angular';

@Component({
  imports: [LucidePlay, LucideShuffle, LucideMusic, LucideListMusic, LucideSparkles],
  selector: 'app-detail-info-playlist',
  styleUrl: './detail-info-playlist.css',
  templateUrl: './detail-info-playlist.html',
})
export class DetailInfoPlaylist {
  private readonly _colorThief = inject(ColorThiefService);
  private readonly _imageHelper = inject(ImageHelperService);

  public $infoPlaylist = input<InfoPlaylist>();
  public $totalSongs = input<number>();

  public playAll = output<void>();
  public playShuffle = output<void>();

  public $dominantColor = signal<[number, number, number] | null>(null);
  public $palette = signal<[number, number, number][] | null>(null);

  public $thumbnailIndex = linkedSignal({
    source: this.$infoPlaylist,
    computation: () => 0,
  });

  public $hasImageError = linkedSignal({
    source: this.$infoPlaylist,
    computation: () => false,
  });

  public thumbnailUrl = computed(() => {
    if (this.$hasImageError()) return '';
    const thumbs = this.$infoPlaylist()?.thumbnails;
    if (!thumbs || thumbs.length === 0) return '';
    const index = this.$thumbnailIndex();
    const raw = (index >= 0 && index < thumbs.length) ? thumbs[index]?.url : thumbs[thumbs.length - 1]?.url;
    return getHighResThumbnail(raw || '', 800);
  });

  public onImageLoad(img: HTMLImageElement): void {
    if (!img) return;
    try {
      const color = this._colorThief.getColor(img, 10);
      if (color && color.length === 3) {
        this.$dominantColor.set(color);
      }
      const palette = this._colorThief.getPalette(img, 5, 10);
      if (palette && palette.length > 0) {
        this.$palette.set(palette);
      }
    } catch (err) {
      console.warn('ColorThief: No se pudo analizar la paleta de la imagen:', err);
    }
  }

  public onImageError(): void {
    const currentUrl = this.thumbnailUrl();
    this._imageHelper.recordFailure(currentUrl);

    const currentAttempt = this.$thumbnailIndex();
    const thumbs = this.$infoPlaylist()?.thumbnails;
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

  public songCountLabel = computed(() => {
    const count = this.$totalSongs() ?? this.$infoPlaylist()?.videoCount ?? 0;
    if (count === 1) return '1 canción';
    return `${count} canciones`;
  });

  public heroGradientStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.45) 0%, rgba(${r}, ${g}, ${b}, 0.12) 55%, rgba(12, 10, 21, 0) 100%)`;
    }
    return 'linear-gradient(180deg, rgba(88, 28, 135, 0.4) 0%, rgba(59, 7, 100, 0.1) 55%, rgba(12, 10, 21, 0) 100%)';
  });

  public glowStyle1 = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.4) 0%, rgba(${r}, ${g}, ${b}, 0) 70%)`;
    }
    return 'radial-gradient(circle, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0) 70%)';
  });

  public glowStyle2 = computed(() => {
    const palette = this.$palette();
    if (palette && palette.length > 1) {
      const [r, g, b] = palette[1];
      return `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.3) 0%, rgba(${r}, ${g}, ${b}, 0) 70%)`;
    }
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.25) 0%, rgba(${r}, ${g}, ${b}, 0) 70%)`;
    }
    return 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 70%)';
  });

  public artworkShadowStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return `0 25px 50px -12px rgba(${r}, ${g}, ${b}, 0.55)`;
    }
    return '0 25px 50px -12px rgba(88, 28, 135, 0.6)';
  });

  public playButtonStyle = computed(() => {
    const color = this.$dominantColor();
    const palette = this.$palette();
    if (color && palette && palette.length > 1) {
      const [r1, g1, b1] = color;
      const [r2, g2, b2] = palette[1];
      return {
        background: `linear-gradient(135deg, rgb(${r1}, ${g1}, ${b1}) 0%, rgb(${r2}, ${g2}, ${b2}) 100%)`,
        'box-shadow': `0 10px 25px -5px rgba(${r1}, ${g1}, ${b1}, 0.5)`,
      };
    } else if (color) {
      const [r, g, b] = color;
      return {
        background: `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgba(${r}, ${g}, ${b}, 0.8) 100%)`,
        'box-shadow': `0 10px 25px -5px rgba(${r}, ${g}, ${b}, 0.5)`,
      };
    }
    return {};
  });

  public badgeStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        'background-color': `rgba(${r}, ${g}, ${b}, 0.25)`,
        'border-color': `rgba(${r}, ${g}, ${b}, 0.45)`,
        color: `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`,
      };
    }
    return {};
  });
}
