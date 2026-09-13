import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailInfoAlbum } from './detail-info-album';
import { ColorThiefService } from '@soarlin/angular-color-thief';

describe('DetailInfoAlbum', () => {
  let component: DetailInfoAlbum;
  let fixture: ComponentFixture<DetailInfoAlbum>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailInfoAlbum],
      providers: [ColorThiefService],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailInfoAlbum);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
