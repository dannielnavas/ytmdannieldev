import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authorizationGuard } from './authorization-guard';
import { Auth } from '../services/auth/auth';

describe('authorizationGuard', () => {
  let authSpy: { getToken: ReturnType<typeof vi.fn> };
  let routerSpy: { createUrlTree: ReturnType<typeof vi.fn> };
  let fakeUrlTree: UrlTree;

  const run = () =>
    TestBed.runInInjectionContext(() => authorizationGuard({} as never, {} as never));

  beforeEach(() => {
    authSpy = { getToken: vi.fn() };
    fakeUrlTree = {} as UrlTree;
    routerSpy = { createUrlTree: vi.fn().mockReturnValue(fakeUrlTree) };

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('allows navigation when a token exists', () => {
    authSpy.getToken.mockReturnValue('jwt-123');

    expect(run()).toBe(true);
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to / when there is no token', () => {
    authSpy.getToken.mockReturnValue(null);

    expect(run()).toBe(fakeUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('redirects to / when reading storage throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authSpy.getToken.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(run()).toBe(fakeUrlTree);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
