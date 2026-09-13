import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../services/auth/auth';

export const authorizationGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const _router = inject(Router);

  try {
    const token = await auth.getToken();

    if (token) {
      return true;
    } else {
      _router.navigate(['/auth']);
      return false;
    }
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    _router.navigate(['/auth']);
    return false;
  }
};
