import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaylistGrid } from './playlist-grid';

describe('PlaylistGrid', () => {
  let component: PlaylistGrid;
  let fixture: ComponentFixture<PlaylistGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaylistGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(PlaylistGrid);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
