import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NowPlaying } from './now-playing';
import { PlaybackService } from '../../../../core/services/playback.service';
import { AUDIO_FACTORY } from '../../../../core/services/audio-factory';
import {
  createFakeAudioFactory,
  FakeAudioElement,
} from '../../../../core/testing/fake-audio-element';
import { of } from 'rxjs';
import {
  LyricsService,
  LrclibResponse,
  ParsedLyricLine,
} from '../../../../core/services/lyrics.service';
import { LyricsPreferencesService } from '../../../../core/services/lyrics-preferences.service';

const SYNCED = [
  '[00:01.00] Primera línea',
  '[00:05.50] La melodía sigue',
  '[00:12.00] Estribillo con CANCIÓN',
  '[00:20.00] Final del tema',
];

describe('NowPlaying lyrics', () => {
  let component: NowPlaying;
  let fixture: ComponentFixture<NowPlaying>;
  let playback: PlaybackService;
  let audio: FakeAudioElement;
  let lyrics: { synced: string | null; plain: string | null };

  beforeEach(async () => {
    localStorage.clear();
    lyrics = { synced: SYNCED.join('\n'), plain: null };

    // The LRC parser itself is covered by `lyrics.service.spec.ts`; here only
    // the behavior of the view matters.
    const lyricsService = {
      getLyrics: () => of(lyricsResponse()),
      parseSyncedLyrics: parseSynced,
    };

    const factory = createFakeAudioFactory();
    audio = factory();

    await TestBed.configureTestingModule({
      imports: [NowPlaying],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
        { provide: LyricsService, useValue: lyricsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NowPlaying);
    component = fixture.componentInstance;
    playback = TestBed.inject(PlaybackService);

    playback.playQueue(
      [
        { id: 'a', videoId: 'v1', name: 'One', artist: 'Artist', duration: 200 },
        { id: 'b', videoId: 'v2', name: 'Two', artist: 'Artist', duration: 200 },
      ],
      0,
    );
    audio.setDuration(200);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function lyricsResponse(): LrclibResponse {
    return {
      id: 1,
      name: 'One',
      trackName: 'One',
      artistName: 'Artist',
      albumName: 'Album',
      duration: 200,
      instrumental: false,
      syncedLyrics: lyrics.synced,
      plainLyrics: lyrics.plain ?? '',
    };
  }

  function parseSynced(raw: string): ParsedLyricLine[] {
    return raw
      .split('\n')
      .map((line) => {
        const match = /\[(\d+):(\d+(?:\.\d+)?)\]/.exec(line);
        if (!match) return null;
        return {
          time: Number(match[1]) * 60 + Number(match[2]),
          text: line.slice(match[0].length).trim(),
        };
      })
      .filter((line): line is ParsedLyricLine => line !== null);
  }

  function renderedLines(): string[] {
    const host: HTMLElement = fixture.nativeElement;
    return Array.from(host.querySelectorAll('[id^="lyric-"]')).map(
      (node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  describe('timing correction', () => {
    it('highlights the line that matches the clock', () => {
      audio.tick(6);
      fixture.detectChanges();

      expect(component.currentLyricIndex()).toBe(1);
    });

    it('moves the highlight earlier with a positive offset', () => {
      const preferences = TestBed.inject(LyricsPreferencesService);

      audio.tick(3.5);
      fixture.detectChanges();
      expect(component.currentLyricIndex()).toBe(0);

      // The lyrics run 2 s behind: correcting by 2 s makes the second line
      // arrive at 3.5 s instead of 5.5 s.
      preferences.set(2);
      fixture.detectChanges();
      expect(component.currentLyricIndex()).toBe(1);

      preferences.set(-2);
      fixture.detectChanges();
      expect(component.currentLyricIndex()).toBe(0);
    });

    it('seeks to where the line was shown, offset included', () => {
      TestBed.inject(LyricsPreferencesService).set(2);

      component.onLyricClick(5.5);

      // The line was shown 2 s before its real timestamp.
      expect(audio.currentTime).toBe(3.5);
    });

    it('does not seek for unsynced lines', () => {
      component.onLyricClick(-1);
      expect(audio.currentTime).toBe(0);
    });

    it('shifts, clamps and resets', () => {
      const preferences = TestBed.inject(LyricsPreferencesService);

      preferences.shift(0.5);
      expect(preferences.$offset()).toBe(0.5);
      expect(component.lyricsOffsetLabel()).toBe('+0.5 s');

      preferences.shift(-1.5);
      expect(component.lyricsOffsetLabel()).toBe('−1 s');

      preferences.shift(100);
      expect(preferences.$offset()).toBe(10);
      expect(component.canShiftLyricsEarlier()).toBe(false);

      preferences.shift(-100);
      expect(preferences.$offset()).toBe(-10);
      expect(component.canShiftLyricsLater()).toBe(false);

      component.resetLyricsOffset();
      expect(preferences.$offset()).toBe(0);
      expect(component.lyricsOffsetLabel()).toBe('0 s');
    });

    it('keeps the correction across sessions', () => {
      TestBed.inject(LyricsPreferencesService).set(1.5);

      const reopened = new LyricsPreferencesService();
      expect(reopened.$offset()).toBe(1.5);
    });

    it('ignores a corrupted preference', () => {
      localStorage.setItem('sonara.lyrics-preferences.v1', '{not json');
      expect(new LyricsPreferencesService().$offset()).toBe(0);
    });
  });

  describe('search', () => {
    function search(query: string): void {
      component.onLyricsQuery({ target: { value: query } } as unknown as Event);
      fixture.detectChanges();
    }

    it('shows every line without a query', () => {
      expect(component.visibleLyrics().length).toBe(4);
      expect(renderedLines().length).toBe(4);
    });

    it('filters the lines, keeping the original index', () => {
      search('estribillo');

      expect(component.visibleLyrics().map((entry) => entry.index)).toEqual([2]);
      // The id has to stay the index of the full list, or the scroll breaks.
      expect(renderedLines()).toEqual(['Estribillo con CANCIÓN']);
    });

    it('ignores case and accents', () => {
      search('cancion');
      expect(component.visibleLyrics().length).toBe(1);

      search('PRIMERA');
      expect(component.visibleLyrics().length).toBe(1);
    });

    it('reports how many lines match', () => {
      search('la');
      expect(component.lyricsMatches()).toBe('1 de 4');

      component.clearLyricsQuery();
      fixture.detectChanges();
      expect(component.lyricsMatches()).toBe('4 de 4');
    });

    it('splits a line around the match for the highlight', () => {
      search('cancion');
      const parts = component.lyricParts('Estribillo con CANCIÓN');

      expect(parts.map((part) => part.text).join('')).toBe('Estribillo con CANCIÓN');
      expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['CANCIÓN']);
    });

    it('keeps the text intact when there is no query', () => {
      expect(component.lyricParts('Una línea')).toEqual([{ text: 'Una línea', match: false }]);
    });

    it('marks several matches in one line', () => {
      search('la');
      const parts = component.lyricParts('la la la');
      expect(parts.filter((part) => part.match)).toHaveLength(3);
      expect(parts.map((part) => part.text).join('')).toBe('la la la');
    });

    it('says so when nothing matches', () => {
      search('xyz');

      expect(component.visibleLyrics()).toEqual([]);
      expect(fixture.nativeElement.textContent).toContain('Sin coincidencias');
    });

    it('clears the search', () => {
      search('la');
      component.clearLyricsQuery();
      fixture.detectChanges();

      expect(component.visibleLyrics().length).toBe(4);
      expect(fixture.nativeElement.textContent).not.toContain('Sin coincidencias');
    });
  });

  describe('plain lyrics', () => {
    it('renders them without seeking', async () => {
      lyrics = { synced: null, plain: 'primera\nsegunda' };
      component.lyricsResource.reload();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.hasSyncedLyrics()).toBe(false);
      expect(renderedLines()).toEqual(['primera', 'segunda']);

      component.onLyricClick(-1);
      expect(audio.currentTime).toBe(0);
    });
  });
});
