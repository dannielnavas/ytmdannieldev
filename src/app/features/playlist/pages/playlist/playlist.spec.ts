import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Playlist } from './playlist';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GlobalStorage } from '../../../../core/store/global-storage';
import { PlaybackService } from '../../../../core/services/playback.service';

describe('Playlist', () => {
  let component: Playlist;
  let fixture: ComponentFixture<Playlist>;
  let globalStorage: GlobalStorage;
  let playbackService: PlaybackService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Playlist],
      providers: [provideHttpClient(), provideHttpClientTesting(), GlobalStorage, PlaybackService],
    }).compileComponents();

    globalStorage = TestBed.inject(GlobalStorage);
    playbackService = TestBed.inject(PlaybackService);
    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(Playlist);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fallback to playing song using stored ID when playlist service fails', () => {
    const playSingleSpy = vi.spyOn(playbackService, 'playSingle');

    globalStorage.setStore('playlist', {
      playlistId: 'RDAMVMdQw4w9WgXcQ',
      name: 'Sample Playlist Song',
      artist: 'Sample Playlist Artist',
      thumbnail: 'https://example.com/thumb-playlist.jpg',
    });

    component.fallbackPlayTrack();

    expect(playSingleSpy).toHaveBeenCalledWith({
      videoId: 'dQw4w9WgXcQ',
      name: 'Sample Playlist Song',
      artist: 'Sample Playlist Artist',
      thumbnail: 'https://example.com/thumb-playlist.jpg',
    });
  });

  it('should fallback to albumId if playlistId is not present', () => {
    const playSingleSpy = vi.spyOn(playbackService, 'playSingle');

    globalStorage.setStore('playlist', {
      albumId: 'RDAMPLtestAlbumId',
      name: 'Album Track',
    });

    component.fallbackPlayTrack();

    expect(playSingleSpy).toHaveBeenCalledWith({
      videoId: 'testAlbumId',
      name: 'Album Track',
      artist: '',
      thumbnail: '',
    });
  });
});
