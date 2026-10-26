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

  it('should get liked tracks with query params (search, sortBy, order, page, limit)', () => {
    service
      .getLikedTracks({
        page: 2,
        limit: 15,
        search: 'rock',
        sortBy: 'artist',
        order: 'ASC',
      })
      .subscribe();

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('15');
    expect(req.request.params.get('search')).toBe('rock');
    expect(req.request.params.get('sortBy')).toBe('artist');
    expect(req.request.params.get('order')).toBe('ASC');
    req.flush({ data: [], meta: { total: 0, page: 2, limit: 15, totalPages: 0 } });
  });

  it('should check likes bulk via POST /likes/check-bulk and update local state', () => {
    let result: any;
    service.checkLikesBulk(['vid1', 'vid2', 'vid3']).subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes/check-bulk'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ youtubeIds: ['vid1', 'vid2', 'vid3'] });
    req.flush({ likedIds: ['vid1', 'vid3'], map: { vid1: true, vid2: false, vid3: true } });

    expect(result.likedIds).toEqual(['vid1', 'vid3']);
    expect(result.map['vid1']).toBe(true);
    expect(result.map['vid2']).toBe(false);
    expect(service.isLiked('vid1')).toBe(true);
    expect(service.isLiked('vid2')).toBe(false);
    expect(service.isLiked('vid3')).toBe(true);
  });

  it('should fetch liked radio via GET /likes/radio', () => {
    let radioTracks: any[] = [];
    service.getLikedRadio(20).subscribe((tracks) => {
      radioTracks = tracks;
    });

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes/radio'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([{ videoId: 'r1', title: 'Radio Track 1' }]);

    expect(radioTracks.length).toBe(1);
    expect(radioTracks[0].videoId).toBe('r1');
  });

  it('should fetch forgotten gems via GET /likes/forgotten', () => {
    let gems: any[] = [];
    service.getForgottenGems(8).subscribe((tracks) => {
      gems = tracks;
    });

    const req = httpTesting.expectOne((r) => r.url.endsWith('/likes/forgotten'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('8');
    req.flush([{ videoId: 'g1', title: 'Gem 1' }]);

    expect(gems.length).toBe(1);
    expect(gems[0].videoId).toBe('g1');
  });
});
