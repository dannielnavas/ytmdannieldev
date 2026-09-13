import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerBar } from './player-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ColorThiefService } from '@soarlin/angular-color-thief';

describe('PlayerBar', () => {
  let component: PlayerBar;
  let fixture: ComponentFixture<PlayerBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerBar],
      providers: [provideHttpClient(), provideHttpClientTesting(), ColorThiefService],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
