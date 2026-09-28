import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailHero } from './detail-hero';
import { ColorThiefService } from '@soarlin/angular-color-thief';

describe('DetailHero', () => {
  let fixture: ComponentFixture<DetailHero>;
  let component: DetailHero;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailHero],
      providers: [
        {
          provide: ColorThiefService,
          // `CoverPalette` reads the dominant colour from the first entry of
          // the palette, so only `getPalette` is exercised.
          useValue: {
            getPalette: () => [
              [120, 60, 200],
              [10, 20, 30],
            ],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailHero);
    component = fixture.componentInstance;
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

  describe('labels per kind', () => {
    it('defaults to the album wording', () => {
      expect(component.kindLabel()).toBe('Álbum');
      expect(component.placeholderTitle()).toBe('Carátula de álbum');
      expect(component.missingTitle()).toBe('Álbum sin título');
      expect(component.playAllLabel()).toBe('Reproducir álbum completo');
    });

    it('uses the playlist wording', () => {
      fixture.componentRef.setInput('kind', 'PLAYLIST');
      expect(component.kindLabel()).toBe('Playlist');
      expect(component.placeholderTitle()).toBe('Carátula de playlist');
      expect(component.missingTitle()).toBe('Playlist sin título');
      expect(component.playAllLabel()).toBe('Reproducir playlist');
    });
  });

  describe('songCountLabel', () => {
    it('uses the singular for exactly one song', () => {
      fixture.componentRef.setInput('totalSongs', 1);
      expect(component.songCountLabel()).toBe('1 canción');
    });

    it('uses the plural for zero or many', () => {
      fixture.componentRef.setInput('totalSongs', 0);
      expect(component.songCountLabel()).toBe('0 canciones');

      fixture.componentRef.setInput('totalSongs', 12);
      expect(component.songCountLabel()).toBe('12 canciones');
    });
  });

  describe('totalDurationLabel', () => {
    it('is empty when there is no duration', () => {
      fixture.componentRef.setInput('totalDuration', 0);
      expect(component.totalDurationLabel()).toBe('');
    });

    it('formats minutes under an hour', () => {
      fixture.componentRef.setInput('totalDuration', 215);
      expect(component.totalDurationLabel()).toBe('3 min');
    });

    it('formats hours and minutes', () => {
      fixture.componentRef.setInput('totalDuration', 7380);
      expect(component.totalDurationLabel()).toBe('2 h 3 min');
    });
  });

  describe('yearLabel', () => {
    it('renders numbers and strings', () => {
      fixture.componentRef.setInput('year', 1998);
      expect(component.yearLabel()).toBe('1998');

      fixture.componentRef.setInput('year', '2001');
      expect(component.yearLabel()).toBe('2001');
    });

    it('is empty when absent', () => {
      fixture.componentRef.setInput('year', null);
      expect(component.yearLabel()).toBe('');
    });
  });

  describe('artwork', () => {
    it('renders the title when present', () => {
      fixture.componentRef.setInput('title', 'Random Access Memories');
      render();
      expect(text()).toContain('Random Access Memories');
    });

    it('falls back to a generic title', () => {
      render();
      expect(text()).toContain('Álbum sin título');
    });

    it('shows the year badge only when there is a year', () => {
      render();
      expect(text()).not.toContain('1998');

      fixture.componentRef.setInput('year', 1998);
      render();
      expect(text()).toContain('1998');
    });
  });

  describe('palette', () => {
    it('keeps the default gradient without a dominant colour', () => {
      expect(component.heroGradientStyle()).toContain('rgba(88, 28, 135, 0.4)');
    });

    it('rebuilds the gradient from the extracted colour', () => {
      component.onImageLoad(document.createElement('img'));

      expect(component.$color()).toEqual([120, 60, 200]);
      expect(component.heroGradientStyle()).toContain('rgba(120, 60, 200, 0.45)');
    });

    it('builds the play button from the dominant colour', () => {
      component.onImageLoad(document.createElement('img'));

      expect(component.playButtonStyle()['background']).toContain('rgb(120, 60, 200)');
    });
  });

  describe('actions', () => {
    it('emits playAll from the artwork overlay', () => {
      render();
      let emitted = 0;
      component.playAll.subscribe(() => emitted++);

      (fixture.nativeElement.querySelector('button') as HTMLElement).click();
      fixture.detectChanges();

      expect(emitted).toBe(1);
    });

    it('emits playShuffle', () => {
      render();
      let emitted = 0;
      component.playShuffle.subscribe(() => emitted++);

      const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
      buttons[buttons.length - 1].click();
      fixture.detectChanges();

      expect(emitted).toBe(1);
    });
  });
});
