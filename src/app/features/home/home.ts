import { Component, computed, effect, inject, linkedSignal } from '@angular/core';
import { Search } from '../search/search';
import { LucideCrown, LucidePlay } from '@lucide/angular';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { DashboardItem, IDashboard } from '../../core/models/dashboard';
import { ThumbnailUrlPipe } from '../../shared/pipes/thumbnail-url-pipe';
import { Auth } from '../../core/services/auth/auth';
import { Router } from '@angular/router';
import { PlaybackService } from '../../core/services/playback.service';
import { QueueCandidate } from '../../core/models/youtube';
import { getHighResThumbnail } from '../../core/services/image-helper.service';
import { BannerLikes } from '../../shared/components/banner-likes/banner-likes';
import { LikesSection } from '../../shared/components/likes-section/likes-section';
import { Header } from '../../shared/components/header/header';

interface RenderedSection {
  title: string;
  contents: DashboardItem[];
}

@Component({
  imports: [LucidePlay, ThumbnailUrlPipe, BannerLikes, LikesSection, Header],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly _dashboard = inject(Dashboard);

  private readonly _router = inject(Router);
  private readonly _playbackService = inject(PlaybackService);

  public resourceDashboard = rxResource({
    stream: () => this._dashboard.getDashboardData(),
    defaultValue: [],
  });

  public validSections = computed<RenderedSection[]>(() => {
    const raw = this.resourceDashboard.value() ?? [];
    return raw
      .map((section: IDashboard) => ({
        title: section.title,
        // El backend devuelve `null` en huecos de las rejillas.
        contents: (section.contents ?? []).filter((item): item is DashboardItem =>
          Boolean(item?.name?.trim()),
        ),
      }))
      .filter((section) => section.contents.length > 0);
  });

  public getThumbnailUrl(item: DashboardItem): string {
    const thumbs = item.thumbnails;
    if (!thumbs?.length) {
      return '';
    }
    return getHighResThumbnail(thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '', 500);
  }

  public playItem(item: DashboardItem, section?: RenderedSection): void {
    // `DashboardItem` es un union discriminado: narrowear da el tipo correcto,
    // así que ya no hace falta `as any` en ningún punto.
    if (item.type === 'ALBUM') {
      const albumId = item.albumId || item.playlistId;
      if (albumId) {
        this._router.navigate(['/album', albumId]);
      }
      return;
    }

    if (item.type === 'PLAYLIST') {
      const playlistId = item.playlistId || item.albumId;
      if (playlistId) {
        this._router.navigate(['/playlist', playlistId]);
      }
      return;
    }

    if (section?.contents.length) {
      // La sección completa se encola para poder saltar entre Canciones.
      const index = section.contents.indexOf(item);
      this._playbackService.playQueue(
        this._playbackService.toQueueItems(this._asSongs(section.contents), { size: 800 }),
        index,
        section.title,
      );
      return;
    }

    if (item.videoId) {
      this._playbackService.playSingle({
        videoId: item.videoId,
        name: item.name,
        artist: item.artist?.name || '',
        thumbnail: this.getThumbnailUrl(item),
      });
    }
  }

  /** Los items de canción de una sección son todos `SONG`. */
  private _asSongs(items: readonly DashboardItem[]): QueueCandidate[] {
    return items.flatMap((item) => (item.type === 'SONG' ? [item] : []));
  }
}
