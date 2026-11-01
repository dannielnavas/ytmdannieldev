import { Service, computed, signal } from '@angular/core';
import type {
  YoutubePlaylistPrivacy,
  YoutubeSyncConfigPatch,
  YoutubeSyncRequest,
  YoutubeSyncResult,
  YoutubeSyncState,
} from '../../../electron';

const DEFAULT_SYNC_STATE: YoutubeSyncState = {
  playlistId: null,
  playlistTitle: 'Pulso - Favoritos',
  playlistDescription: 'Mis canciones favoritas sincronizadas desde Pulso',
  privacyStatus: 'PRIVATE',
  autoSync: false,
  lastSyncedAt: null,
  syncedVideoIds: [],
};

@Service()
export class YoutubeSyncService {
  private readonly _state = signal<YoutubeSyncState>({ ...DEFAULT_SYNC_STATE });
  private readonly _isSyncing = signal<boolean>(false);
  private readonly _lastResult = signal<YoutubeSyncResult | null>(null);

  public readonly $state = this._state.asReadonly();
  public readonly $isSyncing = this._isSyncing.asReadonly();
  public readonly $lastResult = this._lastResult.asReadonly();

  public readonly $playlistId = computed(() => this._state().playlistId);
  public readonly $playlistTitle = computed(() => this._state().playlistTitle);
  public readonly $privacyStatus = computed(() => this._state().privacyStatus);
  public readonly $autoSync = computed(() => this._state().autoSync);
  public readonly $lastSyncedAt = computed(() => this._state().lastSyncedAt);
  public readonly $syncedIdsSet = computed(() => new Set(this._state().syncedVideoIds));
  public readonly $syncedCount = computed(() => this._state().syncedVideoIds.length);

  constructor() {
    void this.loadState();
  }

