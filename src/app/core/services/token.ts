import { Service, inject } from '@angular/core';
import { Auth } from './auth/auth';
import { jwtDecode, JwtPayload } from 'jwt-decode';

@Service()
export class Token {
  private readonly _auth = inject(Auth);

  isValidToken(): boolean {
    const token = this._auth.getToken();
    if (!token) {
      return false;
    }
    try {
      const decodedToken = jwtDecode<JwtPayload>(token);
      if (decodedToken && decodedToken.exp) {
        return decodedToken.exp * 1000 > Date.now();
      }
    } catch {
      return false;
    }
    return false;
  }
}
