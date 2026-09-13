import { Component, computed, inject } from '@angular/core';
import { Search } from '../search/search';
import { LucidePlay } from '@lucide/angular';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { rxResource } from '@angular/core/rxjs-interop';
import { DashboardItem } from '../../core/models/dashboard';
import { ThumbnailUrlPipe } from '../../shared/pipes/thumbnail-url-pipe';
import { GlobalStorage } from '../../core/store/global-storage';
import { Auth } from '../../core/services/auth/auth';
import { Router } from '@angular/router';
import { PlaybackService } from '../../core/services/playback.service';
import { QueueItem } from '../../core/models/queue.model';

@Component({
  imports: [Search, LucidePlay, ThumbnailUrlPipe],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly _dashboard = inject(Dashboard);
  private readonly _globalStorage = inject(GlobalStorage);
  private readonly _authService = inject(Auth);
  private readonly _router = inject(Router);
  private readonly _playbackService = inject(PlaybackService);

  // public resourceMe = rxResource({
  //   stream: () => this._authService.getMe(),
  //   defaultValue: {},
  // });

  public resourceDashboard = rxResource({
    stream: () => this._dashboard.getDashboardData(),
    defaultValue: [],
  });

  public validSections = computed(() => {
    const raw = this.resourceDashboard.value() ?? [];
    return raw
      .map((section) => ({
        title: section.title,
        contents: (section.contents ?? []).filter((item): item is DashboardItem =>
          Boolean(item && item.name && item.name.trim().length > 0),
        ),
      }))
      .filter((section) => section.contents.length > 0);
  });

  public getThumbnailUrl(item: DashboardItem): string {
    if (!item.thumbnails || item.thumbnails.length === 0) {
      return '';
    }
    return item.thumbnails[item.thumbnails.length - 1]?.url || item.thumbnails[0]?.url;
  }

  public playItem(
    item: DashboardItem,
    section?: { title: string; contents: DashboardItem[] },
  ): void {
    console.log(item);
    if ((item as any).type === 'ALBUM') {
      const albumItem = item as any;
      const albumId = albumItem.albumId || albumItem.playlistId || '';
      const playlistId = albumItem.playlistId || '';
      const thumb = this.getThumbnailUrl(item);
      this._globalStorage.setStore('album', {
        albumId,
        playlistId,
        videoId: albumItem.videoId || '',
        name: item.name,
        artist: (item as any).artist?.name || '',
        thumbnail: thumb,
      });
      this._router.navigate(['/album']);
      return;
    }
    if (item.type === 'PLAYLIST') {
      const playlistItem = item as any;
      const playlistId = playlistItem.playlistId || playlistItem.albumId || '';
      const albumId = playlistItem.albumId || '';
      const thumb = this.getThumbnailUrl(item);
      this._globalStorage.setStore('playlist', {
        playlistId,
        albumId,
        videoId: playlistItem.videoId || '',
        name: item.name,
        artist: (item as any).artist?.name || '',
        thumbnail: thumb,
      });
      this._router.navigate(['/playlist']);
      return;
    }

    const elements = item as { albumId?: string; videoId?: string; playlistId?: string };
    const rawId = elements.albumId ?? elements.videoId ?? elements.playlistId;

    if (!rawId) {
      console.error('No se pudo obtener el id del item');
      return;
    }

    const id = rawId.replace(/^RDAM(?:VM|PL)/, '');

    if (section?.contents?.length) {
      const items: QueueItem[] = section.contents
        .map((it) => {
          const itElements = it as { albumId?: string; videoId?: string; playlistId?: string };
          const itId = (
            itElements.albumId ??
            itElements.videoId ??
            itElements.playlistId ??
            ''
          ).replace(/^RDAM(?:VM|PL)/, '');
          const thumb =
            it.thumbnails?.[it.thumbnails.length - 1]?.url || it.thumbnails?.[0]?.url || '';
          return {
            videoId: itId,
            name: it.name,
            artist: (it as any).artist?.name || '',
            thumbnail: thumb,
          };
        })
        .filter((it) => !!it.videoId);

      const clickedIndex = items.findIndex((it) => it.videoId === id);
      if (items.length > 0 && clickedIndex !== -1) {
        this._playbackService.playQueue(items, clickedIndex, section.title);
        return;
      }
    }

    this._playbackService.playSingle({
      videoId: id,
      name: item.name,
      artist: (item as any).artist?.name || '',
      thumbnail:
        item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnails?.[0]?.url || '',
    });
  }
}
