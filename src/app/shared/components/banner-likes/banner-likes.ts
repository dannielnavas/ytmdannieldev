import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideArrowRight,
  LucideHeart,
  LucideMusic,
  LucidePlay,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { LikesService } from '../../../core/services/likes.service';
import { PlaybackService } from '../../../core/services/playback.service';
import { QueueItem } from '../../../core/models/queue.model';

@Component({
  imports: [
    LucideHeart,
    LucidePlay,
    LucideSparkles,
    LucideMusic,
    LucideArrowRight,
    LucideX,
  ],
  selector: 'app-banner-likes',
  styleUrl: './banner-likes.css',
  templateUrl: './banner-likes.html',
})
export class BannerLikes {
  private readonly _router = inject(Router);
  private readonly _likesService = inject(LikesService);
  private readonly _playbackService = inject(PlaybackService);

  /** Si el banner puede ser cerrado por el usuario */
  public readonly dismissible = input(true);

  /** Emite cuando el usuario descarta el banner */
  public readonly dismissed = output<void>();

  /** Estado local de descarte */
  public readonly isDismissed = signal(false);

  /** Estado interactivo del botón de demostración dentro del banner */
  public readonly demoLiked = signal(false);
  public readonly demoAnimating = signal(false);

  /** Señales de likes desde el servicio centralizado */
  public readonly likedCount = this._likesService.$likedCount;
  public readonly likedSongs = this._likesService.$likedSongs;

  /** Portadas de canciones favoritas para mostrar en el preview */
  public readonly recentThumbnails = computed(() => {
    return this.likedSongs()
      .map((s) => s.thumbnailUrl)
      .filter((url): url is string => Boolean(url))
      .slice(-3)
      .reverse();
  });

  public goToMyLikes(): void {
    this._router.navigate(['/likes']);
  }

  public playMyLikes(): void {
    const songs = this.likedSongs();
    if (songs.length === 0) {
      this.goToMyLikes();
      return;
    }

    const queueItems: QueueItem[] = this._playbackService.normalizeQueueItems(
      songs.map((s) => ({
        videoId: s.videoId,
        name: s.name,
        artist: s.artist || 'Desconocido',
        thumbnail: s.thumbnailUrl,
        duration: s.duration ?? undefined,
      })),
    );

    this._playbackService.playQueue(queueItems, 0, 'Tus Me Gusta');
  }

  public toggleDemoLike(): void {
    this.demoLiked.update((v) => !v);
    this.demoAnimating.set(true);
    setTimeout(() => this.demoAnimating.set(false), 400);
  }

  public dismiss(): void {
    this.isDismissed.set(true);
    this.dismissed.emit();
  }
}
