import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitleBarComponent } from '../../../../shared/components/title-bar/title-bar.component';
import { PlayerBar } from '../player-bar/player-bar';

@Component({
  imports: [RouterOutlet, TitleBarComponent, PlayerBar],
  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  public $title = signal('Sonara');
}
