import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Playlist } from './playlist';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaybackService } from '../../../../core/services/playback.service';

describe('Playlist', () => {
  let component: Playlist;
  let fixture: ComponentFixture<Playlist>;
  let playbackService: PlaybackService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Playlist],
      providers: [provideHttpClient(), provideHttpClientTesting(), PlaybackService],
    }).compileComponents();

    playbackService = TestBed.inject(PlaybackService);
    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(Playlist);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('normalizes the RDAMVM/RDAMPL prefix coming from the route', () => {
    fixture.componentRef.setInput('playlistId', 'RDAMVMdQw4w9WgXcQ');
    expect(component.$playlistId()).toBe('dQw4w9WgXcQ');

    fixture.componentRef.setInput('playlistId', 'RDAMPLtestAlbumId');
    expect(component.$playlistId()).toBe('testAlbumId');

    fixture.componentRef.setInput('playlistId', 'PL123');
    expect(component.$playlistId()).toBe('PL123');
  });

  it('falls back to playing the playlist itself when the service fails', () => {
    const playSingleSpy = vi.spyOn(playbackService, 'playSingle');

    component.fallbackPlayTrack('dQw4w9WgXcQ');

    expect(playSingleSpy).toHaveBeenCalledWith({
      videoId: 'dQw4w9WgXcQ',
      name: '',
      artist: '',
      thumbnail: '',
    });
  });

  it('does not attempt playback without an id', () => {
    const playSingleSpy = vi.spyOn(playbackService, 'playSingle');

    component.fallbackPlayTrack('');

    expect(playSingleSpy).not.toHaveBeenCalled();
  });
});
