import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BannerLikes } from './banner-likes';
import { LikesService } from '../../../core/services/likes.service';
import { PlaybackService } from '../../../core/services/playback.service';

describe('BannerLikes', () => {
  let component: BannerLikes;
  let fixture: ComponentFixture<BannerLikes>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BannerLikes],
      providers: [provideHttpClient(), provideHttpClientTesting(), LikesService, PlaybackService],
    }).compileComponents();

    fixture = TestBed.createComponent(BannerLikes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle demo like button', () => {
    expect(component.demoLiked()).toBe(false);
    component.toggleDemoLike();
    expect(component.demoLiked()).toBe(true);
  });

  it('should dismiss banner when dismiss is called', () => {
    expect(component.isDismissed()).toBe(false);
    component.dismiss();
    expect(component.isDismissed()).toBe(true);
  });
});
