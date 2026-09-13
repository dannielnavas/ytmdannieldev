import { computed, inject, Service, signal } from '@angular/core';
import { QueueItem, PlaybackQueue } from '../models/queue.model';
import { Dashboard } from './dashboard/dashboard';
import { GlobalStorage } from '../store/global-storage';
import { StreamResponse } from '../models/stream';

@Service()
export class PlaybackService {
  private readonly _dashboard = inject(Dashboard);
  private readonly _globalStorage = inject(GlobalStorage);

  public readonly $queue = signal<QueueItem[]>([]);
  public readonly $currentIndex = signal<number>(-1);
  public readonly $sourceTitle = signal<string>('');
  public readonly $isShuffle = signal<boolean>(false);
  public readonly $repeatMode = signal<'off' | 'all' | 'one'>('all');
  public readonly $isLoadingSong = signal<boolean>(false);

  // Guarda la lista original en caso de shuffle
  private _originalQueue: QueueItem[] = [];

  public readonly $currentTrack = computed<QueueItem | null>(() => {
    const queue = this.$queue();
    const index = this.$currentIndex();
    if (index >= 0 && index < queue.length) {
      return queue[index];
    }
    return null;
  });

  public readonly $hasNext = computed<boolean>(() => {
    const queue = this.$queue();
    const index = this.$currentIndex();
    if (queue.length === 0) return false;
    if (this.$repeatMode() === 'all') return true;
    return index < queue.length - 1;
  });

  public readonly $hasPrevious = computed<boolean>(() => {
    const queue = this.$queue();
    const index = this.$currentIndex();
    if (queue.length === 0) return false;
    if (this.$repeatMode() === 'all') return true;
    return index > 0;
  });

  /**
   * Carga una lista completa como cola y reproduce desde el índice indicado.
   */
  public playQueue(items: QueueItem[], startIndex = 0, sourceTitle?: string): void {
    if (!items || items.length === 0) return;

    this._originalQueue = [...items];
    this.$queue.set([...items]);
    this.$sourceTitle.set(sourceTitle || '');
    this.$currentIndex.set(Math.max(0, Math.min(startIndex, items.length - 1)));

    this._syncQueueStorage();
    this.playCurrent();
  }

  /**
   * Agrega o reemplaza la canción actual reproduciendo una sola canción.
   */
  public playSingle(item: QueueItem): void {
    const existingIndex = this.$queue().findIndex((q) => q.videoId === item.videoId);
    if (existingIndex !== -1) {
      this.$currentIndex.set(existingIndex);
      this.playCurrent();
      return;
    }

    const newQueue = [...this.$queue(), item];
    this._originalQueue = [...newQueue];
    this.$queue.set(newQueue);
    this.$currentIndex.set(newQueue.length - 1);
    this._syncQueueStorage();
    this.playCurrent();
  }

  /**
   * Reproduce la siguiente pista de la cola respetando modos de repetición y fin de lista.
   */
  public playNext(): void {
    const queue = this.$queue();
    if (queue.length === 0) return;

    const currentIdx = this.$currentIndex();

    if (this.$repeatMode() === 'one') {
      this.playCurrent();
      return;
    }

    if (currentIdx < queue.length - 1) {
      this.$currentIndex.set(currentIdx + 1);
      this.playCurrent();
    } else if (this.$repeatMode() === 'all') {
      this.$currentIndex.set(0);
      this.playCurrent();
    }
  }

  /**
   * Retrocede a la pista anterior o reinicia la actual si se solicita.
   */
  public playPrevious(currentTime = 0): boolean {
    const queue = this.$queue();
    if (queue.length === 0) return false;

    // Si la canción lleva más de 3 segundos, se suele reiniciar la actual
    if (currentTime > 3) {
      return false; // Indica que se debe reiniciar la posición
    }

    const currentIdx = this.$currentIndex();

    if (currentIdx > 0) {
      this.$currentIndex.set(currentIdx - 1);
      this.playCurrent();
      return true;
    } else if (this.$repeatMode() === 'all') {
      this.$currentIndex.set(queue.length - 1);
      this.playCurrent();
      return true;
    }

    return false;
  }

  /**
   * Salta a reproducir una posición específica de la cola.
   */
  public playIndex(index: number): void {
    const queue = this.$queue();
    if (index >= 0 && index < queue.length) {
      this.$currentIndex.set(index);
      this.playCurrent();
    }
  }

  /**
   * Alterna modo aleatorio (Shuffle).
   */
  public toggleShuffle(): void {
    const currentSong = this.$currentTrack();
    const newShuffle = !this.$isShuffle();
    this.$isShuffle.set(newShuffle);

    if (newShuffle) {
      // Mezclar cola manteniendo la canción actual en primera posición
      const remaining = this._originalQueue.filter((s) => s.videoId !== currentSong?.videoId);
      const shuffled = this._shuffleArray(remaining);
      const newQueue = currentSong ? [currentSong, ...shuffled] : shuffled;
      this.$queue.set(newQueue);
      this.$currentIndex.set(currentSong ? 0 : -1);
    } else {
      // Restaurar orden original
      this.$queue.set([...this._originalQueue]);
      if (currentSong) {
        const originalIndex = this._originalQueue.findIndex((s) => s.videoId === currentSong.videoId);
        this.$currentIndex.set(originalIndex !== -1 ? originalIndex : 0);
      }
    }
    this._syncQueueStorage();
  }

  /**
   * Alterna modo de repetición: 'off' -> 'all' -> 'one' -> 'off'.
   */
  public toggleRepeat(): void {
    const current = this.$repeatMode();
    const nextMode = current === 'off' ? 'all' : current === 'all' ? 'one' : 'off';
    this.$repeatMode.set(nextMode);
  }

  /**
   * Invocado cuando el audio actual finaliza.
   */
  public onTrackEnded(): void {
    this.playNext();
  }

  /**
   * Realiza la actualización de la canción seleccionada en el store global sin llamadas de red innecesarias.
   */
  public playCurrent(): void {
    const current = this.$currentTrack();
    if (!current?.videoId) return;

    this._syncQueueStorage();

    this._globalStorage.setStore('song', {
      videoId: current.videoId,
      streamUrl: this._dashboard.getStreamUrl(current.videoId),
    });
    this.$isLoadingSong.set(false);
  }

  private _syncQueueStorage(): void {
    this._globalStorage.setStore<PlaybackQueue>('queue', {
      items: this.$queue(),
      currentIndex: this.$currentIndex(),
      sourceTitle: this.$sourceTitle(),
    });
  }

  private _shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
