import { inject, Service, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Dashboard } from './dashboard/dashboard';
import { MetadataResponse } from '../models/stream';

const EMPTY_METADATA: MetadataResponse = {
  title: '',
  duration: 0,
  thumbnail: '',
  channel: '',
  author: '',
  viewCount: 0,
};

/**
 * Metadata of the track in playback, fetched once and shared.
 *
 * `player-bar` and `now-playing` each had their own `rxResource` against
 * `/youtube/metadata/:id`, with independent caches: mounting the expanded view
 * issued a second request for the same track.
 *
 * Requests are deduplicated by `videoId`, and tracks whose queued name is
 * already known are never requested at all.
 */
@Service()
export class TrackMetadataService {
  private readonly _dashboard = inject(Dashboard);

  private readonly _state = signal<MetadataResponse>(EMPTY_METADATA);
  private _inFlight: { videoId: string; subscription: Subscription } | null = null;

  public readonly $metadata = this._state.asReadonly();

  /**
   * @param videoId    track to load, or a falsy value to clear.
   * @param hasOwnName `true` when the queue already provides title and artist,
   *                   in which case no request is made.
   */
  public load(videoId: string | null | undefined, hasOwnName = false): void {
    const id = videoId ?? '';

    if (!id || hasOwnName) {
      this._cancelInFlight();
      this._state.set(EMPTY_METADATA);
      return;
    }

    if (this._inFlight?.videoId === id) {
      return;
    }

    this._cancelInFlight();
    this._state.set(EMPTY_METADATA);

    const subscription = this._dashboard.getMetadata(id).subscribe({
      next: (metadata) => {
        this._inFlight = null;
        this._state.set({ ...EMPTY_METADATA, ...metadata });
      },
      error: () => {
        this._inFlight = null;
        this._state.set(EMPTY_METADATA);
      },
    });

    this._inFlight = { videoId: id, subscription };
  }

  public clear(): void {
    this._cancelInFlight();
    this._state.set(EMPTY_METADATA);
  }

  private _cancelInFlight(): void {
    this._inFlight?.subscription.unsubscribe();
    this._inFlight = null;
  }
}
