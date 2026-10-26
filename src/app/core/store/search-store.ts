import { Service, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { IListSearch } from '../models/youtube';
import { Dashboard } from '../services/dashboard/dashboard';

/**
 * Estado del último resultado de búsqueda y consulta activa.
 *
 * Centraliza la ejecución de búsquedas hacia YouTube Music, gestionando
 * el término de consulta, el estado de carga y el resultado tipado.
 */
@Service()
export class SearchStore {
  private readonly _dashboard = inject(Dashboard);

  private readonly _result = signal<IListSearch | null>(null);
  private readonly _currentQuery = signal<string>('');
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  /** Último resultado, o `null` si no se ha buscado o se ha limpiado. */
  public readonly result = this._result.asReadonly();
  /** Término de búsqueda actualmente consultado o en curso. */
  public readonly currentQuery = this._currentQuery.asReadonly();
  /** Indica si hay una petición de búsqueda en curso. */
  public readonly isLoading = this._isLoading.asReadonly();
  /** Mensaje de error si la búsqueda falla. */
  public readonly error = this._error.asReadonly();

  public set(result: IListSearch, query = ''): void {
    this._result.set(result);
    if (query) {
      this._currentQuery.set(query);
    }
    this._isLoading.set(false);
    this._error.set(null);
  }

  public clear(): void {
    this._result.set(null);
    this._currentQuery.set('');
    this._isLoading.set(false);
    this._error.set(null);
  }

  /**
   * Ejecuta la consulta de búsqueda hacia el backend y actualiza reactivamente el store.
   */
  public search(query: string): Observable<IListSearch | null> {
    const trimmed = query?.trim() ?? '';
    if (!trimmed) {
      this.clear();
      return of(null);
    }

    this._currentQuery.set(trimmed);
    this._isLoading.set(true);
    this._error.set(null);

    return this._dashboard.searchSongs(trimmed).pipe(
      tap({
        next: (res) => {
          this._result.set(res);
          this._isLoading.set(false);
        },
        error: (err) => {
          this._error.set(err?.message || 'Error al realizar la búsqueda');
          this._isLoading.set(false);
        },
      }),
    );
  }
}
