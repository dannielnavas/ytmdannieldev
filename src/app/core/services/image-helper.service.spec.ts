import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageHelperService } from './image-helper.service';

describe('ImageHelperService', () => {
  let service: ImageHelperService;

  beforeEach(() => {
    service = new ImageHelperService();
  });

  it('should initialize without rate limiting', () => {
    expect(service.isRateLimited()).toBe(false);
  });

  it('should pick preferred sizes when available', () => {
    const thumbs = [
      { url: 'https://img.com/small.jpg', width: 60, height: 60 },
      { url: 'https://img.com/medium.jpg', width: 226, height: 226 },
      { url: 'https://img.com/large.jpg', width: 544, height: 544 },
    ];

    expect(service.getBestThumbnail(thumbs, 'small')).toBe('https://img.com/small.jpg');
    expect(service.getBestThumbnail(thumbs, 'medium')).toBe('https://img.com/medium.jpg');
    expect(service.getBestThumbnail(thumbs, 'large')).toBe('https://img.com/large.jpg');
  });

  it('should exclude failed URLs from candidate list', () => {
    const thumbs = [
      { url: 'https://img.com/small.jpg', width: 60, height: 60 },
      { url: 'https://img.com/large.jpg', width: 544, height: 544 },
    ];

    service.recordFailure('https://img.com/small.jpg');
    expect(service.getBestThumbnail(thumbs, 'small')).toBe('https://img.com/large.jpg');
  });

  it('should trigger circuit breaker when multiple errors occur rapidly', () => {
    service.recordFailure('https://img.com/1.jpg');
    service.recordFailure('https://img.com/2.jpg');
    expect(service.isRateLimited()).toBe(false);

    service.recordFailure('https://img.com/3.jpg');
    expect(service.isRateLimited()).toBe(true);
    expect(service.shouldRetry(0)).toBe(false);
  });

  it('should allow at most 1 retry per item when not rate limited', () => {
    expect(service.shouldRetry(0)).toBe(true);
    expect(service.shouldRetry(1)).toBe(false);
  });
});
