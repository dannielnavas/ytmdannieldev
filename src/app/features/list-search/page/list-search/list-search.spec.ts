import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListSearch } from './list-search';
import { ColorThiefService } from '@soarlin/angular-color-thief';
import { Auth } from '../../../../core/services/auth/auth';
import { UserModel } from '../../../../core/models/user.model';
import { of } from 'rxjs';

describe('ListSearch', () => {
  let component: ListSearch;
  let fixture: ComponentFixture<ListSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListSearch],
      providers: [
        ColorThiefService,
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

    fixture = TestBed.createComponent(ListSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
