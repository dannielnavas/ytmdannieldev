import { TestBed } from '@angular/core/testing';
import { ThumbnailFallback } from './thumbnail-fallback.service';
import { ImageHelperService } from './image-helper.service';

const THUMBS = [
  { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
  { url: 'https://i.ytimg.com/vi/abc/mqdefault.jpg' },
];

describe('ThumbnailFallback', () => {
  let service: ThumbnailFallback;
  let helper: ImageHelperService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ThumbnailFallback] });
    service = TestBed.inject(ThumbnailFallback);
    helper = TestBed.inject(ImageHelperService);
  });

  describe('at', () => {
    it('upgrades a standard YouTube thumbnail to maxres', () => {
      expect(service.at(THUMBS, 0)).toBe('https://i.ytimg.com/vi/abc/maxresdefault.jpg');
    });

    it('returns an empty string for an out-of-range index', () => {
      expect(service.at(THUMBS, 9)).toBe('');
    });

    it('returns an empty string for missing thumbnails', () => {
      expect(service.at(null, 0)).toBe('');
      expect(service.at(undefined, 0)).toBe('');
      expect(service.at([], 0)).toBe('');
    });
  });

  describe('nextIndex', () => {
    it('falls back to a lower quality candidate', () => {
      expect(service.nextIndex(THUMBS, 1)).toBe(0);
    });

    it('returns null when there are no more candidates', () => {
      expect(service.nextIndex(THUMBS, 0)).toBeNull();
    });

    it('returns null for an empty list', () => {
      expect(service.nextIndex([], 0)).toBeNull();
      expect(service.nextIndex(null, 0)).toBeNull();
    });

    it('returns null while the circuit breaker is cooling down', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('https://example.com/x.jpg');
      }
      expect(helper.isRateLimited()).toBe(true);
      expect(service.nextIndex(THUMBS, 1)).toBeNull();
    });
  });

  describe('recordFailure', () => {
    it('trips the circuit breaker after three failures', () => {
      expect(helper.isRateLimited()).toBe(false);
      for (let i = 0; i < 3; i++) {
        service.recordFailure(`https://example.com/${i}.jpg`);
      }
      expect(helper.isRateLimited()).toBe(true);
    });
  });
});
