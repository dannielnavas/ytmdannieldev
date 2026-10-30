import { SponsorBlockSegment } from './track.model';

export interface StreamResponse {
  videoId: string;
  streamUrl: string;
  skipSegments?: SponsorBlockSegment[];
}

export interface MetadataResponse {
  title: string;
  duration: number;
  thumbnail: string;
  channel: string;
  author: string;
  viewCount: number;
  skipSegments?: SponsorBlockSegment[];
}
