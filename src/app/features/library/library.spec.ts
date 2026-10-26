import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Library } from './library';
import { LikesService, LikedSong } from '../../core/services/likes.service';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { PlaybackService } from '../../core/services/playback.service';
import { Auth } from '../../core/services/auth/auth';
import { UserModel } from '../../core/models/user.model';
import { DashboardResponse } from '../../core/models/dashboard';
import { of } from 'rxjs';

describe('Library', () => {
  let component: Library;
  let fixture: ComponentFixture<Library>;
  let playbackService: PlaybackService;
  let likesService: LikesService;
  let dashboardService: Dashboard;
  let httpTesting: HttpTestingController;

  const mockLikes: LikedSong[] = [
    {
      videoId: 'v1',
      name: 'Starboy',
      artist: 'The Weeknd',
      thumbnailUrl: 'https://img.test/1.jpg',
      duration: 230,
      likedAt: 1000,
    },
    {
      videoId: 'v2',
      name: 'Midnight City',
      artist: 'M83',
      thumbnailUrl: 'https://img.test/2.jpg',
      duration: 244,
      likedAt: 2000,
    },
  ];

  const mockDashboard: DashboardResponse = {
    hasPersonalData: false,
    activeView: 'youtube',
    personal: null,
    youtube: [
      {
        title: 'Tus Playlists',
        contents: [
          {
            type: 'PLAYLIST',
            playlistId: 'PL123',
            name: 'Chill Vibes',
            artist: { name: 'YouTube Music', artistId: null },
            thumbnails: [{ url: 'https://img.test/p1.jpg', width: 200, height: 200 }],
          },
        ],
      },
      {
        title: 'Álbumes para ti',
        contents: [
          {
            type: 'ALBUM',
            albumId: 'ALB123',
            playlistId: 'OLAK123',
            name: 'After Hours',
            artist: { name: 'The Weeknd', artistId: null },
            thumbnails: [{ url: 'https://img.test/a1.jpg', width: 200, height: 200 }],
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Library],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        LikesService,
        Dashboard,
        PlaybackService,
        {
          provide: Auth,
          useValue: {
            getMe: () =>
              of({
                email: 'test@example.com',
                full_name: 'Test User',
                profile_image: '',
                youtube_handle: '@test',
                is_youtube_premium: true,
                youtube_connected_at: new Date(),
              } satisfies UserModel),
          },
        },
      ],
    }).compileComponents();

    playbackService = TestBed.inject(PlaybackService);
    likesService = TestBed.inject(LikesService);
    dashboardService = TestBed.inject(Dashboard);
    httpTesting = TestBed.inject(HttpTestingController);

    vi.spyOn(likesService, 'getListLikes').mockReturnValue(of(mockLikes));
    vi.spyOn(dashboardService, 'getDashboard').mockReturnValue(of(mockDashboard));

    fixture = TestBed.createComponent(Library);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should create the library component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute liked songs, playlists, and albums lists', () => {
    expect(component.likedSongs().length).toBe(2);
    expect(component.playlists().length).toBe(1);
    expect(component.playlists()[0].name).toBe('Chill Vibes');
    expect(component.albums().length).toBe(1);
    expect(component.albums()[0].name).toBe('After Hours');
  });

  it('should switch tabs', () => {
    expect(component.activeTab()).toBe('all');
    component.setTab('playlists');
    expect(component.activeTab()).toBe('playlists');
    component.setTab('albums');
    expect(component.activeTab()).toBe('albums');
  });

  it('should filter items by search query', () => {
    component.searchQuery.set('starboy');
    expect(component.filteredLikedSongs().length).toBe(1);
    expect(component.filteredPlaylists().length).toBe(0);

    component.searchQuery.set('chill');
    expect(component.filteredPlaylists().length).toBe(1);

    component.clearSearch();
    expect(component.filteredLikedSongs().length).toBe(2);
  });

  it('should play all likes', () => {
    const playQueueSpy = vi.spyOn(playbackService, 'playQueue');
    component.playAllLikes();
    expect(playQueueSpy).toHaveBeenCalled();
    const [items, index, title] = playQueueSpy.mock.calls[0];
    expect(index).toBe(0);
    expect(title).toBe('Tus Me Gusta');
    expect(items.length).toBe(2);
  });
});
