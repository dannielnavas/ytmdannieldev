import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailSongAlbum } from './detail-song-album';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('DetailSongAlbum', () => {
  let component: DetailSongAlbum;
  let fixture: ComponentFixture<DetailSongAlbum>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailSongAlbum],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailSongAlbum);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
