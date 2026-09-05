import { TestBed } from '@angular/core/testing';
import { ElectronMedia } from './electron-media';

describe('ElectronMedia', () => {
  let service: ElectronMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ElectronMedia);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
