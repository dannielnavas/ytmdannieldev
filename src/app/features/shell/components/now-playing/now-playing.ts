import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { PlaybackService } from '../../../../core/services/playback.service';
import {
  AudioVisualizerService,
  VISUALIZER_STYLES,
  VisualizerStyle,
} from '../../../../core/services/audio-visualizer.service';
import { LyricsPreferencesService } from '../../../../core/services/lyrics-preferences.service';
import { LyricsService } from '../../../../core/services/lyrics.service';
import { TrackMetadataService } from '../../../../core/services/track-metadata.service';
import { getHighResThumbnail } from '../../../../core/services/image-helper.service';
import { CoverPalette, Rgb } from '../../../../core/services/cover-palette.service';
import { formatTime } from '../../../../core/utils/format-time';
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
  LucideSearch,
  LucidePlus,
  LucideMinus,
  LucideRotateCcw,
  LucideSparkles,
  LucideMicVocal,
  LucideVolume2,
  LucideVolumeX,
  LucideX,
  LucideActivity,
} from '@lucide/angular';
import { LikeButton } from '../../../../shared/components/like-button/like-button';

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
    LucideSearch,
    LucidePlus,
    LucideMinus,
    LucideRotateCcw,
    LucideSparkles,
    LucideMicVocal,
    LucideVolume2,
    LucideVolumeX,
    LucideX,
    LucideActivity,
    LikeButton,
  ],
  templateUrl: './now-playing.html',
  styleUrl: './now-playing.css',
})
export class NowPlaying {
  public readonly playbackService = inject(PlaybackService);
  private readonly _lyricsService = inject(LyricsService);
  private readonly _trackMetadata = inject(TrackMetadataService);
  private readonly _router = inject(Router);
  private readonly _coverPalette = inject(CoverPalette);
  private readonly _visualizer = inject(AudioVisualizerService);
  private readonly _lyricsPreferences = inject(LyricsPreferencesService);
  private readonly _destroyRef = inject(DestroyRef);

  public $song = this.playbackService.$stream;
  public $dominantColor = signal<Rgb | null>(null);

  public visualizerCanvas = viewChild<ElementRef<HTMLCanvasElement>>('visualizer');
  /** False when Web Audio is unavailable: the canvas then stays empty. */
  public $visualizerActive = this._visualizer.$active;
  public readonly visualizerStyles = VISUALIZER_STYLES;
  public $visualizerStyle = this._visualizer.$style;
  public visualizerStyleLabel = computed(() => {
    const current = this._visualizer.$style();
    return VISUALIZER_STYLES.find((item) => item.id === current)?.label || 'Ondas';
  });

  public cycleVisualizerStyle(): void {
    this._visualizer.cycleStyle();
  }

  public $viewMode = signal<'cover' | 'lyrics'>('lyrics');
  public $animateArtwork = signal<boolean>(true);
  public $showRemainingTime = signal<boolean>(true);
  public $showVolumePopup = signal<boolean>(false);

