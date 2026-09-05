import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthViewComponent } from './auth-view';

describe('AuthViewComponent', () => {
  let component: AuthViewComponent;
  let fixture: ComponentFixture<AuthViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthViewComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

