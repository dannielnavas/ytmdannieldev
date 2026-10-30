export interface SponsorBlockSegment {
  UUID: string;
  segment: [number, number]; // [inicioSegundos, finSegundos]
  category: string;
  actionType: string;
  locked: number;
  votes: number;
  videoDuration: number;
  description: string;
}

export type { Track } from './likes.model';

