import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { Home } from './home';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { Auth } from '../../core/services/auth/auth';
import { UserModel } from '../../core/models/user.model';
import { LikesService } from '../../core/services/likes.service';
import { DashboardResponse } from '../../core/models/dashboard';

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
});