  public isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.electronAPI?.syncPlaylistToYoutube === 'function'
    );
  }

  public async loadState(): Promise<YoutubeSyncState> {
    if (typeof window === 'undefined' || !window.electronAPI?.getYoutubeSyncState) {
      return this._state();
    }
    try {
      const remoteState = await window.electronAPI.getYoutubeSyncState();
      if (remoteState && typeof remoteState === 'object') {
        this._state.set({
          ...DEFAULT_SYNC_STATE,
          ...remoteState,
          syncedVideoIds: Array.isArray(remoteState.syncedVideoIds)
            ? remoteState.syncedVideoIds
            : [],
        });
      }
    } catch (err) {
      console.warn('[YoutubeSyncService] No se pudo cargar el estado de sincronización:', err);
    }
    return this._state();
  }

  public async updateConfig(patch: YoutubeSyncConfigPatch): Promise<YoutubeSyncState> {
    const optimistic: YoutubeSyncState = {
      ...this._state(),
      ...(patch.playlistTitle !== undefined ? { playlistTitle: patch.playlistTitle } : {}),
      ...(patch.playlistDescription !== undefined
        ? { playlistDescription: patch.playlistDescription }
        : {}),
      ...(patch.privacyStatus !== undefined ? { privacyStatus: patch.privacyStatus } : {}),
      ...(patch.autoSync !== undefined ? { autoSync: patch.autoSync } : {}),
      ...(patch.playlistId !== undefined ? { playlistId: patch.playlistId } : {}),
    };
    this._state.set(optimistic);

    if (typeof window !== 'undefined' && window.electronAPI?.updateYoutubeSyncConfig) {
      try {
        const saved = await window.electronAPI.updateYoutubeSyncConfig(patch);
        if (saved && typeof saved === 'object') {
          this._state.set({
            ...DEFAULT_SYNC_STATE,
            ...saved,
            syncedVideoIds: Array.isArray(saved.syncedVideoIds) ? saved.syncedVideoIds : [],
          });
        }
      } catch (err) {
        console.warn('[YoutubeSyncService] Error guardando configuración de sincronización:', err);
      }
    }
    return this._state();
  }

  public async unlinkPlaylist(): Promise<YoutubeSyncState> {
    this._lastResult.set(null);
    if (typeof window !== 'undefined' && window.electronAPI?.unlinkYoutubeSyncPlaylist) {
      try {
        const resetState = await window.electronAPI.unlinkYoutubeSyncPlaylist();
        if (resetState) {
          this._state.set({
            ...DEFAULT_SYNC_STATE,
            ...resetState,
            syncedVideoIds: [],
          });
          return this._state();
        }
      } catch (err) {
        console.warn('[YoutubeSyncService] Error desvinculando playlist:', err);
      }
    }

    this._state.update((curr) => ({
      ...curr,
      playlistId: null,
      lastSyncedAt: null,
      syncedVideoIds: [],
    }));
    return this._state();
  }

  public async syncPlaylist(
    videoIds: string[],
    options?: {
      title?: string;
      description?: string;
      privacyStatus?: YoutubePlaylistPrivacy;
      forceNewPlaylist?: boolean;
    },
  ): Promise<YoutubeSyncResult> {
    if (this._isSyncing()) {
      return {
        success: false,
        playlistId: this._state().playlistId,
        addedCount: 0,
        totalSynced: this._state().syncedVideoIds.length,
        lastSyncedAt: this._state().lastSyncedAt,
        error: 'Ya hay una sincronización en curso.',
      };
    }

    if (!this.isAvailable()) {
      const unavailableResult: YoutubeSyncResult = {
        success: false,
        playlistId: null,
        addedCount: 0,
        totalSynced: 0,
        lastSyncedAt: null,
        error: 'La sincronización directa con YouTube solo está disponible en la app de escritorio.',
      };
      this._lastResult.set(unavailableResult);
      return unavailableResult;
    }

    const cleanIds = Array.from(
      new Set(
        (videoIds || [])
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id) => id.length > 0),
      ),
    );

    if (cleanIds.length === 0) {
      const emptyResult: YoutubeSyncResult = {
        success: false,
        playlistId: this._state().playlistId,
        addedCount: 0,
        totalSynced: this._state().syncedVideoIds.length,
        lastSyncedAt: this._state().lastSyncedAt,
        error: 'No tienes canciones en Tus Me Gusta para sincronizar.',
      };
      this._lastResult.set(emptyResult);
      return emptyResult;
    }

    this._isSyncing.set(true);
    this._lastResult.set(null);

    try {
      const request: YoutubeSyncRequest = {
        videoIds: cleanIds,
        title: options?.title ?? this._state().playlistTitle,
        description: options?.description ?? this._state().playlistDescription,
        privacyStatus: options?.privacyStatus ?? this._state().privacyStatus,
        forceNewPlaylist: options?.forceNewPlaylist ?? false,
      };

      const result = await window.electronAPI!.syncPlaylistToYoutube!(request);
      this._lastResult.set(result);

      if (result.success) {
        await this.loadState();
      }
      return result;
    } catch (err: any) {
      const failedResult: YoutubeSyncResult = {
        success: false,
        playlistId: this._state().playlistId,
        addedCount: 0,
        totalSynced: this._state().syncedVideoIds.length,
        lastSyncedAt: this._state().lastSyncedAt,
        error: err?.message || 'Error inesperado al sincronizar con YouTube Music.',
      };
      this._lastResult.set(failedResult);
      return failedResult;
    } finally {
      this._isSyncing.set(false);
    }
  }

  public clearLastResult(): void {
    this._lastResult.set(null);
  }

  /**
   * Si la sincronización automática está activa, envía una canción recién añadida
   * a la playlist vinculada en YouTube Music sin bloquear la interfaz.
   */
  public syncTrackIfAutoEnabled(videoId: string): void {
    if (!videoId || !this.$autoSync() || !this.isAvailable() || this._isSyncing()) {
      return;
    }
    if (this.$syncedIdsSet().has(videoId)) {
      return;
    }
    void this.syncPlaylist([videoId]);
  }
}

