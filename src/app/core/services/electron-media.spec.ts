import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { ElectronMedia } from './electron-media';
import { PlaybackService } from './playback.service';
import { LikesService } from './likes.service';
import { AUDIO_FACTORY } from './audio-factory';
import { FakeAudioElement, createFakeAudioFactory } from '../testing/fake-audio-element';
import { QueueItem } from '../models/queue.model';
import { OSPlaybackState, OSTrackNotification, WindowControlsAPI } from '../../../electron';

function item(n: number): QueueItem {
  return {
    id: `id${n}`,
    videoId: `v${n}`,
    name: `Song ${n}`,
    artist: `Artist ${n}`,
    duration: 200,
    thumbnail: `https://i.ytimg.com/vi/v${n}/hqdefault.jpg`,
  };
}

describe('ElectronMedia', () => {
  let service: ElectronMedia;
  let playback: PlaybackService;
  let likes: LikesService;
  let router: Router;
  let audio: FakeAudioElement;

  let updatePlaybackState: ReturnType<typeof vi.fn<(state: OSPlaybackState) => void>>;
  let notifyTrackChange: ReturnType<typeof vi.fn<(notification: OSTrackNotification) => void>>;
  let deepLinkHandler: ((url: string) => void) | null;
  let suspendHandler: (() => void) | null;

  beforeEach(() => {
    updatePlaybackState = vi.fn();
    notifyTrackChange = vi.fn();
    deepLinkHandler = null;
    suspendHandler = null;

    const mockControls: WindowControlsAPI = {
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizedChange: vi.fn().mockReturnValue(() => {}),
      toggleMiniPlayer: vi.fn(),
      isMiniPlayer: vi.fn().mockResolvedValue(false),
      onMiniPlayerChange: vi.fn().mockReturnValue(() => {}),
      updatePlaybackState,
      notifyTrackChange,
      onDeepLink: (cb) => {
        deepLinkHandler = cb;
        return () => {
          deepLinkHandler = null;
        };
      },
      onSystemSuspend: (cb) => {
        suspendHandler = cb;
        return () => {
          suspendHandler = null;
        };
      },
    };

    window.windowControls = mockControls;

    const factory = createFakeAudioFactory();
    audio = factory();

    TestBed.configureTestingModule({
      providers: [
        ElectronMedia,
        PlaybackService,
        LikesService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });

    playback = TestBed.inject(PlaybackService);
    likes = TestBed.inject(LikesService);
    likes.backendSyncEnabled = false;
    router = TestBed.inject(Router);
    service = TestBed.inject(ElectronMedia);
  });

  afterEach(() => {
    delete window.windowControls;
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publishes playback state and like changes to Electron main process', () => {
    playback.playQueue([item(1), item(2)], 0, 'Mi Playlist');
    audio.setDuration(200);
    audio.tick(50);
    TestBed.tick();

    expect(updatePlaybackState).toHaveBeenCalled();
    const state = updatePlaybackState.mock.calls.at(-1)?.[0] as OSPlaybackState;
    expect(state.track?.videoId).toBe('v1');
    expect(state.track?.title).toBe('Song 1');
    expect(state.track?.artist).toBe('Artist 1');
    expect(state.track?.album).toBe('Mi Playlist');
    expect(state.isPlaying).toBe(true);
    expect(state.isLiked).toBe(false);

    likes.toggleLike(item(1));
    TestBed.tick();

    const likedState = updatePlaybackState.mock.calls.at(-1)?.[0] as OSPlaybackState;
    expect(likedState.isLiked).toBe(true);
  });

  it('notifies the OS when advancing to the next track while playing', () => {
    playback.playQueue([item(1), item(2)], 0, 'Álbum');
    TestBed.tick();
    expect(notifyTrackChange).not.toHaveBeenCalled();

    playback.playNext();
    TestBed.tick();

    expect(notifyTrackChange).toHaveBeenCalledTimes(1);
    const payload = notifyTrackChange.mock.calls[0][0] as OSTrackNotification;
    expect(payload.videoId).toBe('v2');
    expect(payload.title).toBe('Song 2');
    expect(payload.artist).toBe('Artist 2');
    expect(payload.album).toBe('Álbum');
  });

  it('routes pulso:// deep links to the player and Angular router', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    deepLinkHandler?.('pulso://playlist/PL_TEST_123');
    expect(navigateSpy).toHaveBeenCalledWith(['/playlist', 'PL_TEST_123']);

    deepLinkHandler?.('pulso://album/MPREb_999');
    expect(navigateSpy).toHaveBeenCalledWith(['/album', 'MPREb_999']);

    deepLinkHandler?.('pulso://search?q=daft+punk');
    expect(navigateSpy).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'daft punk' } });

    deepLinkHandler?.('pulso://play?v=abc123xyz&title=Veridis+Quo&artist=Daft+Punk');
    expect(playback.$currentTrack()?.videoId).toBe('abc123xyz');
    expect(navigateSpy).toHaveBeenCalledWith(['/now-playing']);
  });

  it('pauses playback when the OS suspends', () => {
    playback.playQueue([item(1)], 0);
    TestBed.tick();
    expect(playback.$isPlaying()).toBe(true);

    suspendHandler?.();
    expect(playback.$isPlaying()).toBe(false);
  });
});
