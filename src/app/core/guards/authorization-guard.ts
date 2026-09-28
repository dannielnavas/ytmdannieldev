import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../services/auth/auth';

export const authorizationGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  try {
    // `getToken()` es síncrono; antes se hacía `await` sobre un valor no-Promise,
    // lo que ocultaba que esto hace IPC bloqueante en cada navegación.
    if (auth.getToken()) {
      return true;
    }
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
  }

  // Devolver un UrlTree en vez de `navigate()` + `return false` evita que el router
  // cancele esta navegación y arranque otra, dos eventos por un solo rechazo.
  return router.createUrlTree(['/']);
};
