export interface QueueItem {
  videoId: string;
  name: string;
  artist?: string;
  duration?: number | string;
  thumbnail?: string;
}

export interface PlaybackQueue {
  items: QueueItem[];
  currentIndex: number;
  sourceTitle?: string;
}
