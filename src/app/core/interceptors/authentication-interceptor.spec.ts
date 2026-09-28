import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authenticationInterceptor } from './authentication-interceptor';
import { Auth } from '../services/auth/auth';

describe('authenticationInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authSpy: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authSpy = { getToken: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: authSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('attaches the bearer token when a token exists', () => {
    authSpy.getToken.mockReturnValue('jwt-123');

    http.get('/protected').subscribe();

    const req = httpTesting.expectOne('/protected');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({});
  });

  it('leaves the request untouched when there is no token', () => {
    authSpy.getToken.mockReturnValue(null);

    http.get('/public').subscribe();

    const req = httpTesting.expectOne('/public');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not attach the token to origins outside the API allowlist', () => {
    authSpy.getToken.mockReturnValue('jwt-123');

    http.get('https://evil.example.com/collect').subscribe();

    const req = httpTesting.expectOne('https://evil.example.com/collect');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('attaches the token to the backend origin', () => {
    authSpy.getToken.mockReturnValue('jwt-123');

    http.get('https://ytmdannieldev-back.vercel.app/users/me').subscribe();

    const req = httpTesting.expectOne('https://ytmdannieldev-back.vercel.app/users/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({});
  });
});
