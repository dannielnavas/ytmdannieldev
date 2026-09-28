import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Album } from './album';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaybackService } from '../../../../core/services/playback.service';

describe('Album', () => {
  let component: Album;
  let fixture: ComponentFixture<Album>;
  let playbackService: PlaybackService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Album],
      providers: [provideHttpClient(), provideHttpClientTesting(), PlaybackService],
    }).compileComponents();

    playbackService = TestBed.inject(PlaybackService);
    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(Album);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('normalizes the RDAMVM/RDAMPL prefix coming from the route', () => {
    fixture.componentRef.setInput('albumId', 'RDAMVMdQw4w9WgXcQ');
    expect(component.$albumId()).toBe('dQw4w9WgXcQ');

    fixture.componentRef.setInput('albumId', 'RDAMPLtestPlaylistId');
    expect(component.$albumId()).toBe('testPlaylistId');

    fixture.componentRef.setInput('albumId', 'plainId');
    expect(component.$albumId()).toBe('plainId');
  });

  it('falls back to playing the album itself when the service fails', () => {
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
