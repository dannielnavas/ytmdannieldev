import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LyricsService } from './lyrics.service';

describe('LyricsService', () => {
  let service: LyricsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LyricsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LyricsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  describe('getLyrics', () => {
    it('encodes track and artist names in the query string', () => {
      service.getLyrics('Hello & Goodbye', 'A/B Artist').subscribe();

      const req = httpTesting.expectOne(
        (r) => r.url === 'https://ytmdannieldev-back.vercel.app/youtube/lyrics',
      );
      expect(req.request.params.get('track_name')).toBe('Hello & Goodbye');
      expect(req.request.params.get('artist_name')).toBe('A/B Artist');
      req.flush({});
    });

    it('emits null when the request fails', () => {
      let result: unknown = 'unset';
      service.getLyrics('x', 'y').subscribe((value) => (result = value));

      httpTesting
        .expectOne((r) => r.url === 'https://ytmdannieldev-back.vercel.app/youtube/lyrics')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(result).toBeNull();
    });
  });

  describe('parseSyncedLyrics', () => {
    it('returns an empty array for empty input', () => {
      expect(service.parseSyncedLyrics('')).toEqual([]);
    });

    it('parses timestamps into seconds', () => {
      const result = service.parseSyncedLyrics('[00:12.50] First line\n[01:05.00] Second line');

      expect(result).toEqual([
        { time: 12.5, text: 'First line' },
        { time: 65, text: 'Second line' },
      ]);
    });

    it('sorts lines by time even when they are out of order', () => {
      const result = service.parseSyncedLyrics('[02:00.00] Late\n[00:10.00] Early');

      expect(result.map((l) => l.text)).toEqual(['Early', 'Late']);
    });

    it('expands a line carrying several time tags into one entry per tag', () => {
      const result = service.parseSyncedLyrics('[00:10.00][01:00.00] Chorus');

      expect(result).toEqual([
        { time: 10, text: 'Chorus' },
        { time: 60, text: 'Chorus' },
      ]);
    });

    it('parses tracks longer than 99 minutes', () => {
      const result = service.parseSyncedLyrics('[100:00.00] Very long intro');

      expect(result).toEqual([{ time: 6000, text: 'Very long intro' }]);
    });

    it('ignores LRC metadata headers', () => {
      const result = service.parseSyncedLyrics(
        '[ar:Some Artist]\n[ti:Some Title]\n[length:03:12]\n[00:05.00] Real line',
      );

      expect(result).toEqual([{ time: 5, text: 'Real line' }]);
    });

    it('skips lines without a timestamp', () => {
      const result = service.parseSyncedLyrics('[00:05.00] Synced\nJust plain text');

      expect(result).toEqual([{ time: 5, text: 'Synced' }]);
    });

    it('keeps an empty text when a timestamp has no lyric', () => {
      expect(service.parseSyncedLyrics('[00:05.00]')).toEqual([{ time: 5, text: '' }]);
    });
  });
});
