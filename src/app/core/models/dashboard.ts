import { Album, Artist, Song, SourceSong, Thumbnail } from './youtube';

export type { Album, Artist, Song, SourceSong, Thumbnail };

export interface DashboardAlbumItem {
  type: 'ALBUM';
  albumId?: string | null;
  playlistId: string;
  name: string;
  artist: Artist;
  year?: number | string | null;
  thumbnails: Thumbnail[];
}

export interface DashboardPlaylistItem {
  type: 'PLAYLIST';
  playlistId: string;
  name: string;
  artist: Artist;
  thumbnails: Thumbnail[];
  /** Presente en algunas respuestas de playlist, ausente en otras. */
  albumId?: string | null;
  videoId?: string | null;
}

export interface DashboardSongItem {
  type: 'SONG';
  videoId?: string;
  name: string;
  artist: Artist;
  album?: Album | null;
  duration?: number | string | null;
  thumbnails: Thumbnail[];
  albumId?: string | null;
  playlistId?: string | null;
}

/**
 * Union discriminado por `type`. Narrowear con `item.type === 'ALBUM'` da el tipo
 * correcto, así que `home.ts` ya no necesita castear con `as any`.
 */
export type DashboardItem = DashboardAlbumItem | DashboardPlaylistItem | DashboardSongItem;

export interface IDashboard {
  title: string;
  contents: (DashboardItem | null)[];
}

export interface DashboardKpis {
  totalLikes: number;
  totalDurationSeconds: number;
  totalMinutes: number;
  totalHours: number;
  uniqueArtists: number;
  favoriteArtist: string | null;
}

export interface EnrichedArtistItem {
  name: string;
  likesCount: number;
  totalDurationSeconds: number;
  imageUrl?: string;
  bio?: string;
  listeners?: string;
  tags?: string[];
  lastFmUrl?: string;
}

export interface GenreDistributionItem {
  genre: string;
  weight: number;
  percentage: number;
}

export interface RecommendedArtistItem {
  name: string;
  matchScore?: number;
  imageUrl?: string;
  sourceArtist: string;
  lastFmUrl?: string;
}

export interface PersonalRecentTrack {
  id?: number;
  youtubeId: string;
  title: string;
  artist: string;
  duration?: number;
  thumbnailUrl?: string;
  createdAt?: string | Date;
}

export interface PersonalDashboardData {
  kpis: DashboardKpis;
  topArtists: EnrichedArtistItem[];
  topGenres: GenreDistributionItem[];
  recentLikes: PersonalRecentTrack[];
  recommendations: RecommendedArtistItem[];
}

export type DashboardActiveView = 'personal' | 'youtube';

export interface DashboardResponse {
  hasPersonalData: boolean;
  activeView: DashboardActiveView;
  personal: PersonalDashboardData | null;
  youtube: IDashboard[] | null;
}

export interface DashboardQueryOptions {
  includeYoutube?: boolean;
  refresh?: boolean;
}

