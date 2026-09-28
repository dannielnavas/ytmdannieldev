/**
 * Entrada de una canción en la cola.
 *
 * `id` es único **por entrada**, no por contenido: la cola puede contener dos
 * veces la misma canción (mismo `videoId`) y cada copia necesita identidad
 * propia para poder ser reordenada, quitada o identificada por `track` en un
 * `@for` sin que Angular lance un error de clave duplicada.
 */
export interface QueueItem {
  id: string;
  videoId: string;
  name: string;
  artist?: string;
  /** Normalizado a segundos en `PlaybackService.toQueueItems()`. */
  duration?: number;
  thumbnail?: string;
}

/**
 * Forma que puede llegar desde disco.
 *
 * Una cola persistida por una versión anterior puede traer `duration` como
 * `"3:45"`, y `/youtube/dashboard` lo envía así en algunos ítems. Por eso la
 * entrada sin normalizar acepta el string y la conversión vive en
 * `parseDuration()`.
 */
export type PersistedQueueItem = Omit<Partial<QueueItem>, 'duration'> & {
  duration?: number | string;
};
