import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { UserModel } from '../../../core/models/user.model';
import { Auth } from '../../../core/services/auth/auth';
import { Search } from '../../../features/search/search';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideChevronDown,
  LucideCrown,
  LucideHeart,
  LucideLogOut,
  LucideX,
} from '@lucide/angular';
import { PlaybackService } from '../../../core/services/playback.service';
import { LikesService } from '../../../core/services/likes.service';
import { SearchStore } from '../../../core/store/search-store';

@Component({
  imports: [
    Search,
    LucideCrown,
    LucideArrowLeft,
    LucideChevronDown,
    LucideLogOut,
    LucideHeart,
    LucideX,
  ],
  selector: 'app-header',
  styleUrl: './header.css',
  templateUrl: './header.html',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class Header {
  private readonly _authService = inject(Auth);
  private readonly _location = inject(Location);
  private readonly _router = inject(Router);
  private readonly _playbackService = inject(PlaybackService, { optional: true });
  private readonly _likesService = inject(LikesService, { optional: true });
  private readonly _searchStore = inject(SearchStore, { optional: true });

  public $showBack = input<boolean>(false);

  public readonly isMenuOpen = signal<boolean>(false);
  public readonly showConfirmModal = signal<boolean>(false);
  public readonly isLoggingOut = signal<boolean>(false);

  public resourceMe = rxResource({
    stream: () => this._authService.getMe(),
    defaultValue: {} as UserModel,
  });

  public hasAvatarError = linkedSignal({
    source: () => this.resourceMe.value()?.profile_image ?? null,
    computation: () => false,
  });

  public $lettersName = computed(() => {
    const name = this.resourceMe.value()?.full_name;
    if (!name) {
      return '';
    }
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  public goBack(): void {
    this._location.back();
  }

  public toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  public closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  public onEscape(): void {
    if (this.showConfirmModal()) {
      this.cancelLogout();
    } else if (this.isMenuOpen()) {
      this.closeMenu();
    }
  }

  public goToLikes(): void {
    this.closeMenu();
    this._router.navigate(['/likes']);
  }

  public requestLogout(): void {
    this.closeMenu();
    this.showConfirmModal.set(true);
  }

  public cancelLogout(): void {
    this.showConfirmModal.set(false);
  }

  public async confirmLogout(): Promise<void> {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    try {
      this._playbackService?.pause();
      this._playbackService?.clearQueue();
      this._searchStore?.clear();
      this._likesService?.clearAll();
      await this._authService.logout();
      this.showConfirmModal.set(false);
      this.isMenuOpen.set(false);
      await this._router.navigate(['/']);
    } catch (err) {
      console.error('Error durante el cierre de sesión:', err);
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}

