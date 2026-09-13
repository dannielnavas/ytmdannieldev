import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Home } from './home';
import { Dashboard } from '../../core/services/dashboard/dashboard';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        {
          provide: Dashboard,
          useValue: {
            getDashboardData: () => of([]),
            stream: () => of({ videoId: '123', streamUrl: '/youtube/stream/123' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
