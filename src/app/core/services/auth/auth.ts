import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { SafeStorageService } from '../safe-storage.service';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly _http = inject(HttpClient);
  private readonly _safeStorage = inject(SafeStorageService);

  public login(cookies: string) {
    return this._http
      .post<{ access_token: string }>('https://ytmdannieldev-back.vercel.app/auth/login-cookie', {
        youtube_cookies: cookies,
      })
      .pipe(
        tap(async (response) => {
          await this._safeStorage.setItem('youtube-cookies', response.access_token);
        }),
      );
  }

  public getToken(): string | null {
    return this._safeStorage.getItem('youtube-cookies');
  }

  public async logout(): Promise<boolean> {
    return this._safeStorage.removeItem('youtube-cookies');
  }

  public getMe(): Observable<{}> {
    return this._http.get<{}>('https://ytmdannieldev-back.vercel.app/auth/me');
  }
}
