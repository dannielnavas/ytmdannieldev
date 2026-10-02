import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Header } from './header';
import { Auth } from '../../../core/services/auth/auth';
import { UserModel } from '../../../core/models/user.model';
import { of } from 'rxjs';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
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

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
