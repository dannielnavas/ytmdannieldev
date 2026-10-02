import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideHeart, LucideMusic, LucidePause, LucidePlay, LucideSparkles } from '@lucide/angular';
import { LikedSong, LikesService } from '../../../core/services/likes.service';
import { PlaybackService } from '../../../core/services/playback.service';
import { QueueItem } from '../../../core/models/queue.model';
import { LikeButton } from '../like-button/like-button';

@Component({
  selector: 'app-likes-section',
  imports: [LucideHeart, LucidePlay, LucidePause, LucideSparkles, LucideMusic, LikeButton],
  templateUrl: './likes-section.html',
  styleUrl: './likes-section.css',
})
export class LikesSection implements OnInit {
  private readonly _router = inject(Router);
  private readonly _likesService = inject(LikesService);
  private readonly _playbackService = inject(PlaybackService);

  public readonly likedCount = this._likesService.$likedCount;
  public readonly likedSongs = this._likesService.$likedSongs;

  /** Muestra hasta 4 canciones recientemente marcadas con Me Gusta en la rejilla */
  public readonly recentSongs = computed(() => this.likedSongs().slice(0, 4));

  /** Miniaturas de las canciones favoritas para la portada del hero card */
  public readonly recentThumbnails = computed(() =>
    this.likedSongs()
      .map((s) => s.thumbnailUrl)
      .filter((url): url is string => Boolean(url)),
  );

  /** Indica si actualmente se reproduce la lista de Tus Me Gusta */
  public readonly isPlayingLikes = computed(
    () =>
      this._playbackService.$isPlaying() && this._playbackService.$sourceTitle() === 'Tus Me Gusta',
  );

  ngOnInit(): void {
    this._likesService.fetchFavoritesFromBackend().subscribe();
  }

  public goToLikes(): void {
    this._router.navigate(['/likes']);
  }

  public togglePlayLikes(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (this.isPlayingLikes()) {
      this._playbackService.pause();
    } else if (
      this._playbackService.$sourceTitle() === 'Tus Me Gusta' &&
      this._playbackService.$stream()
    ) {
      this._playbackService.play();
    } else {
      this.playAll();
    }
  }

  public playAll(): void {
    const songs = this.likedSongs();
    if (!songs.length) {
      this.goToLikes();
      return;
    }
    this.playSong(songs[0], 0);
  }

  public playSong(song: LikedSong, index: number): void {
    const songs = this.likedSongs();
    if (!songs.length) return;

    const queueItems: QueueItem[] = this._playbackService.normalizeQueueItems(
      songs.map((s) => ({
        videoId: s.videoId,
        name: s.name,
        artist: s.artist || 'Desconocido',
        thumbnail: s.thumbnailUrl,
        duration: s.duration ?? undefined,
      })),
    );

    this._playbackService.playQueue(queueItems, index, 'Tus Me Gusta');
  }
}
