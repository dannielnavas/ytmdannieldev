/**
 * Configuración de la API del backend.
 *
 * Antes esta URL estaba hardcodeada en 11 sitios distintos (4 archivos). Cualquier
 * cambio de host o la necesidad de apuntar a staging obligaba a editar todos.
 */
export const API_BASE_URL = 'https://ytmdannieldev-back.vercel.app';

/**
 * Orígenes a los que se puede enviar el token de sesión de YouTube.
 *
 * El interceptor se registra globalmente, así que sin esta lista cualquier
 * `HttpClient` futuro hacia un tercero filtraría el bearer token.
 */
export const API_ALLOWED_ORIGINS: readonly string[] = [API_BASE_URL];

/**
 * Construye una URL de la API a partir de sus segmentos, codificando cada valor.
 *
 * @example apiUrl('youtube', 'stream', videoId) -> '.../youtube/stream/abc%2Fdef'
 */
export function apiUrl(...segments: (string | number)[]): string {
  const path = segments.map((segment) => encodeURIComponent(String(segment))).join('/');
  return `${API_BASE_URL}/${path}`;
}

/**
 * Indica si una URL de `HttpClient` apunta al backend y por tanto puede llevar
 * el token de sesión.
 *
 * Las rutas relativas se consideran de confianza: son el propio app, no un tercero.
 */
export function isApiRequest(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return true;
  }
  try {
    return API_ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
