import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let service: LikesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LikesService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LikesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created and have initially empty liked songs', () => {
    expect(service).toBeTruthy();
    expect(service.$likedCount()).toBe(0);
    expect(service.$likedSongs()).toEqual([]);
    expect(service.isLiked('track-1')).toBe(false);
  });

  it('should toggle like optimistically and send POST /likes/toggle to backend', () => {
    const song = {
      videoId: 'v123',
      name: 'Midnight City',
      artist: { name: 'M83' },
      duration: 240,
      thumbnailUrl: 'https://img.youtube.com/vi/v123/default.jpg',
    };

    const isLikedNow = service.toggleLike(song);
    expect(isLikedNow).toBe(true);
    expect(service.isLiked('v123')).toBe(true);
    expect(service.$likedCount()).toBe(1);
    expect(service.$likedSongs()[0].name).toBe('Midnight City');
    expect(service.$likedSongs()[0].artist).toBe('M83');

    // Verifica que se hace la petición al endpoint de toggle
    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes/toggle'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      youtubeId: 'v123',
      title: 'Midnight City',
      artist: 'M83',
      duration: 240,
      thumbnailUrl: 'https://img.youtube.com/vi/v123/default.jpg',
    });
    req.flush({ isLiked: true });

    // Segundo toggle: quitar like
    const isLikedAfter = service.toggleLike(song);
    expect(isLikedAfter).toBe(false);
    expect(service.isLiked('v123')).toBe(false);
    expect(service.$likedCount()).toBe(0);

    const req2 = httpTesting.expectOne((r) => r.url.endsWith('/likes/toggle'));
    expect(req2.request.method).toBe('POST');
    req2.flush({ isLiked: false });
  });

  it('should rollback optimistic update when backend returns error', () => {
    const song = {
      videoId: 'v-error',
      name: 'Error Song',
      artist: 'Unknown',
      duration: 180,
    };

    service.toggleLike(song);
    expect(service.isLiked('v-error')).toBe(true);
    expect(service.$likedCount()).toBe(1);

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes/toggle'));
    req.flush('Error de servidor', { status: 500, statusText: 'Internal Server Error' });

    // Estado debe revertirse
    expect(service.isLiked('v-error')).toBe(false);
    expect(service.$likedCount()).toBe(0);
  });

  it('should fetch favorites from GET /likes and update reactive state', () => {
    const mockTracks = [
      {
        id: 'uuid-1',
        youtubeId: 'track-1',
        title: 'Song One',
        artist: 'Artist One',
        duration: 210,
        thumbnailUrl: 'https://thumb1.jpg',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'uuid-2',
        youtubeId: 'track-2',
        title: 'Song Two',
        artist: 'Artist Two',
        duration: 195,
        thumbnailUrl: 'https://thumb2.jpg',
        createdAt: new Date().toISOString(),
      },
    ];

    let resultSongs: any[] = [];
    service.fetchFavoritesFromBackend().subscribe((songs) => {
      resultSongs = songs;
    });

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes'));
    expect(req.request.method).toBe('GET');
    req.flush(mockTracks);

    expect(resultSongs.length).toBe(2);
    expect(service.$likedCount()).toBe(2);
    expect(service.isLiked('track-1')).toBe(true);
    expect(service.isLiked('track-2')).toBe(true);
    expect(service.$likedSongs()[0].videoId).toBe('track-1');
  });

  it('should check like status via GET /likes/check/:youtubeId', () => {
    let isLikedResult: boolean | undefined;
    service.checkLike('yt-123').subscribe((res) => {
      isLikedResult = res;
    });

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes/check/yt-123'));
    expect(req.request.method).toBe('GET');
    req.flush({ isLiked: true });

    expect(isLikedResult).toBe(true);
    expect(service.isLiked('yt-123')).toBe(true);
  });

  it('should clear all likes', () => {
    service.clearAll();
    expect(service.$likedCount()).toBe(0);
    expect(service.$likedSongs()).toEqual([]);
  });
});
