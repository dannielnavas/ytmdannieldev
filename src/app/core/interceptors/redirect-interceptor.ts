import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { Router } from '@angular/router';
import { Token } from '../services/token';

export const redirectInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(Token);
  const router = inject(Router);

  const isValidToken = tokenService.isValidToken();

  if (isValidToken) {
    router.navigate(['/home']);
    return next(req);
  }

  return next(req);
};
