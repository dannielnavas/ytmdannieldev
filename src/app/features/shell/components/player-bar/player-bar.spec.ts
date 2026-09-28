import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerBar } from './player-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ColorThiefService } from '@soarlin/angular-color-thief';
import { PlaybackService } from '../../../../core/services/playback.service';
import { AUDIO_FACTORY } from '../../../../core/services/audio-factory';
import { createFakeAudioFactory } from '../../../../core/testing/fake-audio-element';
import { QueueItem } from '../../../../core/models/queue.model';

function track(n: number): QueueItem {
  return { id: `id${n}`, videoId: `v${n}`, name: `Song ${n}`, artist: 'Artist', duration: 120 };
}

/** jsdom has no `DragEvent`, so the payload the handlers read is faked. */
function dragEvent(type: string, data?: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const payload: Record<string, string> = data === undefined ? {} : { 'text/plain': data };
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => (payload[key] = value),
      getData: (key: string) => payload[key] ?? '',
    },
  });
  return event;
}

describe('PlayerBar', () => {
  let component: PlayerBar;
  let fixture: ComponentFixture<PlayerBar>;
  let playback: PlaybackService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PlayerBar],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ColorThiefService,
        { provide: AUDIO_FACTORY, useValue: createFakeAudioFactory() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerBar);
    component = fixture.componentInstance;
    playback = TestBed.inject(PlaybackService);
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('queue editing', () => {
    function openQueue(): HTMLElement {
      playback.playQueue([track(1), track(2), track(3)], 0);
      component.toggleQueue();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function rows(host: HTMLElement): HTMLLIElement[] {
      return Array.from(host.querySelectorAll<HTMLLIElement>('#queue-list > li'));
    }

    function names(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('#queue-list p.font-semibold')).map(
        (node) => node.textContent?.trim() ?? '',
      );
    }

    it('reorders with a drag and a drop', () => {
      const host = openQueue();
      const list = rows(host);
      expect(list.length).toBe(3);

      list[0].dispatchEvent(dragEvent('dragstart'));
      fixture.detectChanges();
      list[2].dispatchEvent(dragEvent('drop', '0'));
      fixture.detectChanges();

      expect(names(host)).toEqual(['Song 2', 'Song 3', 'Song 1']);
      expect(component.$dragIndex()).toBeNull();
    });

    it('marks the row as a drop target while hovering it', () => {
      const host = openQueue();
      const list = rows(host);

      list[1].dispatchEvent(dragEvent('dragstart'));
      const over = dragEvent('dragover');
      list[2].dispatchEvent(over);
      fixture.detectChanges();

      expect(component.isDropTarget(2)).toBe(true);
      expect(component.isDropTarget(1)).toBe(false);
      // A droppable target must prevent the default, or the browser rejects it.
      expect(over.defaultPrevented).toBe(true);

      list[1].dispatchEvent(dragEvent('dragend'));
      fixture.detectChanges();
      expect(component.isDropTarget(2)).toBe(false);
    });

    it('ignores a hover that is not a drag', () => {
      const host = openQueue();
      const over = dragEvent('dragover');
      rows(host)[1].dispatchEvent(over);

      expect(over.defaultPrevented).toBe(false);
      expect(component.$dropIndex()).toBeNull();
    });

    it('reorders with the keyboard', () => {
      const host = openQueue();
      const list = rows(host);

      list[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true }),
      );
      fixture.detectChanges();

      expect(names(host)).toEqual(['Song 2', 'Song 1', 'Song 3']);
    });

    it('does not move past the ends of the queue', () => {
      const host = openQueue();
      const list = rows(host);

      list[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', ctrlKey: true, bubbles: true }),
      );
      fixture.detectChanges();

      expect(names(host)).toEqual(['Song 1', 'Song 2', 'Song 3']);
    });

    it('lets the global volume shortcut through when there is no modifier', () => {
      const host = openQueue();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      rows(host)[0].dispatchEvent(event);

      // Not prevented here, so `PlaybackShortcutsService` still handles it.
      expect(event.defaultPrevented).toBe(false);
      expect(names(host)).toEqual(['Song 1', 'Song 2', 'Song 3']);
    });

    it('removes a row with the keyboard', () => {
      const host = openQueue();

      rows(host)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      fixture.detectChanges();

      expect(names(host)).toEqual(['Song 1', 'Song 3']);
    });

    it('removes a row with the trash button', () => {
      const host = openQueue();
      const button = host.querySelector<HTMLButtonElement>(
        '#queue-list button[aria-label^="Quitar"]',
      );

      button?.click();
      fixture.detectChanges();

      expect(names(host)).toEqual(['Song 2', 'Song 3']);
    });

    it('names the song in the remove button', () => {
      const host = openQueue();
      const button = host.querySelector<HTMLButtonElement>(
        '#queue-list button[aria-label^="Quitar"]',
      );

      expect(button?.getAttribute('aria-label')).toBe('Quitar Song 1 de la cola');
    });

    it('empties the queue from the header', () => {
      const host = openQueue();

      host.querySelector<HTMLButtonElement>('button[aria-label="Vaciar la cola"]')?.click();
      fixture.detectChanges();

      expect(playback.$queue()).toEqual([]);
      // Nothing is loaded, so the whole bar hides, drawer included.
      expect(host.querySelector('#queue-list')).toBeNull();
      expect(fixture.nativeElement.classList).toContain('hidden');
    });

    it('exposes the keyboard alternative in the list', () => {
      const host = openQueue();
      const option = host.querySelector('#queue-list button[aria-keyshortcuts]');

      expect(option?.getAttribute('aria-keyshortcuts')).toBe(
        'Control+ArrowUp Control+ArrowDown Delete',
      );
    });
  });
});
