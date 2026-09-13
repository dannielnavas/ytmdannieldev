import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailSongPlaylist } from './detail-song-playlist';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('DetailSongPlaylist', () => {
  let component: DetailSongPlaylist;
  let fixture: ComponentFixture<DetailSongPlaylist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailSongPlaylist],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailSongPlaylist);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
