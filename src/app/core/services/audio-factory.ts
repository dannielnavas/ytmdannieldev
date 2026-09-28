import { InjectionToken, inject } from '@angular/core';

/**
 * Fábrica del elemento `<audio>`.
 *
 * Existe para que el `PlaybackService` no construya el elemento con `new
 * Audio()` en su propio código: los tests inyectan un doble y así pueden
 * verificar reproducción, seek, errores y `setSinkId` sin navegador.
 */
export const AUDIO_FACTORY = new InjectionToken<() => HTMLAudioElement>('AUDIO_FACTORY', {
  providedIn: 'root',
  factory: () => () => new Audio(),
});

export function createAudioElement(): HTMLAudioElement {
  return inject(AUDIO_FACTORY)();
}
