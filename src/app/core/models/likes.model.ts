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
