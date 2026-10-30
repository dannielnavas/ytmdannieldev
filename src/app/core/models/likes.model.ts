import { SponsorBlockSegment } from './track.model';

export type { SponsorBlockSegment };

export interface YoutubeTrackInput {
  youtubeId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl?: string;
}

export type ToggleLikeDto = YoutubeTrackInput;

export interface ToggleLikeResponse {
  isLiked: boolean;
}

export interface Track {
  id?: string;
  youtubeId?: string;
  videoId?: string;
  title?: string;
  name?: string;
  artist?: string | { name: string; artistId?: string | null };
  duration?: number | string | null;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  coverUrl?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number }> | null;
  likedAt?: number | string;
  createdAt?: string | Date;
  isLiked?: boolean;
  skipSegments?: SponsorBlockSegment[];
}

export interface GetLikesParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'likedAt' | 'title' | 'artist' | 'duration';
  order?: 'ASC' | 'DESC';
}

export interface PaginatedLikesResponse {
  data: Track[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CheckLikesBulkResponse {
  likedIds: string[];
  map: Record<string, boolean>;
}

