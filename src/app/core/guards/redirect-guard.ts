import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Token } from '../services/token';

export const redirectGuard: CanActivateFn = () => {
  const tokenService = inject(Token);
  const router = inject(Router);

  if (tokenService.isValidToken()) {
    return router.createUrlTree(['/home']);
  }

  return true;
};
