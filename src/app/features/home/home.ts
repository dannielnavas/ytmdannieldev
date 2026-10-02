import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  LucideArrowRight,
  LucideClock,
  LucideCompass,
  LucideFlame,
  LucideHeart,
  LucideLayers,
  LucideMusic,
  LucidePlay,
  LucideRotateCw,
  LucideSearch,
  LucideSparkles,
  LucideTrendingUp,
  LucideUsers,
} from '@lucide/angular';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import {
  DashboardItem,
  DashboardResponse,
  EnrichedArtistItem,
  IDashboard,
  PersonalRecentTrack,
  RecommendedArtistItem,
} from '../../core/models/dashboard';
import { ThumbnailUrlPipe } from '../../shared/pipes/thumbnail-url-pipe';
import { PlaybackService } from '../../core/services/playback.service';
import { QueueCandidate } from '../../core/models/youtube';
import { QueueItem } from '../../core/models/queue.model';
import { getHighResThumbnail } from '../../core/services/image-helper.service';
import { Header } from '../../shared/components/header/header';
import { LikeButton } from '../../shared/components/like-button/like-button';

interface RenderedSection {
  title: string;
  contents: DashboardItem[];
}

export type HomeViewTab = 'hybrid' | 'personal' | 'youtube';

function normalizeDashboardResponse(data: unknown): DashboardResponse {
  if (!data) {
    return {
      hasPersonalData: false,
      activeView: 'youtube',
      personal: null,
      youtube: [],
    };
  }
  if (Array.isArray(data)) {
    return {
      hasPersonalData: false,
      activeView: 'youtube',
      personal: null,
      youtube: data as IDashboard[],
    };
  }
  const resp = data as DashboardResponse;
  return {
    hasPersonalData: Boolean(resp.hasPersonalData),
    activeView: resp.activeView || 'youtube',
    personal: resp.personal || null,
    youtube: Array.isArray(resp.youtube) ? resp.youtube : [],
  };
}

@Component({
  imports: [
    LucidePlay,
    LucideHeart,
    LucideSparkles,
    LucideClock,
    LucideFlame,
    LucideTrendingUp,
    LucideUsers,
    LucideCompass,
    LucideRotateCw,
    LucideSearch,
    LucideMusic,
    LucideLayers,
    LucideArrowRight,
    ThumbnailUrlPipe,
    Header,
    LikeButton,
  ],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly _dashboard = inject(Dashboard);
  private readonly _router = inject(Router);
  private readonly _playbackService = inject(PlaybackService);

  public readonly refreshTrigger = signal(0);
  public readonly isRefreshing = signal(false);

  public readonly resourceDashboard = rxResource({
    stream: () => {
      const forceRefresh = this.refreshTrigger() > 0 && this.isRefreshing();
      return this._dashboard.getDashboard({
        includeYoutube: true,
        refresh: forceRefresh,
      });
    },
    defaultValue: {
      hasPersonalData: false,
      activeView: 'youtube',
      personal: null,
      youtube: [],
    } satisfies DashboardResponse,
  });

  public readonly dashboardResponse = computed<DashboardResponse>(() =>
    normalizeDashboardResponse(this.resourceDashboard.value()),
  );

  public readonly hasPersonalData = computed<boolean>(
    () => this.dashboardResponse().hasPersonalData,
  );

  public readonly personal = computed(() => this.dashboardResponse().personal);

  public readonly kpis = computed(() => this.personal()?.kpis ?? null);

  public readonly topArtists = computed<EnrichedArtistItem[]>(
    () => this.personal()?.topArtists ?? [],
  );

  public readonly topGenres = computed(() => this.personal()?.topGenres ?? []);

  public readonly recentLikes = computed<PersonalRecentTrack[]>(
    () => this.personal()?.recentLikes ?? [],
  );

  public readonly recommendations = computed<RecommendedArtistItem[]>(
    () => this.personal()?.recommendations ?? [],
  );

  public readonly validSections = computed<RenderedSection[]>(() => {
    const raw = this.dashboardResponse().youtube ?? [];
    return raw
      .map((section: IDashboard) => ({
        title: section.title,
        contents: (section.contents ?? []).filter((item): item is DashboardItem =>
          Boolean(item?.name?.trim()),
        ),
      }))
      .filter((section) => section.contents.length > 0);
  });

  /**
   * Pestaña activa: Por defecto es 'hybrid' si el usuario tiene datos personales,
   * o 'youtube' en fallback para nuevos usuarios.
   */
  public readonly activeTab = linkedSignal<HomeViewTab>(() =>
    this.dashboardResponse().activeView === 'personal' ? 'hybrid' : 'youtube',
  );

  public setTab(tab: HomeViewTab): void {
    this.activeTab.set(tab);
  }

  public reload(): void {
    this.isRefreshing.set(true);
    this.refreshTrigger.update((n) => n + 1);
    setTimeout(() => this.isRefreshing.set(false), 900);
  }

  public getThumbnailUrl(item: DashboardItem): string {
    const thumbs = item.thumbnails;
    if (!thumbs?.length) {
      return '';
    }
    return getHighResThumbnail(thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '', 500);
  }

  public playRecentLike(track: PersonalRecentTrack, index: number): void {
    const tracks = this.recentLikes();
    if (!tracks.length) return;

    const queueItems: QueueItem[] = this._playbackService.normalizeQueueItems(
      tracks.map((t) => ({
        videoId: t.youtubeId,
        name: t.title,
        artist: t.artist || 'Desconocido',
        thumbnail: t.thumbnailUrl,
        duration: t.duration,
      })),
    );

    this._playbackService.playQueue(queueItems, index, 'Tus Me Gusta');
  }

  public playItem(item: DashboardItem, section?: RenderedSection): void {
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

  public exploreArtist(artistName: string): void {
    if (!artistName) return;
    this._router.navigate(['/search'], { queryParams: { q: artistName } });
  }

  public exploreRecommendation(rec: RecommendedArtistItem): void {
    if (!rec?.name) return;
    this._router.navigate(['/search'], { queryParams: { q: rec.name } });
  }

  public goToLikes(): void {
    this._router.navigate(['/likes']);
  }

  public formatDuration(seconds?: number | null): string {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  public formatListeners(listeners?: string): string {
    if (!listeners) return '';
    const num = Number(listeners);
    if (Number.isNaN(num) || num <= 0) return '';
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M oyentes`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(0)}k oyentes`;
    }
    return `${num} oyentes`;
  }

  private _asSongs(items: readonly DashboardItem[]): QueueCandidate[] {
    return items.flatMap((item) => (item.type === 'SONG' ? [item] : []));
  }
}

