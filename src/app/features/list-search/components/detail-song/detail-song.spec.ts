import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DetailSong } from './detail-song';

describe('DetailSong', () => {
  let component: DetailSong;
  let fixture: ComponentFixture<DetailSong>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailSong],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailSong);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