  public backgroundStyle = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return {
        background: `radial-gradient(circle at 50% 30%, rgba(${r}, ${g}, ${b}, 0.35) 0%, rgba(${r}, ${g}, ${b}, 0.08) 55%, #08070d 100%)`,
      };
    }
    return { background: '#08070d' };
  });

  public dominantRgbString = computed(() => {
    const color = this.$dominantColor();
    if (color) {
      const [r, g, b] = color;
      return `${r}, ${g}, ${b}`;
    }
    return '120, 80, 220';
  });

  // Metadata comes from the shared service: mounting this view used to fire a
  // second request for the track `player-bar` had already asked for.
  public resourceMetadata = this._trackMetadata.$metadata;

  public trackTitle = computed(
    () => this.playbackService.$currentTrack()?.name || this.resourceMetadata().title || '',
  );
  public trackAuthor = computed(
    () => this.playbackService.$currentTrack()?.artist || this.resourceMetadata().author || '',
  );
  public trackAlbum = computed(() => this.playbackService.$sourceTitle() || '');
  public trackDuration = computed(() => {
    const live = this.playbackService.$duration();
    return live || this.playbackService.$effectiveDuration() || this.resourceMetadata().duration;
  });
  public currentArtworkUrl = computed(() => {
    const raw =
      this.playbackService.$currentTrack()?.thumbnail || this.resourceMetadata().thumbnail || '';
    return getHighResThumbnail(raw, 1024);
  });

  public formattedCurrentTime = computed(() => formatTime(this.playbackService.$currentTime()));
  public formattedDuration = computed(() => formatTime(this.trackDuration()));
  public formattedRemainingTime = computed(() => {
    const live = this.playbackService.$duration();
    const duration =
      live || this.playbackService.$effectiveDuration() || this.resourceMetadata().duration || 0;
    const current = this.playbackService.$currentTime();
    const remaining = Math.max(0, duration - current);
    return `-${formatTime(remaining)}`;
  });
  public displayDuration = computed(() =>
    this.$showRemainingTime() ? this.formattedRemainingTime() : this.formattedDuration(),
  );

  public readonly waveformBars = [
    30, 42, 58, 48, 75, 92, 85, 60, 72, 88, 52, 68, 86, 96, 74, 62, 78, 92, 68, 52, 42, 64, 82, 98,
    88, 72, 64, 84, 94, 100, 78, 64, 52, 68, 84, 92, 72, 58, 68, 84, 88, 72, 54, 44, 62, 78, 52, 38,
  ];

  public progressPercent = computed(() => this.playbackService.$progressPercent());
  public seekValueText = computed(
    () =>
      `${formatTime(this.playbackService.$currentTime())} de ${formatTime(this.trackDuration())}`,
  );

  public lyricsResource = rxResource({
    params: () => ({
      title: this.trackTitle(),
      author: this.trackAuthor(),
    }),
    stream: ({ params }) => {
      if (!params.title) return of(null);
      return this._lyricsService.getLyrics(params.title, params.author);
    },
  });

  /**
   * Synced lines when Lrclib returns them, plain lines otherwise.
   *
   * `plainLyrics` used to be discarded, so a track with lyrics but without an
   * LRC file was reported as "Letras no disponibles".
   */
  public parsedLyrics = computed(() => {
    const data = this.lyricsResource.value();
    if (!data) return [];
    if (data.syncedLyrics) {
      return this._lyricsService.parseSyncedLyrics(data.syncedLyrics);
    }
    return this._plainLyrics(data.plainLyrics);
  });

  public hasSyncedLyrics = computed(() => this.parsedLyrics().some((line) => line.time >= 0));

  // --- Lyrics timing and search ---------------------------------------------

  public $lyricsOffset = this._lyricsPreferences.$offset;
  public $lyricsQuery = signal('');

  public lyricsOffsetLabel = computed(() => this._lyricsPreferences.format(this.$lyricsOffset()));
  public canShiftLyricsEarlier = computed(() => this.$lyricsOffset() < 10);
  public canShiftLyricsLater = computed(() => this.$lyricsOffset() > -10);

  /**
   * Lines to render, each one keeping the index it has in `parsedLyrics()`.
   *
   * The index has to survive the filter: the current line and the scroll
   * position are resolved against the full list, not against what the search
   * happens to be showing.
   */
  public visibleLyrics = computed(() => {
    const lyrics = this.parsedLyrics();
    const query = normalizeLyricText(this.$lyricsQuery().trim());

    if (!query) {
      return lyrics.map((line, index) => ({ line, index }));
    }

    const matches: { line: (typeof lyrics)[number]; index: number }[] = [];
    lyrics.forEach((line, index) => {
      if (normalizeLyricText(line.text).includes(query)) matches.push({ line, index });
    });
    return matches;
  });

  public lyricsMatches = computed(() => {
    const total = this.parsedLyrics().length;
    return this.visibleLyrics().length.toString() + ' de ' + total.toString();
  });

  /**
   * Splits a line around the search term so it can be highlighted.
   *
   * The comparison happens on the normalized text, so an index found there does
   * not point at the same place in the original: each character is kept with
   * its normalized form to be able to walk back.
   */
  public lyricParts(text: string): { text: string; match: boolean }[] {
    const query = normalizeLyricText(this.$lyricsQuery().trim());
    if (!query || !text) return [{ text, match: false }];

    const chars = Array.from(text, (char) => ({ char, norm: normalizeLyricText(char) }));
    const normalized = chars.map((entry) => entry.norm).join('');
    if (!normalized.includes(query)) return [{ text, match: false }];

    const slice = (from: number, to: number): string =>
      chars
        .slice(from, to)
        .map((entry) => entry.char)
        .join('');

    const parts: { text: string; match: boolean }[] = [];
    let cursor = 0;
    let found = normalized.indexOf(query);

    while (found !== -1) {
      if (found > cursor) parts.push({ text: slice(cursor, found), match: false });
      parts.push({ text: slice(found, found + query.length), match: true });
      cursor = found + query.length;
      found = normalized.indexOf(query, cursor);
    }
    if (cursor < chars.length) parts.push({ text: slice(cursor, chars.length), match: false });

    return parts;
  }

  public currentLyricIndex = computed(() => {
    const lyrics = this.parsedLyrics();
    if (!lyrics.length) return -1;
    // The offset is added to the clock, not to the timestamps: a positive
    // correction brings the lines forward, which is what someone needs when the
    // lyrics of the database run behind the audio.
    const time = this.playbackService.$currentTime() + this.$lyricsOffset();

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
    // The canvas appears with the view, so the analyser is attached as soon as
    // it exists and the space is already reserved: no layout jump when the
    // first bars are drawn.
    effect(() => {
      const canvas = this.visualizerCanvas()?.nativeElement ?? null;
      untracked(() => (canvas ? this._visualizer.attach(canvas) : this._visualizer.detach()));
    });

    effect(() => {
      const color = this.$dominantColor();
      this._visualizer.setColor(color);
    });

    this._destroyRef.onDestroy(() => this._visualizer.detach());

    effect(() => {
      const track = this.playbackService.$currentTrack();
      // The queue usually carries title and artist, so no request is needed.
      this._trackMetadata.load(track?.videoId ?? null, Boolean(track?.name));
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

  public onImageLoad(img: HTMLImageElement): void {
    this.$dominantColor.set(this._coverPalette.dominant(img));
  }

  public goBack(): void {
    void this._router.navigate(['/']);
  }

  public togglePlay(): void {
    this.playbackService.togglePlay();
  }

  /** Seeks through the service so buffering and error state stay consistent. */
  public onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.playbackService.seekToPercent(Number(input.value));
  }

  /**
   * Seeking to the timestamp the user actually saw means undoing the offset,
   * otherwise every click lands on a different word than the one highlighted:
   * the correction moved the highlight, not the song.
   */
  public onLyricClick(time: number): void {
    if (time >= 0) {
      this.playbackService.seek(time - this.$lyricsOffset());
    }
  }

  public shiftLyrics(delta: number): void {
    this._lyricsPreferences.shift(delta);
  }

  public resetLyricsOffset(): void {
    this._lyricsPreferences.reset();
  }

  public onLyricsQuery(event: Event): void {
    this.$lyricsQuery.set((event.target as HTMLInputElement).value);
  }

  public clearLyricsQuery(): void {
    this.$lyricsQuery.set('');
  }

  public toggleViewMode(mode?: 'cover' | 'lyrics'): void {
    if (mode) {
      this.$viewMode.set(mode);
    } else {
      this.$viewMode.update((curr) => (curr === 'cover' ? 'lyrics' : 'cover'));
    }
  }

  public toggleAnimateArtwork(): void {
    this.$animateArtwork.update((curr) => !curr);
  }

  public toggleTimeDisplay(): void {
    this.$showRemainingTime.update((curr) => !curr);
  }

  public toggleMute(): void {
    this.playbackService.toggleMute();
  }

  public onVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.playbackService.setVolume(Number(input.value) / 100);
  }

  public toggleVolumePopup(): void {
    this.$showVolumePopup.update((v) => !v);
  }

  /**
   * `plainLyrics` has no timestamps, so lines get `time: -1` to mark them as
   * unsynced: the highlight stays off and clicking them does not seek.
   */
  private _plainLyrics(plain: string | null | undefined): { time: number; text: string }[] {
    if (!plain) return [];
    return plain
      .split('\n')
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .map((text) => ({ time: -1, text }));
  }
}

/**
 * Lowercase, accent-free text, so "cancion" finds "canción".
 */
function normalizeLyricText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
