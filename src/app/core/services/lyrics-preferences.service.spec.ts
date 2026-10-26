import { TestBed } from '@angular/core/testing';
import { LyricsPreferencesService } from './lyrics-preferences.service';

describe('LyricsPreferencesService', () => {
  let service: LyricsPreferencesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [LyricsPreferencesService],
    });
    service = TestBed.inject(LyricsPreferencesService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with 0 offset by default', () => {
    expect(service.$offset()).toBe(0);
    expect(service.format(0)).toBe('0 s');
  });

  it('shifts and formats positive and negative offsets', () => {
    service.shift(0.1);
    expect(service.$offset()).toBe(0.1);
    expect(service.format(0.1)).toBe('+0.1 s');

    service.shift(0.4);
    expect(service.$offset()).toBe(0.5);
    expect(service.format(0.5)).toBe('+0.5 s');

    service.shift(-1.5);
    expect(service.$offset()).toBe(-1);
    expect(service.format(-1)).toBe('−1 s');
  });

  it('clamps offsets between -10 and 10 seconds', () => {
    service.shift(20);
    expect(service.$offset()).toBe(10);

    service.shift(-30);
    expect(service.$offset()).toBe(-10);
  });

  it('persists offsets independently per track', () => {
    // Set offset for track 1
    service.setTrack('track-1');
    service.set(1.2);
    expect(service.$offset()).toBe(1.2);

    // Switch to track 2: should be 0
    service.setTrack('track-2');
    expect(service.$offset()).toBe(0);

    // Set offset for track 2
    service.set(-0.8);
    expect(service.$offset()).toBe(-0.8);

    // Switch back to track 1: remembers 1.2
    service.setTrack('track-1');
    expect(service.$offset()).toBe(1.2);

    // Switch back to track 2: remembers -0.8
    service.setTrack('track-2');
    expect(service.$offset()).toBe(-0.8);
  });

  it('resets the offset for the active track', () => {
    service.setTrack('track-1');
    service.set(2.5);
    expect(service.$offset()).toBe(2.5);

    service.reset();
    expect(service.$offset()).toBe(0);

    // Reopened service should also show 0 for track-1
    const fresh = new LyricsPreferencesService();
    fresh.setTrack('track-1');
    expect(fresh.$offset()).toBe(0);
  });

  it('cleans up legacy v1 localStorage keys on load', () => {
    localStorage.setItem('pulso.lyrics-preferences.v1', JSON.stringify({ version: 1, offset: 3 }));
    localStorage.setItem('sonara.lyrics-preferences.v1', JSON.stringify({ version: 1, offset: 2 }));

    const fresh = new LyricsPreferencesService();
    expect(fresh.$offset()).toBe(0);
    expect(localStorage.getItem('pulso.lyrics-preferences.v1')).toBeNull();
    expect(localStorage.getItem('sonara.lyrics-preferences.v1')).toBeNull();
  });
});
