import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SafeStorageService {
  /**
   * Indica si la API de safeStorage de Electron está disponible en el entorno actual.
   */
  public async isAvailable(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.safeStorage) {
      try {
        return await window.safeStorage.isAvailable();
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Encripta y guarda un valor bajo una clave de forma segura en disco.
   */
  public async setItem(key: string, value: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.safeStorage) {
      return window.safeStorage.setItem(key, value);
    }
    // Fallback para desarrollo web si se ejecuta fuera de Electron
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return true;
    }
    return false;
  }

  /**
   * Obtiene y desencripta el valor guardado para la clave especificada de manera sincrónica.
   */
  public getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.safeStorage) {
      return window.safeStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }

  /**
   * Elimina la clave y su valor del almacenamiento seguro.
   */
  public async removeItem(key: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.safeStorage) {
      return window.safeStorage.removeItem(key);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return true;
    }
    return false;
  }

  /**
   * Limpia todo el almacenamiento seguro.
   */
  public async clear(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.safeStorage) {
      return window.safeStorage.clear();
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      return true;
    }
    return false;
  }

  /**
   * Encripta un texto plano usando safeStorage de Electron y devuelve la cadena en Base64.
   */
  public async encryptString(plainText: string): Promise<string> {
    if (typeof window !== 'undefined' && window.safeStorage) {
      return window.safeStorage.encryptString(plainText);
    }
    throw new Error('safeStorage solo está disponible dentro de Electron.');
  }

  /**
   * Desencripta una cadena en Base64 previamente encriptada con safeStorage.
   */
  public async decryptString(encryptedBase64: string): Promise<string> {
    if (typeof window !== 'undefined' && window.safeStorage) {
      return window.safeStorage.decryptString(encryptedBase64);
    }
    throw new Error('safeStorage solo está disponible dentro de Electron.');
  }
}
