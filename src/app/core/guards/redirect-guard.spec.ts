import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { redirectGuard } from './redirect-guard';
import { Token } from '../services/token';

describe('redirectGuard', () => {
  let tokenServiceSpy: { isValidToken: ReturnType<typeof vi.fn> };
  let routerSpy: { createUrlTree: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenServiceSpy = { isValidToken: vi.fn() };
    routerSpy = { createUrlTree: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Token, useValue: tokenServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('should allow navigation to auth when token is not valid', () => {
    tokenServiceSpy.isValidToken.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => redirectGuard({} as any, {} as any));

    expect(result).toBe(true);
  });

  it('should redirect to /home when token is valid', () => {
    const fakeUrlTree = {} as UrlTree;
    tokenServiceSpy.isValidToken.mockReturnValue(true);
    routerSpy.createUrlTree.mockReturnValue(fakeUrlTree);

    const result = TestBed.runInInjectionContext(() => redirectGuard({} as any, {} as any));

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe(fakeUrlTree);
  });
});
