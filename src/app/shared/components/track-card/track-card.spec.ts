import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackCard } from './track-card';

describe('TrackCard', () => {
  let component: TrackCard;
  let fixture: ComponentFixture<TrackCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackCard],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
