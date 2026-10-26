import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { Header } from './header';
import { Auth } from '../../../core/services/auth/auth';
import { UserModel } from '../../../core/models/user.model';
import { of } from 'rxjs';
import { PlaybackService } from '../../../core/services/playback.service';
import { LikesService } from '../../../core/services/likes.service';
import { SearchStore } from '../../../core/store/search-store';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let mockAuth: { getMe: any; logout: any };
  let mockPlayback: { pause: any; clearQueue: any };
  let mockLikes: { clearAll: any };
  let mockSearchStore: {
    clear: any;
    currentQuery: any;
    result: any;
    isLoading: any;
    error: any;
    search: any;
  };
  let mockRouter: { navigate: any };

  beforeEach(async () => {
    mockAuth = {
      getMe: () =>
        of({
          email: 'danniel@example.com',
          full_name: 'Danniel Navas',
          profile_image: '',
          youtube_handle: '@dannielnavas',
          is_youtube_premium: true,
          youtube_connected_at: new Date(),
        } satisfies UserModel),
      logout: vi.fn().mockResolvedValue(true),
    };

    mockPlayback = {
      pause: vi.fn(),
      clearQueue: vi.fn(),
    };

    mockLikes = {
      clearAll: vi.fn(),
    };

    mockSearchStore = {
      clear: vi.fn(),
      currentQuery: signal(''),
      result: signal(null),
      isLoading: signal(false),
      error: signal(null),
      search: vi.fn().mockReturnValue(of(null)),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: Auth, useValue: mockAuth },
        { provide: PlaybackService, useValue: mockPlayback },
        { provide: LikesService, useValue: mockLikes },
        { provide: SearchStore, useValue: mockSearchStore },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.$lettersName()).toBe('DN');
  });

  it('should toggle and close the user menu', () => {
    expect(component.isMenuOpen()).toBe(false);
    component.toggleMenu();
    expect(component.isMenuOpen()).toBe(true);
    component.closeMenu();
    expect(component.isMenuOpen()).toBe(false);
  });

  it('should handle escape key to close menu or confirm modal', () => {
    component.isMenuOpen.set(true);
    component.onEscape();
    expect(component.isMenuOpen()).toBe(false);

    component.showConfirmModal.set(true);
    component.onEscape();
    expect(component.showConfirmModal()).toBe(false);
  });

  it('should navigate to likes from menu', () => {
    component.isMenuOpen.set(true);
    component.goToLikes();
    expect(component.isMenuOpen()).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/likes']);
  });

  it('should open confirm modal on requestLogout', () => {
    component.isMenuOpen.set(true);
    component.requestLogout();
    expect(component.isMenuOpen()).toBe(false);
    expect(component.showConfirmModal()).toBe(true);

    component.cancelLogout();
    expect(component.showConfirmModal()).toBe(false);
  });

  it('should perform complete logout on confirmLogout', async () => {
    component.showConfirmModal.set(true);
    await component.confirmLogout();

    expect(mockPlayback.pause).toHaveBeenCalled();
    expect(mockPlayback.clearQueue).toHaveBeenCalled();
    expect(mockSearchStore.clear).toHaveBeenCalled();
    expect(mockLikes.clearAll).toHaveBeenCalled();
    expect(mockAuth.logout).toHaveBeenCalled();
    expect(component.showConfirmModal()).toBe(false);
    expect(component.isMenuOpen()).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });
});

