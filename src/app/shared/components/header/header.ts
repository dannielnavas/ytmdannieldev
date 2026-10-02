import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { UserModel } from '../../../core/models/user.model';
import { Auth } from '../../../core/services/auth/auth';
import { Search } from '../../../features/search/search';
import { Location } from '@angular/common';
import { LucideArrowLeft, LucideCrown } from '@lucide/angular';

@Component({
  imports: [Search, LucideCrown, LucideArrowLeft],
  selector: 'app-header',
  styleUrl: './header.css',
  templateUrl: './header.html',
})
export class Header {
  private readonly _authService = inject(Auth);
  private readonly _location = inject(Location);

  public $showBack = input<boolean>(false);

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

  public goBack() {
    this._location.back();
  }
}
