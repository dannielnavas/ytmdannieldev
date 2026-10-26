import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ListSearch } from './list-search';
import { ColorThiefService } from '@soarlin/angular-color-thief';
import { Auth } from '../../../../core/services/auth/auth';
import { UserModel } from '../../../../core/models/user.model';
import { of } from 'rxjs';
import { SearchStore } from '../../../../core/store/search-store';

describe('ListSearch', () => {
  let component: ListSearch;
  let fixture: ComponentFixture<ListSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListSearch],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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

  it('should trigger search when q input is provided', () => {
    const searchStore = TestBed.inject(SearchStore);
    const searchSpy = vi.spyOn(searchStore, 'search').mockReturnValue(of(null));
    fixture.componentRef.setInput('q', 'Coldplay');
    fixture.detectChanges();
    expect(searchSpy).toHaveBeenCalledWith('Coldplay');
  });
});
