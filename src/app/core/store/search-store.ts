import { Service, signal } from '@angular/core';
import { IListSearch } from '../models/youtube';

/**
 * Estado del último resultado de búsqueda.
 *
 * Antes viajaba por la clave `'search'` de `GlobalStorage`, un
 * `Record<string, any>` sin tipar. El resultado no cabe en la URL (son cientos de
 * KB), así que necesita un store propio, pero tipado.
 */
@Service()
export class SearchStore {
  private readonly _result = signal<IListSearch | null>(null);

  /** Último resultado, o `null` si no se ha buscado o se ha limpiado. */
  public readonly result = this._result.asReadonly();

  public set(result: IListSearch): void {
    this._result.set(result);
  }

  public clear(): void {
    this._result.set(null);
  }
}
