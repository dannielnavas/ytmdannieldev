import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LikeButton } from './like-button';
import { LikesService } from '../../../core/services/likes.service';

describe('LikeButton', () => {
  let component: LikeButton;
  let fixture: ComponentFixture<LikeButton>;
  let likesService: LikesService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LikeButton],
      providers: [LikesService, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LikeButton);
    component = fixture.componentInstance;
    likesService = TestBed.inject(LikesService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should recognize unliked state initially', () => {
    fixture.componentRef.setInput('videoId', 'song-1');
    fixture.detectChanges();

    expect(component.isLiked()).toBe(false);
    expect(component.buttonTitle()).toBe('Guardar en tus me gusta');
  });

  it('should toggle like on click and emit output', () => {
    fixture.componentRef.setInput('song', { videoId: 'song-1', name: 'Test Song' });
    fixture.detectChanges();

    let emitted: boolean | undefined;
    component.likedChange.subscribe((val) => (emitted = val));

    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(emitted).toBe(true);
    expect(component.isLiked()).toBe(true);
    expect(likesService.isLiked('song-1')).toBe(true);

    // Click again to unlike
    button.click();
    fixture.detectChanges();

    expect(emitted).toBe(false);
    expect(component.isLiked()).toBe(false);
    expect(likesService.isLiked('song-1')).toBe(false);
  });

  it('should stop event propagation when clicked', () => {
    fixture.componentRef.setInput('videoId', 'song-2');
    fixture.detectChanges();

    const mockEvent = new MouseEvent('click');
    const stopSpy = vi.spyOn(mockEvent, 'stopPropagation');
    const prevSpy = vi.spyOn(mockEvent, 'preventDefault');

    component.onToggle(mockEvent);

    expect(stopSpy).toHaveBeenCalled();
    expect(prevSpy).toHaveBeenCalled();
  });
});
