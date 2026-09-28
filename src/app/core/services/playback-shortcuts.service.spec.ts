import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaybackShortcutsService } from './playback-shortcuts.service';
import { PlaybackService } from './playback.service';
import { AUDIO_FACTORY } from './audio-factory';
import { FakeAudioElement, createFakeAudioFactory } from '../testing/fake-audio-element';
import { QueueItem } from '../models/queue.model';

function item(n: number): QueueItem {
  return { id: `id${n}`, videoId: `v${n}`, name: `Song ${n}`, artist: 'Artist', duration: 200 };
}

describe('PlaybackShortcutsService', () => {
  let service: PlaybackShortcutsService;
  let playback: PlaybackService;
  let audio: FakeAudioElement;

  function press(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    window.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    const factory = createFakeAudioFactory();
    audio = factory();

    TestBed.configureTestingModule({
      providers: [
        PlaybackShortcutsService,
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });

    service = TestBed.inject(PlaybackShortcutsService);
    playback = TestBed.inject(PlaybackService);
    playback.playQueue([item(1), item(2), item(3)], 0);
    audio.setDuration(200);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('transport', () => {
    it('toggles play with space', () => {
      const event = press(' ');
      expect(playback.$isPlaying()).toBe(false);
      // Space must not also activate the focused button.
      expect(event.defaultPrevented).toBe(true);
      expect(service).toBeTruthy();
    });

    it('toggles play with k', () => {
      press('k');
      expect(playback.$isPlaying()).toBe(false);
    });

    it('moves to the next track with the right arrow', () => {
      press('ArrowRight');
      expect(playback.$currentIndex()).toBe(1);
    });

    it('goes back with the left arrow', () => {
      press('ArrowRight');
      press('ArrowLeft');
      expect(playback.$currentIndex()).toBe(0);
    });

    it('seeks ten seconds with shift and the arrows', () => {
      audio.tick(30);
      press('ArrowRight', { shiftKey: true });
      expect(audio.currentTime).toBe(40);

      press('ArrowLeft', { shiftKey: true });
      expect(audio.currentTime).toBe(30);
    });
  });

  describe('volume and modes', () => {
    it('raises and lowers the volume', () => {
      playback.setVolume(0.5);

      press('ArrowUp');
      expect(playback.$volume()).toBeCloseTo(0.55);

      press('ArrowDown');
      press('ArrowDown');
      expect(playback.$volume()).toBeCloseTo(0.45);
    });

    it('toggles mute with m', () => {
      playback.setVolume(0.8);
      press('m');
      expect(playback.$isMuted()).toBe(true);
    });

    it('toggles shuffle with s', () => {
      press('s');
      expect(playback.$isShuffle()).toBe(true);
    });

    it('cycles repeat with r', () => {
      press('r');
      expect(playback.$repeatMode()).toBe('one');
    });

    it('speeds up and down with + and -', () => {
      press('+');
      expect(playback.$playbackRate()).toBe(1.25);

      press('-');
      expect(playback.$playbackRate()).toBe(1);

      press('-');
      expect(playback.$playbackRate()).toBe(0.75);
    });
  });

  describe('seeking', () => {
    it('jumps to a percentage with the digits', () => {
      press('5');
      expect(audio.currentTime).toBe(100);

      press('0');
      expect(audio.currentTime).toBe(0);
    });

    it('goes to the start with Home', () => {
      audio.tick(90);
      press('Home');
      expect(audio.currentTime).toBe(0);
    });
  });

  describe('when the keystroke is not ours', () => {
    it('ignores a text field', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(playback.$isPlaying()).toBe(true);
      input.remove();
    });

    it('ignores a range input, which does not eat text', () => {
      const input = document.createElement('input');
      input.type = 'range';
      document.body.appendChild(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(playback.$currentIndex()).toBe(1);
      input.remove();
    });

    it('ignores a textarea and a select', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
      expect(playback.$isShuffle()).toBe(false);
      textarea.remove();

      const select = document.createElement('select');
      document.body.appendChild(select);
      select.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
      expect(playback.$isShuffle()).toBe(false);
      select.remove();
    });

    it('ignores contentEditable', () => {
      const div = document.createElement('div');
      // The attribute, not the IDL property: that is what a browser reflects.
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));

      expect(playback.$isShuffle()).toBe(false);
      div.remove();
    });

    it('ignores a child of a contentEditable region', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      const child = document.createElement('span');
      div.appendChild(child);
      document.body.appendChild(div);
      child.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));

      expect(playback.$isShuffle()).toBe(false);
      div.remove();
    });

    it('still listens inside contenteditable="false"', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'false');
      const child = document.createElement('span');
      div.appendChild(child);
      document.body.appendChild(div);
      child.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));

      expect(playback.$isShuffle()).toBe(true);
      div.remove();
    });

    it('ignores shortcuts with a modifier', () => {
      press('ArrowRight', { ctrlKey: true });
      press('ArrowRight', { metaKey: true });
      press('s', { altKey: true });

      expect(playback.$currentIndex()).toBe(0);
      expect(playback.$isShuffle()).toBe(false);
    });

    it('ignores unmapped keys', () => {
      press('q');
      press('F5');
      expect(playback.$currentIndex()).toBe(0);
    });

    it('does nothing when there is no track', () => {
      playback.stop();
      const event = press('ArrowRight');

      expect(playback.$currentIndex()).toBe(0);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  it('stops listening once destroyed', () => {
    press('ArrowRight');
    expect(playback.$currentIndex()).toBe(1);

    TestBed.resetTestingModule();
    press('ArrowRight');
    expect(playback.$currentIndex()).toBe(1);
  });
});
