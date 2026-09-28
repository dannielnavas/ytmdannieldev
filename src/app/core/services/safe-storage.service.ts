import { Service } from '@angular/core';

/**
 * Acceso al almacenamiento seguro de Electron (`safeStorage`), respaldado por el
 * keychain del sistema operativo.
 *
 * Antes, cuando `window.safeStorage` no estaba disponible, el servicio caía a
 * `localStorage` en texto plano y devolvía `true` como si hubiera funcionado. Eso
 * significaba que el JWT derivado de la cookie de sesión de YouTube podía quedar
 * en claro. Ahora el token **nunca** se escribe en claro: si el keychain rechaza
 * la escritura, `setItem` devuelve `false` y el login falla de forma explícita.
 */
@Service()
export class SafeStorageService {
  /**
   * Fallback para correr fuera de Electron (p.ej. `ng serve` sin la app montada).
   *
   * Los valores viven solo en memoria y se pierden al recargar. Es preferible a
   * la alternativa anterior de escribirlos en `localStorage`, donde el token
   * quedaba en texto plano legible por cualquier proceso del usuario.
   */
  private readonly session = new Map<string, string>();

  private get _bridge() {
    return typeof window !== 'undefined' ? window.safeStorage : undefined;
  }

  public async isAvailable(): Promise<boolean> {
    if (!this._bridge) {
      return false;
    }
    try {
      return await this._bridge.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Guarda un valor cifrado con la clave del sistema operativo.
   *
   * @returns `false` si el keychain rechazó la escritura. Fuera de Electron
   *   devuelve `true` porque el valor queda solo en memoria.
   */
  public async setItem(key: string, value: string): Promise<boolean> {
    if (!this._bridge) {
      this.session.set(key, value);
      return true;
    }
    try {
      return await this._bridge.setItem(key, value);
    } catch {
      return false;
    }
  }

  public getItem(key: string): string | null {
    if (!this._bridge) {
      return this.session.get(key) ?? null;
    }
    try {
      return this._bridge.getItem(key);
    } catch {
      return null;
    }
  }

  public async removeItem(key: string): Promise<boolean> {
    this.session.delete(key);
    if (!this._bridge) {
      return true;
    }
    try {
      return await this._bridge.removeItem(key);
    } catch {
      return false;
    }
  }
}
