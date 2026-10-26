import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { Home } from './home';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { Auth } from '../../core/services/auth/auth';
import { UserModel } from '../../core/models/user.model';
import { LikesService } from '../../core/services/likes.service';
import { DashboardResponse } from '../../core/models/dashboard';
import { SearchStore } from '../../core/store/search-store';
import { PlaybackService } from '../../core/services/playback.service';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  const defaultMockDashboard: DashboardResponse = {
    hasPersonalData: false,
    activeView: 'youtube',
    personal: null,
    youtube: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        {
          provide: Dashboard,
          useValue: {
            getDashboard: () => of(defaultMockDashboard),
            getDashboardData: () => of(defaultMockDashboard),
            getStreamUrl: (videoId: string) => `/youtube/stream/${videoId}`,
            searchSongs: vi
              .fn()
              .mockReturnValue(of({ artists: [], songs: [], albums: [], playlists: [] })),
          },
        },
        {
          provide: LikesService,
          useValue: {
            $likedSongs: signal([]),
            $likedCount: signal(0),
            $likedIds: signal(new Set()),
            fetchFavoritesFromBackend: () => of([]),
            getListLikes: () => of([]),
            getForgottenGems: () => of([]),
            getLikedRadio: () => of([]),
            checkLikesBulk: () => of({ likedIds: [], map: {} }),
            isLiked: () => false,
            toggleLike: () => true,
          },
        },
        {
          provide: Auth,
          useValue: {
            getMe: () =>
              of({
                email: 'danniel@example.com',
                full_name: 'Danniel Navas',
                profile_image: '',
                youtube_handle: '@dannielnavas',
                is_youtube_premium: true,
                youtube_connected_at: new Date(),
              } satisfies UserModel),
          },
        },
        {
          provide: SearchStore,
          useValue: {
            result: signal(null),
            currentQuery: signal(''),
            isLoading: signal(false),
            error: signal(null),
            search: vi.fn().mockReturnValue(of(null)),
            set: vi.fn(),
            clear: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and have empty validSections by default', () => {
    expect(component).toBeTruthy();
    expect(component.validSections()).toEqual([]);
    expect(component.hasPersonalData()).toBe(false);
    expect(component.activeTab()).toBe('youtube');
  });

  it('should format duration and listeners correctly', () => {
    expect(component.formatDuration(215)).toBe('3:35');
    expect(component.formatDuration(0)).toBe('0:00');
    expect(component.formatDuration(null)).toBe('0:00');

    expect(component.formatListeners('6471254')).toBe('6.5M oyentes');
    expect(component.formatListeners('15000')).toBe('15k oyentes');
    expect(component.formatListeners('450')).toBe('450 oyentes');
  });

  it('should allow switching tabs', () => {
    component.setTab('personal');
    expect(component.activeTab()).toBe('personal');
    component.setTab('hybrid');
    expect(component.activeTab()).toBe('hybrid');
  });

  it('should correctly handle personal dashboard data when provided', () => {
    const personalData: DashboardResponse = {
      hasPersonalData: true,
      activeView: 'personal',
      personal: {
        kpis: {
          totalLikes: 24,
          totalDurationSeconds: 5820,
          totalMinutes: 97,
          totalHours: 1.6,
          uniqueArtists: 8,
          favoriteArtist: 'Daft Punk',
        },
        topArtists: [
          {
            name: 'Daft Punk',
            likesCount: 9,
            totalDurationSeconds: 2400,
            imageUrl: 'https://img.test/daftpunk.jpg',
            bio: 'French electronic duo',
            listeners: '6471254',
            tags: ['Electronic', 'House'],
          },
        ],
        topGenres: [
          { genre: 'Electronic', weight: 45, percentage: 42 },
          { genre: 'House', weight: 35, percentage: 33 },
        ],
        recentLikes: [
          {
            id: 1,
            youtubeId: 'vid123',
            title: 'One More Time',
            artist: 'Daft Punk',
            duration: 320,
          },
        ],
        recommendations: [
          {
            name: 'Justice',
            matchScore: 0.88,
            sourceArtist: 'Daft Punk',
          },
        ],
      },
      youtube: [
        {
          title: 'Novedades',
          contents: [],
        },
      ],
    };

    // Override the resource value manually to test computed properties
    (component as any).resourceDashboard.set(personalData);
    fixture.detectChanges();

    expect(component.hasPersonalData()).toBe(true);
    expect(component.kpis()?.totalLikes).toBe(24);
    expect(component.kpis()?.favoriteArtist).toBe('Daft Punk');
    expect(component.topArtists().length).toBe(1);
    expect(component.topArtists()[0].name).toBe('Daft Punk');
    expect(component.topGenres().length).toBe(2);
    expect(component.recommendations().length).toBe(1);
    expect(component.recentLikes().length).toBe(1);
    expect(component.activeTab()).toBe('hybrid');
  });

  it('should trigger search and navigate on exploreRecommendation', () => {
    const searchStore = TestBed.inject(SearchStore);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.exploreRecommendation({ name: 'The Weeknd', sourceArtist: 'Daft Punk' });

    expect(searchStore.search).toHaveBeenCalledWith('The Weeknd');
    expect(navSpy).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'The Weeknd' } });
  });

  it('should fallback to YouTube cover when recent track lacks thumbnail', () => {
    const trackWithThumb = {
      youtubeId: 'abc123',
      title: 'Song',
      artist: 'Artist',
      thumbnailUrl: 'https://thumb.jpg',
    };
    const trackWithoutThumb = { youtubeId: 'xyz789', title: 'Song 2', artist: 'Artist 2' };

    expect(component.getRecentLikeCover(trackWithThumb)).toBe('https://thumb.jpg');
    expect(component.getRecentLikeCover(trackWithoutThumb)).toBe(
      'https://i.ytimg.com/vi/xyz789/hqdefault.jpg',
    );
  });

  it('should resolve artist image from dynamic cache, valid imageUrl, or liked song cover', () => {
    // 1. Dynamic cache
    component.artistAvatars.set({ Coldplay: 'https://yt.com/coldplay_avatar.jpg' });
    expect(
      component.getArtistImage({
        name: 'Coldplay',
        likesCount: 3,
        totalDurationSeconds: 600,
      }),
    ).toBe('https://yt.com/coldplay_avatar.jpg');

    // 2. Direct valid imageUrl
    expect(
      component.getArtistImage({
        name: 'Radiohead',
        likesCount: 5,
        totalDurationSeconds: 1200,
        imageUrl: 'https://cdn.example.com/radiohead.jpg',
      }),
    ).toBe('https://cdn.example.com/radiohead.jpg');

    // 3. Last.fm placeholder should be discarded
    expect(
      component.getArtistImage({
        name: 'Unknown Band',
        likesCount: 1,
        totalDurationSeconds: 180,
        imageUrl:
          'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
      }),
    ).toBe('');
  });

  it('should fallback to liked song cover on image error', () => {
    const likesService = TestBed.inject(LikesService);
    (likesService.$likedSongs as any).set([
      {
        videoId: 'song123',
        name: 'Yellow',
        artist: 'Coldplay',
        thumbnailUrl: 'https://i.ytimg.com/vi/song123/hqdefault.jpg',
      },
    ]);

    const fakeImg = document.createElement('img');
    fakeImg.src = 'https://broken.example.com/avatar.jpg';
    const fakeEvent = { target: fakeImg } as unknown as Event;

    component.onArtistImageError(fakeEvent, {
      name: 'Coldplay',
      likesCount: 1,
      totalDurationSeconds: 200,
    });

    expect(fakeImg.src).toBe('https://i.ytimg.com/vi/song123/hqdefault.jpg');
  });

  it('should navigate to playlist on playItem with regular playlist', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.playItem({
      type: 'PLAYLIST',
      playlistId: 'PL1234567890',
      name: 'Pop Hits',
      artist: { name: 'Various', artistId: null },
      thumbnails: [],
    });

    expect(navSpy).toHaveBeenCalledWith(['/playlist', 'PL1234567890']);
  });

  it('should navigate to playlist on playItem when item is a mix', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.playItem({
      type: 'PLAYLIST',
      playlistId: 'RDAMVMdQw4w9WgXcQ',
      name: 'Never Gonna Give You Up Mix',
      artist: { name: 'Rick Astley', artistId: null },
      thumbnails: [],
    });

    expect(navSpy).toHaveBeenCalledWith(['/playlist', 'RDAMVMdQw4w9WgXcQ']);
  });

  it('should play forgotten gems queue when playForgottenGem is called', () => {
    const playback = TestBed.inject(PlaybackService);
    const playQueueSpy = vi.spyOn(playback, 'playQueue');
    (component as any).forgottenGems = () => [
      {
        videoId: 'gem1',
        title: 'Old Gem',
        artist: 'Vintage Artist',
      },
    ];

    component.playForgottenGem(
      { videoId: 'gem1', title: 'Old Gem', artist: 'Vintage Artist' },
      0,
    );

    expect(playQueueSpy).toHaveBeenCalled();
    const [queue, index, title] = playQueueSpy.mock.calls[0];
    expect(index).toBe(0);
    expect(title).toBe('Joyas Olvidadas');
    expect(queue[0].videoId).toBe('gem1');
  });
});
