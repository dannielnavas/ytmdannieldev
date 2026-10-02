import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { LikesSection } from './likes-section';
import { LikesService } from '../../../core/services/likes.service';
import { PlaybackService } from '../../../core/services/playback.service';

describe('LikesSection', () => {
  let component: LikesSection;
  let fixture: ComponentFixture<LikesSection>;
  let router: Router;
  let likesService: LikesService;
  let playbackService: PlaybackService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LikesSection],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LikesService,
        PlaybackService,
        {
          provide: Router,
          useValue: {
            navigate: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LikesSection);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    likesService = TestBed.inject(LikesService);
    playbackService = TestBed.inject(PlaybackService);

    // Mock fetchFavoritesFromBackend to avoid unhandled requests in tests
    vi.spyOn(likesService, 'fetchFavoritesFromBackend').mockReturnValue(of([]));

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to /likes on goToLikes', () => {
    component.goToLikes();
    expect(router.navigate).toHaveBeenCalledWith(['/likes']);
  });

  it('should play all songs when playAll is called', () => {
    const playQueueSpy = vi.spyOn(playbackService, 'playQueue').mockImplementation(() => {});
    (likesService as any)._likedSongs.set([
      {
        videoId: 'song-1',
        name: 'Track 1',
        artist: 'Artist 1',
        thumbnailUrl: 'https://thumb.test/1.jpg',
        likedAt: Date.now(),
      },
    ]);

    component.playAll();
    expect(playQueueSpy).toHaveBeenCalled();
  });
});
