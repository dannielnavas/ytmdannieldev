import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ListLikes } from './list-likes';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaybackService } from '../../core/services/playback.service';
import { LikesService } from '../../core/services/likes.service';
import { Auth } from '../../core/services/auth/auth';
import { UserModel } from '../../core/models/user.model';
import { of } from 'rxjs';

describe('ListLikes', () => {
  let component: ListLikes;
  let fixture: ComponentFixture<ListLikes>;
  let playbackService: PlaybackService;
  let likesService: LikesService;
  let httpTesting: HttpTestingController;

  const mockLikes = [
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

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ListLikes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LikesService,
        PlaybackService,
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

    playbackService = TestBed.inject(PlaybackService);
    likesService = TestBed.inject(LikesService);
    httpTesting = TestBed.inject(HttpTestingController);

    // Mock getListLikes to avoid unexpected HTTP calls in tests
    vi.spyOn(likesService, 'getListLikes').mockReturnValue(of(mockLikes));

    fixture = TestBed.createComponent(ListLikes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load songs from resource and compute total count and duration', () => {
    expect(component.allSourceSongs().length).toBe(2);
    expect(component.songs().length).toBe(2);
    expect(component.totalCount()).toBe(2);
    expect(component.totalDurationSeconds()).toBe(474);
    expect(component.formattedTotalDuration()).toContain('min');
  });

  it('should play a specific song and queue the rest of the list', () => {
    const playQueueSpy = vi.spyOn(playbackService, 'playQueue');
    const song = component.songs()[1];

    component.onPlaySong(song, 1);

    expect(playQueueSpy).toHaveBeenCalled();
    const [items, index, title] = playQueueSpy.mock.calls[0];
    expect(index).toBe(1);
    expect(title).toBe('Tus Me Gusta');
    expect(items.length).toBe(2);
    expect(items[1].videoId).toBe('v2');
  });

  it('should play all songs from the start when onPlayAll is called', () => {
    const playQueueSpy = vi.spyOn(playbackService, 'playQueue');

    component.onPlayAll();

    expect(playQueueSpy).toHaveBeenCalled();
    expect(playQueueSpy.mock.calls[0][1]).toBe(0);
    expect(playQueueSpy.mock.calls[0][2]).toBe('Tus Me Gusta');
  });

  it('should play in shuffle mode when onPlayShuffle is called', () => {
    const playShuffledSpy = vi.spyOn(playbackService, 'playShuffled');

    component.onPlayShuffle();

    expect(playShuffledSpy).toHaveBeenCalled();
    expect(playShuffledSpy.mock.calls[0][1]?.sourceTitle).toBe('Tus Me Gusta');
  });

  it('should filter songs based on search query', () => {
    component.searchQuery.set('starboy');
    expect(component.songs().length).toBe(1);
    expect(component.songs()[0].name).toBe('Starboy');

    component.searchQuery.set('m83');
    expect(component.songs().length).toBe(1);
    expect(component.songs()[0].artist?.name).toBe('M83');

    component.clearSearch();
    expect(component.songs().length).toBe(2);
  });
});
