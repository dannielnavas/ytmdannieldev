import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DetailSongRow } from './detail-song-row';
import { PlaybackService } from '../../../core/services/playback.service';
import { AUDIO_FACTORY } from '../../../core/services/audio-factory';
import { FakeAudioElement, createFakeAudioFactory } from '../../../core/testing/fake-audio-element';
import { QueueItem } from '../../../core/models/queue.model';
import { Song, SourceSong } from '../../../core/models/youtube';

const SONG: Song = {
  type: 'SONG',
  videoId: 'abc123',
  name: 'Nombre de la canción',
  artist: { name: 'Artista', artistId: 'UC1' },
  duration: 215,
  thumbnails: [{ url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg', width: 120, height: 90 }],
};

function queueItem(videoId: string): QueueItem {
  return { id: videoId, videoId, name: 'x', artist: 'y', duration: 0, thumbnail: '' };
}

describe('DetailSongRow', () => {
  let fixture: ComponentFixture<DetailSongRow>;
  let component: DetailSongRow;
  let playbackService: PlaybackService;
  let audio: FakeAudioElement;

  beforeEach(async () => {
    const factory = createFakeAudioFactory();
    audio = factory();

    await TestBed.configureTestingModule({
      imports: [DetailSongRow],
      providers: [
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    }).compileComponents();

    playbackService = TestBed.inject(PlaybackService);
    fixture = TestBed.createComponent(DetailSongRow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('song', SONG);
  });

  function render(): void {
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('should create', () => {
    render();
    expect(component).toBeTruthy();
  });

  describe('formattedDuration', () => {
    it('formats seconds as m:ss', () => {
      fixture.componentRef.setInput('song', { ...SONG, duration: 215 });
      expect(component.formattedDuration()).toBe('3:35');
    });

    it('pads single-digit seconds', () => {
      fixture.componentRef.setInput('song', { ...SONG, duration: 65 });
      expect(component.formattedDuration()).toBe('1:05');
    });

    it('returns --:-- when the duration is missing', () => {
      fixture.componentRef.setInput('song', { ...SONG, duration: null });
      expect(component.formattedDuration()).toBe('--:--');
    });

    it('returns --:-- when the duration is zero', () => {
      fixture.componentRef.setInput('song', { ...SONG, duration: 0 });
      expect(component.formattedDuration()).toBe('--:--');
    });

    it('passes through a duration that is already a string', () => {
      fixture.componentRef.setInput('song', { ...SONG, duration: '3:35' });
      expect(component.formattedDuration()).toBe('3:35');
    });
  });

  describe('playback state', () => {
    it('is not playing when the queue is empty', () => {
      expect(component.$isPlaying()).toBe(false);
    });

    it('is playing when the streamed videoId matches', () => {
      playbackService.playQueue([queueItem('abc123')], 0);
      expect(component.$isPlaying()).toBe(true);
    });

    it('is not playing when a different track is streamed', () => {
      playbackService.playQueue([queueItem('other')], 0);
      expect(component.$isPlaying()).toBe(false);
    });

    it('is loading only for the track that is buffering', () => {
      playbackService.playQueue([queueItem('abc123'), queueItem('other')], 0);

      audio.fireWaiting();
      expect(component.$isLoading()).toBe(true);

      audio.fireCanPlay();
      expect(component.$isLoading()).toBe(false);
    });
  });

  describe('selection', () => {
    it('emits the song when activated with Enter', () => {
      render();
      const emitted: SourceSong[] = [];
      component.songSelected.subscribe((song) => emitted.push(song));

      const row = fixture.nativeElement.querySelector('article') as HTMLElement;
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(emitted).toEqual([SONG]);
    });

    it('is keyboard reachable and labelled for screen readers', () => {
      render();
      const row = fixture.nativeElement.querySelector('article') as HTMLElement;
      expect(row.getAttribute('role')).toBe('button');
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(row.getAttribute('aria-label')).toBe('Reproducir Nombre de la canción');
    });
  });

  describe('fallbacks', () => {
    it('shows the artist fallback when the song has no artist', () => {
      fixture.componentRef.setInput('song', { ...SONG, artist: null });
      fixture.componentRef.setInput('artistFallback', 'Artista desconocido');
      render();
      expect(text()).toContain('Artista desconocido');
    });

    it('shows the index when provided', () => {
      fixture.componentRef.setInput('index', 3);
      render();
      expect(text()).toContain('3');
    });

    it('hides the duration column when showDuration is false', () => {
      fixture.componentRef.setInput('showDuration', false);
      render();
      expect(text()).not.toContain('3:35');
    });
  });

  describe('like button', () => {
    it('renders the like button for the song', () => {
      render();
      const likeBtn = fixture.nativeElement.querySelector('app-like-button');
      expect(likeBtn).toBeTruthy();
    });
  });
});
