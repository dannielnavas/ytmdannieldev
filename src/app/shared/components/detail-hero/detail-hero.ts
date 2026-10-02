import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  LucideCalendar,
  LucideClock,
  LucideDisc,
  LucideListMusic,
  LucideMusic,
  LucidePlay,
  LucideShuffle,
} from '@lucide/angular';
import { CoverPalette, Rgb } from '../../../core/services/cover-palette.service';
import { Thumbnail } from '../../../core/services/thumbnail';

export type DetailKind = 'ALBUM' | 'PLAYLIST';

/**
 * Cabecera de las páginas de detalle: portada, título, artista, métricas y los
 * botones Reproducir / Aleatorio.
 *
 * `detail-info-album` (141 líneas) y `detail-info-playlist` (124) eran casi
 * idénticos y además arrastraban una copia de la lógica de degradado de
 * miniaturas; los dos componentes se reduce a la configuración de `kind`.
 */
@Component({
  imports: [
    LucidePlay,
    LucideShuffle,
    LucideMusic,
    LucideDisc,
    LucideListMusic,
    LucideCalendar,
    LucideClock,
    Thumbnail,
  ],
  selector: 'app-detail-hero',
  styleUrl: './detail-hero.css',
  templateUrl: './detail-hero.html',
})
export class DetailHero {
  private readonly _palette = inject(CoverPalette);

  public readonly kind = input<DetailKind>('ALBUM');
  public readonly title = input('');
  public readonly artist = input('');
  public readonly thumbnails = input<readonly { url: string }[]>([]);
  public readonly totalSongs = input(0);
  /** Segundos; solo se muestra en álbumes, donde sí se conoce. */
  public readonly totalDuration = input(0);
  public readonly year = input<string | number | null>(null);

  public readonly playAll = output<void>();
  public readonly playShuffle = output<void>();

  public readonly $color = signal<Rgb | null>(null);
  public readonly $colors = signal<Rgb[]>([]);

  public readonly kindLabel = computed(() => (this.kind() === 'ALBUM' ? 'Álbum' : 'Playlist'));
  public readonly placeholderTitle = computed(() =>
    this.kind() === 'ALBUM' ? 'Carátula de álbum' : 'Carátula de playlist',
  );
  public readonly missingTitle = computed(() =>
    this.kind() === 'ALBUM' ? 'Álbum sin título' : 'Playlist sin título',
  );
  public readonly playAllLabel = computed(() =>
    this.kind() === 'ALBUM' ? 'Reproducir álbum completo' : 'Reproducir playlist',
  );
  public readonly shuffleLabel = computed(() =>
    this.kind() === 'ALBUM' ? 'Reproducción aleatoria del álbum' : 'Reproducción aleatoria',
  );

  public readonly songCountLabel = computed(() => {
    const count = this.totalSongs();
    return count === 1 ? '1 canción' : `${count} canciones`;
  });

  public readonly totalDurationLabel = computed(() => {
    const totalSecs = this.totalDuration();
    if (!totalSecs || totalSecs <= 0) return '';
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  });

  public readonly yearLabel = computed(() => {
    const year = this.year();
    return year ? String(year) : '';
  });

  public readonly heroGradientStyle = computed(() => this._palette.heroGradient(this.$color()));
  public readonly glowStyle1 = computed(() => this._palette.glow(this.$color(), 0.4));
  public readonly glowStyle2 = computed(() => {
    const palette = this.$colors();
    const color = this.$color();
    if (palette.length > 1) {
      return this._palette.glow(palette[1], 0.3, '99, 102, 241');
    }
    return this._palette.glow(color, 0.25, '99, 102, 241');
  });
  public readonly artworkShadowStyle = computed(() => this._palette.artworkShadow(this.$color()));
  public readonly playButtonStyle = computed(() =>
    this._palette.playButton(this.$color(), this.$colors()),
  );
  public readonly playButtonGlassStyle = computed(() => {
    const color = this.$color();
    const colors = this.$colors();
    if (color && colors.length > 1) {
      const [r1, g1, b1] = color;
      const [r2, g2, b2] = colors[1];
      return {
        background: `linear-gradient(135deg, rgba(${r1}, ${g1}, ${b1}, 0.62) 0%, rgba(${r2}, ${g2}, ${b2}, 0.38) 100%)`,
        'box-shadow': `inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.55), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.4), 0 12px 28px -6px rgba(${r1}, ${g1}, ${b1}, 0.55)`,
        'border-color': `rgba(${Math.min(255, r1 + 50)}, ${Math.min(255, g1 + 50)}, ${Math.min(255, b1 + 50)}, 0.45)`,
      };
    }
    if (color) {
      const [r, g, b] = color;
      return {
        background: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.62) 0%, rgba(${r}, ${g}, ${b}, 0.32) 100%)`,
        'box-shadow': `inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.55), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.4), 0 12px 28px -6px rgba(${r}, ${g}, ${b}, 0.55)`,
        'border-color': `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.45)`,
      };
    }
    return {
      background: `linear-gradient(135deg, rgba(147, 51, 234, 0.65) 0%, rgba(79, 70, 229, 0.4) 100%)`,
      'box-shadow': `inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.55), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.4), 0 12px 28px -6px rgba(147, 51, 234, 0.5)`,
      'border-color': `rgba(192, 132, 252, 0.5)`,
    };
  });
  public readonly badgeStyle = computed(() => this._palette.badge(this.$color()));

  public onImageLoad(img: HTMLImageElement): void {
    const { color, palette } = this._palette.extract(img);
    this.$color.set(color);
    this.$colors.set(palette);
  }
}
