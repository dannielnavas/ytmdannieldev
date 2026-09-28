export interface StreamResponse {
  videoId: string;
  streamUrl: string;
}

export interface MetadataResponse {
  title: string;
  duration: number;
  thumbnail: string;
  channel: string;
  author: string;
  viewCount: number;
}
