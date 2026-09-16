import { Service, inject } from '@angular/core';
import { Auth } from './auth/auth';
import { jwtDecode, JwtPayload } from 'jwt-decode';

@Service()
export class Token {
  private readonly _auth = inject(Auth);
  private readonly _token = this._auth.getToken();

  isValidToken() {
    const token = this._token;
    if (!token) {
      return false;
    }
    const decodedToken = jwtDecode<JwtPayload>(token);
    if (decodedToken && decodedToken?.exp) {
      const tokenDate = new Date(0);
      tokenDate.setUTCSeconds(decodedToken.exp);
      const today = new Date();
      return tokenDate.getDate() > today.getDate();
    }
    return false;
  }
}
