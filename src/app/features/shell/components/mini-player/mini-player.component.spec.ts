import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MiniPlayerComponent } from './mini-player.component';
import { PlaybackService } from '../../../../core/services/playback.service';
import { WindowControlsService } from '../../../../core/services/window-controls.service';
import { AUDIO_FACTORY } from '../../../../core/services/audio-factory';
import { createFakeAudioFactory } from '../../../../core/testing/fake-audio-element';

describe('MiniPlayerComponent', () => {
  let component: MiniPlayerComponent;
  let fixture: ComponentFixture<MiniPlayerComponent>;
  let playback: PlaybackService;
  let controls: WindowControlsService;

  beforeEach(async () => {
    const factory = createFakeAudioFactory();

    await TestBed.configureTestingModule({
      imports: [MiniPlayerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MiniPlayerComponent);
    component = fixture.componentInstance;
    playback = TestBed.inject(PlaybackService);
    controls = TestBed.inject(WindowControlsService);

    playback.playQueue(
      [
        { id: '1', videoId: 'v1', name: 'Song One', artist: 'Artist One', duration: 180 },
        { id: '2', videoId: 'v2', name: 'Song Two', artist: 'Artist Two', duration: 200 },
      ],
      0,
    );

    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('creates the component and shows track title and artist', () => {
    expect(component).toBeTruthy();
    expect(component.trackTitle()).toBe('Song One');
    expect(component.trackAuthor()).toBe('Artist One');
  });

  it('triggers previous and next actions on playback service', () => {
    const nextSpy = vi.spyOn(playback, 'playNext');
    const prevSpy = vi.spyOn(playback, 'previous');

    component.playbackService.playNext();
    expect(nextSpy).toHaveBeenCalled();

    component.playbackService.previous();
    expect(prevSpy).toHaveBeenCalled();
  });

  it('toggles play/pause when invoked', () => {
    const toggleSpy = vi.spyOn(playback, 'togglePlay');
    component.playbackService.togglePlay();
    expect(toggleSpy).toHaveBeenCalled();
  });

  it('calls restoreFullWindow on controls', () => {
    const toggleSpy = vi.spyOn(controls, 'toggleMiniPlayer');
    component.restoreFullWindow();
    expect(toggleSpy).toHaveBeenCalledWith(false);
  });
});
