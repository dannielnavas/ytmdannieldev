import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
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
import { SearchStore } from '../../core/store/search-store';
import { LikesService } from '../../core/services/likes.service';

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
  private readonly _searchStore = inject(SearchStore);
  private readonly _likesService = inject(LikesService);

  public readonly refreshTrigger = signal(0);
  public readonly isRefreshing = signal(false);

  /** Caché reactivo de imágenes de artistas obtenidas de YouTube Music */
  public readonly artistAvatars = signal<Record<string, string>>({});
  private readonly _loadingArtists = new Set<string>();

  constructor() {
    effect(() => {
      const artists = this.topArtists();
      const recs = this.recommendations();
      const allNames = [
        ...artists.map((a) => a.name),
        ...recs.slice(0, 4).map((r) => r.name),
      ].filter(Boolean);

      for (const name of allNames) {
        if (!this.artistAvatars()[name] && !this._loadingArtists.has(name)) {
          this._loadArtistAvatar(name);
        }
      }
    });
  }

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
      const playlistId = item.playlistId || item.albumId || item.videoId;
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
    this._searchStore.search(artistName).subscribe();
    this._router.navigate(['/search'], { queryParams: { q: artistName } });
  }

  public exploreRecommendation(rec: RecommendedArtistItem): void {
    if (!rec?.name) return;
    this._searchStore.search(rec.name).subscribe();
    this._router.navigate(['/search'], { queryParams: { q: rec.name } });
  }

  public getRecentLikeCover(track: PersonalRecentTrack): string {
    const raw =
      track.thumbnailUrl ||
      (track as any).thumbnail_url ||
      (track as any).thumbnail ||
      (track as any).imageUrl ||
      (track as any).coverUrl;
    if (raw) return raw;
    const id = track.youtubeId || (track as any).videoId;
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  }

  public onRecentLikeImageError(event: Event, track: PersonalRecentTrack): void {
    const img = event.target as HTMLImageElement;
    const id = track.youtubeId || (track as any).videoId;
    if (img && id) {
      const fallback = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      if (img.src !== fallback) {
        img.src = fallback;
      }
    }
  }

  /**
   * Obtiene la mejor imagen disponible para un artista principal:
   * 1. Avatar dinámico enriquecido de YouTube Music
   * 2. Imagen enviada por el backend si es válida
   * 3. Portada de alguna canción del usuario perteneciente a este artista
   */
  public getArtistImage(artist: EnrichedArtistItem): string {
    const dynamic = this.artistAvatars()[artist.name];
    if (dynamic) return dynamic;

    const direct = this._extractValidImageUrl(artist);
    if (direct) return direct;

    const fromSong = this._findSongCoverForArtist(artist.name);
    if (fromSong) return fromSong;

    return '';
  }

  public getRecommendationImage(rec: RecommendedArtistItem): string {
    const dynamic = this.artistAvatars()[rec.name];
    if (dynamic) return dynamic;

    const direct = this._extractValidImageUrl(rec);
    if (direct) return direct;

    const fromSource = this._findSongCoverForArtist(rec.sourceArtist);
    if (fromSource) return fromSource;

    return '';
  }

  public onArtistImageError(event: Event, artist: EnrichedArtistItem): void {
    const img = event.target as HTMLImageElement;
    if (!img) return;
    const fallback = this._findSongCoverForArtist(artist.name);
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    } else {
      img.style.display = 'none';
    }
  }

  public onRecommendationImageError(event: Event, rec: RecommendedArtistItem): void {
    const img = event.target as HTMLImageElement;
    if (!img) return;
    const fallback = this._findSongCoverForArtist(rec.sourceArtist);
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    } else {
      img.style.display = 'none';
    }
  }

  private _loadArtistAvatar(name: string): void {
    if (typeof this._dashboard?.searchSongs !== 'function') return;
    this._loadingArtists.add(name);
    this._dashboard.searchSongs(name).subscribe({
      next: (res) => {
        const norm = name.trim().toLowerCase();
        let avatarUrl = '';

        const matchedArtist =
          res?.artists?.find(
            (a) =>
              a.name &&
              (a.name.toLowerCase() === norm ||
                a.name.toLowerCase().includes(norm) ||
                norm.includes(a.name.toLowerCase())),
          ) || res?.artists?.[0];

        if (matchedArtist?.thumbnails?.length) {
          const last = matchedArtist.thumbnails[matchedArtist.thumbnails.length - 1];
          avatarUrl = last?.url ? getHighResThumbnail(last.url, 400) : '';
        }

        if (!avatarUrl && res?.songs?.length) {
          const songMatch =
            res.songs.find(
              (s) =>
                s.artist?.name &&
                (s.artist.name.toLowerCase().includes(norm) ||
                  norm.includes(s.artist.name.toLowerCase())),
            ) || res.songs[0];
          if (songMatch?.thumbnails?.length) {
            const last = songMatch.thumbnails[songMatch.thumbnails.length - 1];
            avatarUrl = last?.url ? getHighResThumbnail(last.url, 400) : '';
          }
          if (!avatarUrl && songMatch?.videoId) {
            avatarUrl = `https://i.ytimg.com/vi/${songMatch.videoId}/hqdefault.jpg`;
          }
        }

        if (!avatarUrl && res?.albums?.length) {
          const albumMatch =
            res.albums.find(
              (a) =>
                a.artist?.name &&
                (a.artist.name.toLowerCase().includes(norm) ||
                  norm.includes(a.artist.name.toLowerCase())),
            ) || res.albums[0];
          if (albumMatch?.thumbnails?.length) {
            const last = albumMatch.thumbnails[albumMatch.thumbnails.length - 1];
            avatarUrl = last?.url ? getHighResThumbnail(last.url, 400) : '';
          }
        }

        if (avatarUrl) {
          this.artistAvatars.update((map) => ({ ...map, [name]: avatarUrl }));
        }
      },
      error: () => {
        // En caso de fallo o desconexión, se mantiene el fallback local
      },
    });
  }

  private _findSongCoverForArtist(artistName: string): string {
    if (!artistName) return '';
    const norm = artistName.trim().toLowerCase();

    // 1. Buscar en canciones favoritas locales
    const liked = this._likesService.$likedSongs();
    const likedMatch = liked.find(
      (s) =>
        s.artist &&
        (s.artist.toLowerCase().includes(norm) || norm.includes(s.artist.toLowerCase())),
    );
    if (likedMatch?.thumbnailUrl) {
      return likedMatch.thumbnailUrl;
    }
    if (likedMatch?.videoId) {
      return `https://i.ytimg.com/vi/${likedMatch.videoId}/hqdefault.jpg`;
    }

    // 2. Buscar en recentLikes
    const recent = this.recentLikes();
    const recentMatch = recent.find(
      (t) =>
        t.artist &&
        (t.artist.toLowerCase().includes(norm) || norm.includes(t.artist.toLowerCase())),
    );
    if (recentMatch) {
      return this.getRecentLikeCover(recentMatch);
    }

    // 3. Buscar en secciones de YouTube cargadas
    for (const section of this.validSections()) {
      for (const item of section.contents) {
        if (
          item.artist?.name &&
          (item.artist.name.toLowerCase().includes(norm) ||
            norm.includes(item.artist.name.toLowerCase()))
        ) {
          const thumb = this.getThumbnailUrl(item);
          if (thumb) return thumb;
        }
      }
    }

    return '';
  }

  private _extractValidImageUrl(item: any): string {
    if (!item) return '';
    const raw: any = item;
    let url = '';

    if (typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) {
      url = raw.imageUrl.trim();
    } else if (typeof raw.image_url === 'string' && raw.image_url.trim()) {
      url = raw.image_url.trim();
    } else if (typeof raw.image === 'string' && raw.image.trim()) {
      url = raw.image.trim();
    } else if (Array.isArray(raw.image) && raw.image.length > 0) {
      const last = raw.image[raw.image.length - 1];
      url = last?.['#text'] || last?.url || (typeof last === 'string' ? last : '');
    } else if (typeof raw.picture === 'string' && raw.picture.trim()) {
      url = raw.picture.trim();
    } else if (typeof raw.avatar === 'string' && raw.avatar.trim()) {
      url = raw.avatar.trim();
    } else if (Array.isArray(raw.thumbnails) && raw.thumbnails.length > 0) {
      url = raw.thumbnails[raw.thumbnails.length - 1]?.url || '';
    }

    // Descartar placeholders genéricos de Last.fm que vienen sin imagen real
    if (
      url &&
      (url.includes('2a96cbd8b46e442fc41c2b86b821562f') || url.endsWith('/default_artist.png'))
    ) {
      return '';
    }

    return url;
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
