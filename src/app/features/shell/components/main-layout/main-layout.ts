import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TitleBarComponent } from '../../../../shared/components/title-bar/title-bar.component';
import { PlayerBar } from '../player-bar/player-bar';

@Component({
  imports: [RouterOutlet, TitleBarComponent, PlayerBar],
  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly _router = inject(Router);

  public $title = signal('Sonara');
  public $isNowPlaying = signal<boolean>(this._router.url.includes('/now-playing'));

  constructor() {
    this._router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.$isNowPlaying.set(this._router.url.includes('/now-playing'));
    });
  }

  public onOutletActivate(component: any): void {
    const isNow = component?.constructor?.name === 'NowPlaying' || this._router.url.includes('/now-playing');
    this.$isNowPlaying.set(isNow);
  }

  public onOutletDeactivate(): void {
    this.$isNowPlaying.set(this._router.url.includes('/now-playing'));
  }
}
