import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListSearch } from './list-search';
import { ColorThiefService } from '@soarlin/angular-color-thief';

describe('ListSearch', () => {
  let component: ListSearch;
  let fixture: ComponentFixture<ListSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListSearch],
      providers: [ColorThiefService],
    }).compileComponents();

    fixture = TestBed.createComponent(ListSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
