import { TestBed } from '@angular/core/testing';
import { Token } from './token';
import { Auth } from './auth/auth';

/** Construye un JWT sin firma (jwt-decode solo necesita el payload en base64url). */
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('Token', () => {
  let service: Token;
  let authSpy: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authSpy = { getToken: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: authSpy }],
    });
    service = TestBed.inject(Token);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns false when there is no token', () => {
    authSpy.getToken.mockReturnValue(null);
    expect(service.isValidToken()).toBe(false);
  });

  it('returns true for a token that expires in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    authSpy.getToken.mockReturnValue(makeJwt({ sub: 'u1', exp }));
    expect(service.isValidToken()).toBe(true);
  });

  it('returns false for an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    authSpy.getToken.mockReturnValue(makeJwt({ sub: 'u1', exp }));
    expect(service.isValidToken()).toBe(false);
  });

  it('treats a token without an exp claim as invalid', () => {
    authSpy.getToken.mockReturnValue(makeJwt({ sub: 'u1' }));
    expect(service.isValidToken()).toBe(false);
  });

  it('returns false instead of throwing on a malformed token', () => {
    authSpy.getToken.mockReturnValue('not-a-jwt');
    expect(() => service.isValidToken()).not.toThrow();
    expect(service.isValidToken()).toBe(false);
  });
});
