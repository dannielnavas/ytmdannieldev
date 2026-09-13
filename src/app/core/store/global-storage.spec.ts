import { TestBed } from '@angular/core/testing';
import { GlobalStorage } from './global-storage';

describe('GlobalStorage', () => {
  let service: GlobalStorage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GlobalStorage);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
