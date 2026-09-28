import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { isApiRequest } from '../config/api.config';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.getToken();

  // El interceptor es global: sin este filtro, cualquier petición a un tercero
  // (o a un recurso remoto cargado por un componente) arrastraría el bearer token.
  if (!token || !isApiRequest(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
