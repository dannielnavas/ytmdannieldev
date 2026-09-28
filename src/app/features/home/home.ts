import { Component, computed, inject, linkedSignal } from '@angular/core';
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
import { UserModel } from '../../core/models/user.model';
import { getHighResThumbnail } from '../../core/services/image-helper.service';

interface RenderedSection {
  title: string;
  contents: DashboardItem[];
}

@Component({
  imports: [Search, LucidePlay, LucideCrown, ThumbnailUrlPipe],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly _dashboard = inject(Dashboard);
  private readonly _authService = inject(Auth);
  private readonly _router = inject(Router);
  private readonly _playbackService = inject(PlaybackService);

  public resourceMe = rxResource({
    stream: () => this._authService.getMe(),
    defaultValue: {} as UserModel,
  });

  public resourceDashboard = rxResource({
    stream: () => this._dashboard.getDashboardData(),
    defaultValue: [],
  });

  public $lettersName = computed(() => {
    const name = this.resourceMe.value()?.full_name;
    if (!name) {
      return '';
    }
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  /**
   * Se reinicia sola cuando cambia el usuario, así que un avatar que falló en
   * una sesión no se queda roto para siempre.
   */
  public hasAvatarError = linkedSignal({
    source: () => this.resourceMe.value()?.profile_image ?? null,
    computation: () => false,
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
