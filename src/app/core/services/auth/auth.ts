import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, switchMap, throwError } from 'rxjs';
import { SafeStorageService } from '../safe-storage.service';
import { UserModel } from '../../models/user.model';
import { apiUrl } from '../../config/api.config';

const TOKEN_KEY = 'youtube-cookies';

@Service()
export class Auth {
  private readonly _http = inject(HttpClient);
  private readonly _safeStorage = inject(SafeStorageService);

  public login(cookies: string): Observable<{ access_token: string }> {
    // `switchMap` en lugar de `tap(async …)`: un callback async dentro de `tap`
    // no se espera, así que el observable completaba antes de que el token
    // llegara a disco y un fallo de escritura se perdía como rechazo no manejado.
    return this._http
      .post<{ access_token: string }>(apiUrl('auth', 'login-cookie'), {
        youtube_cookies: cookies,
      })
      .pipe(
        switchMap((response) =>
          from(this._safeStorage.setItem(TOKEN_KEY, response.access_token)).pipe(
            switchMap((stored) =>
              stored
                ? of(response)
                : throwError(() => new Error('No se pudo guardar la sesión de forma segura.')),
            ),
          ),
        ),
      );
  }

  public getToken(): string | null {
    return this._safeStorage.getItem(TOKEN_KEY);
  }

  public logout(): Promise<boolean> {
    return this._safeStorage.removeItem(TOKEN_KEY);
  }

  public getMe(): Observable<UserModel> {
    return this._http.get<UserModel>(apiUrl('users', 'me'));
  }
}
