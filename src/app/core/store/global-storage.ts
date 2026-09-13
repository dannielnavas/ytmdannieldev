import { computed, Service, signal, Signal, untracked } from '@angular/core';

@Service()
export class GlobalStorage {
  private readonly _store = signal<Map<string, Record<string, any>>>(new Map());

  /**
   * Guarda o actualiza un objeto bajo una clave string de forma reactiva e inmutable.
   */
  public setStore<T extends object>(key: string, value: T): void {
    this._store.update((currentMap) => {
      const nextMap = new Map(currentMap);
      nextMap.set(key, value);
      return nextMap;
    });
  }

  /**
   * Obtiene un Signal reactivo para la clave indicada.
   */
  public getStore<T extends object>(key: string): Signal<T | undefined> {
    return computed(() => this._store().get(key) as T | undefined);
  }

  /**
   * Obtiene el valor instantáneo (snapshot no reactivo).
   */
  public getSnapshot<T extends object>(key: string): T | undefined {
    return untracked(() => this._store().get(key) as T | undefined);
  }

  /**
   * Elimina una clave del almacenamiento.
   */
  public remove(key: string): void {
    this._store.update((currentMap) => {
      const nextMap = new Map(currentMap);
      nextMap.delete(key);
      return nextMap;
    });
  }

  /**
   * Limpia todo el almacenamiento.
   */
  public clear(): void {
    this._store.set(new Map());
  }
}
