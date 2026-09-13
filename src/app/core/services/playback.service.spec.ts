import { TestBed } from '@angular/core/testing';
import { PlaybackService } from './playback.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('PlaybackService', () => {
  let service: PlaybackService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PlaybackService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlaybackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty queue', () => {
    expect(service.$queue()).toEqual([]);
    expect(service.$currentIndex()).toBe(-1);
    expect(service.$hasNext()).toBe(false);
    expect(service.$hasPrevious()).toBe(false);
  });
});
