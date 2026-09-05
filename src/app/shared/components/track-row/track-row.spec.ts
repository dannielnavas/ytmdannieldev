import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackRow } from './track-row';

describe('TrackRow', () => {
  let component: TrackRow;
  let fixture: ComponentFixture<TrackRow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackRow],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackRow);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
