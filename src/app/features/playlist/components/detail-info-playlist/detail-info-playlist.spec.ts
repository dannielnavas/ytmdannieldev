import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailInfoPlaylist } from './detail-info-playlist';
import { ColorThiefService } from '@soarlin/angular-color-thief';

describe('DetailInfoPlaylist', () => {
  let component: DetailInfoPlaylist;
  let fixture: ComponentFixture<DetailInfoPlaylist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailInfoPlaylist],
      providers: [ColorThiefService],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailInfoPlaylist);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
