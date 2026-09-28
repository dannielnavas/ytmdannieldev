import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Home } from './home';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { Auth } from '../../core/services/auth/auth';
import { UserModel } from '../../core/models/user.model';

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
            getStreamUrl: (videoId: string) => `/youtube/stream/${videoId}`,
          },
        },
        // Sin este mock, `resourceMe` haría un GET real a /users/me y el test
        // falla con 401 contra el backend de producción.
        {
          provide: Auth,
          useValue: {
            getMe: () =>
              of({
                email: 'danniel@example.com',
                full_name: 'Danniel Navas',
                profile_image: '',
                youtube_handle: '@dannielnavas',
                is_youtube_premium: true,
                youtube_connected_at: new Date(),
              } satisfies UserModel),
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

  it('derives up to two initials from the user name', async () => {
    await fixture.whenStable();
    expect(component.$lettersName()).toBe('DN');
  });
});
