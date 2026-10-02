import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideHeart } from '@lucide/angular';
import { LikesService } from '../../../core/services/likes.service';

/**
 * Botón interactivo de corazón para dar like / guardar canciones en favoritos.
 *
 * Sigue fielmente la estética de Sonara:
 * - Outline neutral y hover en escala cuando no está marcado.
 * - Relleno vibrante en color rosa/rose con brillo (glow) y animación de 'pop' al marcarlo.
 * - Modo `autoHide` para listas/filas: oculto por defecto, visible al hacer hover sobre la fila o si ya tiene like.
 * - Accesible con `aria-pressed`, `aria-label`, foco y teclado (Enter/Espacio).
 */
@Component({
  imports: [LucideHeart],
  selector: 'app-like-button',
  templateUrl: './like-button.html',
  styleUrl: './like-button.css',
})
export class LikeButton {
  private readonly _likesService = inject(LikesService);

  /** Objeto de canción (SourceSong, QueueItem, LikedSong o similar). */
  public readonly song = input<any>(null);

  /** ID del video de YouTube en caso de pasarlo directamente. */
  public readonly videoId = input<string | null>(null);

  /** Nombre o título opcional para accesibilidad si no viene en `song`. */
  public readonly name = input<string | null>(null);

  /** Artista opcional si no viene en `song`. */
  public readonly artist = input<string | null>(null);

  /** Tamaño visual del botón: xs (3.5), sm (4), md (5), lg (6). */
  public readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('md');

  /**
   * Si es true, el botón se oculta cuando no tiene like hasta que
   * el elemento contenedor (.group) reciba hover o foco.
   * Ideal para filas de canciones en listas y álbumes.
   */
  public readonly autoHide = input(false);

  /** Notifica a componentes padres cuando el estado de like cambia. */
  public readonly likedChange = output<boolean>();

  /** Estado de animación tras click. */
  public readonly isAnimating = signal(false);

  /** ID efectivo de la canción. */
  public readonly effectiveVideoId = computed(() => {
    return this.videoId() || this.song()?.videoId || '';
  });

  /** Indica si la canción actual tiene like. */
  public readonly isLiked = computed(() => {
    const id = this.effectiveVideoId();
    return !!id && this._likesService.isLiked(id);
  });

  public readonly buttonAriaLabel = computed(() => {
    const title = this.song()?.name || this.song()?.title || this.name() || 'canción';
    return this.isLiked() ? `Quitar ${title} de tus me gusta` : `Guardar ${title} en tus me gusta`;
  });

  public readonly buttonTitle = computed(() => {
    return this.isLiked() ? 'Quitar de tus me gusta' : 'Guardar en tus me gusta';
  });

  public onToggle(event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    const id = this.effectiveVideoId();
    if (!id) return;

    const target = this.song() || {
      videoId: id,
      name: this.name() || '',
      artist: this.artist() || '',
    };

    const nextState = this._likesService.toggleLike(target);

    if (nextState) {
      this.isAnimating.set(true);
      setTimeout(() => this.isAnimating.set(false), 450);
    }

    this.likedChange.emit(nextState);
  }
}
