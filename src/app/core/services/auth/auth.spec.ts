import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Auth } from './auth';

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(Auth);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should remove token and invoke electronAPI.logout if available on logout', async () => {
    const electronLogout = vi.fn().mockResolvedValue(true);
    (window as any).electronAPI = { logout: electronLogout };

    const result = await service.logout();
    expect(result).toBe(true);
    expect(electronLogout).toHaveBeenCalled();

    delete (window as any).electronAPI;
  });
});
