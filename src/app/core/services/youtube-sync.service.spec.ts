import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YoutubeSyncService } from './youtube-sync.service';
import type { YoutubeSyncResult, YoutubeSyncState } from '../../../electron';

describe('YoutubeSyncService', () => {
  let service: YoutubeSyncService;
  const originalElectronAPI = window.electronAPI;

  const mockRemoteState: YoutubeSyncState = {
    playlistId: 'PL_PULSO_123',
    playlistTitle: 'Pulso - Favoritos',
    playlistDescription: 'Mis canciones favoritas sincronizadas desde Pulso',
    privacyStatus: 'PRIVATE',
    autoSync: true,
    lastSyncedAt: 1700000000000,
    syncedVideoIds: ['vid1', 'vid2'],
  };

  beforeEach(() => {
    window.electronAPI = {
      loginWithGoogle: vi.fn(),
      getYoutubeSyncState: vi.fn().mockResolvedValue(mockRemoteState),
      updateYoutubeSyncConfig: vi.fn().mockImplementation(async (patch) => ({
        ...mockRemoteState,
        ...patch,
      })),
      syncPlaylistToYoutube: vi.fn().mockResolvedValue({
        success: true,
        playlistId: 'PL_PULSO_123',
        addedCount: 1,
        totalSynced: 3,
        lastSyncedAt: 1700000050000,
        playlistUrl: 'https://music.youtube.com/playlist?list=PL_PULSO_123',
      } satisfies YoutubeSyncResult),
      unlinkYoutubeSyncPlaylist: vi.fn().mockResolvedValue({
        ...mockRemoteState,
        playlistId: null,
        lastSyncedAt: null,
        syncedVideoIds: [],
      } satisfies YoutubeSyncState),
    };

    TestBed.configureTestingModule({
      providers: [YoutubeSyncService],
    });
    service = TestBed.inject(YoutubeSyncService);
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  it('loads persisted state from electronAPI on init', async () => {
    await service.loadState();
    expect(service.$playlistId()).toBe('PL_PULSO_123');
    expect(service.$autoSync()).toBe(true);
    expect(service.$syncedCount()).toBe(2);
  });

  it('updates config and syncs state with electronAPI', async () => {
    await service.loadState();
    const updated = await service.updateConfig({
      playlistTitle: 'Mi Lista Pulso',
      privacyStatus: 'UNLISTED',
    });

    expect(window.electronAPI?.updateYoutubeSyncConfig).toHaveBeenCalledWith({
      playlistTitle: 'Mi Lista Pulso',
      privacyStatus: 'UNLISTED',
    });
    expect(updated.playlistTitle).toBe('Mi Lista Pulso');
    expect(updated.privacyStatus).toBe('UNLISTED');
  });

  it('synchronizes videoIds to YouTube Music via electronAPI', async () => {
    await service.loadState();
    const result = await service.syncPlaylist(['vid1', 'vid2', 'vid3']);

    expect(window.electronAPI?.syncPlaylistToYoutube).toHaveBeenCalledWith({
      videoIds: ['vid1', 'vid2', 'vid3'],
      title: 'Pulso - Favoritos',
      description: 'Mis canciones favoritas sincronizadas desde Pulso',
      privacyStatus: 'PRIVATE',
      forceNewPlaylist: false,
    });
    expect(result.success).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(service.$lastResult()?.success).toBe(true);
  });

  it('unlinks the playlist when unlinkPlaylist is called', async () => {
    await service.loadState();
    const state = await service.unlinkPlaylist();
    expect(window.electronAPI?.unlinkYoutubeSyncPlaylist).toHaveBeenCalled();
    expect(state.playlistId).toBeNull();
    expect(state.syncedVideoIds).toEqual([]);
  });

  it('triggers background sync when syncTrackIfAutoEnabled is called for a new track', async () => {
    await service.loadState();
    const syncSpy = vi.spyOn(service, 'syncPlaylist');

    service.syncTrackIfAutoEnabled('vid3');
    expect(syncSpy).toHaveBeenCalledWith(['vid3']);

    // Already synced track should be skipped
    syncSpy.mockClear();
    service.syncTrackIfAutoEnabled('vid1');
    expect(syncSpy).not.toHaveBeenCalled();
  });
});

