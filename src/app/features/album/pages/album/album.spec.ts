import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Album } from './album';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { PlaybackService } from '../../../../core/services/playback.service';

describe('Album', () => {
  let component: Album;
  let fixture: ComponentFixture<Album>;
  let globalStorage: GlobalStorage;
  let playbackService: PlaybackService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Album],
      providers: [provideHttpClient(), provideHttpClientTesting(), GlobalStorage, PlaybackService],
    }).compileComponents();

    globalStorage = TestBed.inject(GlobalStorage);
    playbackService = TestBed.inject(PlaybackService);
    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(Album);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fallback to playing song using stored ID when album service fails', () => {
    const playSingleSpy = vi.spyOn(playbackService, 'playSingle');

    globalStorage.setStore('album', {
      albumId: 'RDAMVMdQw4w9WgXcQ',
      name: 'Sample Song',
      artist: 'Sample Artist',
      thumbnail: 'https://example.com/thumb.jpg',
    });

    component.fallbackPlayTrack();

    expect(playSingleSpy).toHaveBeenCalledWith({
      videoId: 'dQw4w9WgXcQ',
      name: 'Sample Song',
      artist: 'Sample Artist',
      thumbnail: 'https://example.com/thumb.jpg',
    });
  });

  it('should fallback to playlistId if albumId is not present', () => {
    const playSingleSpy = vi.spyOn(playbackService, 'playSingle');

    globalStorage.setStore('album', {
      playlistId: 'RDAMPLtestPlaylistId',
      name: 'Playlist Track',
    });

    component.fallbackPlayTrack();

    expect(playSingleSpy).toHaveBeenCalledWith({
      videoId: 'testPlaylistId',
      name: 'Playlist Track',
      artist: '',
      thumbnail: '',
    });
  });
});
