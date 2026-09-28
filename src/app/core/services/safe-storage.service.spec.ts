import { TestBed } from '@angular/core/testing';
import { SafeStorageService } from './safe-storage.service';
import type { SafeStorageAPI } from '../../../electron';

describe('SafeStorageService', () => {
  let service: SafeStorageService;
  let bridge: {
    isAvailable: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    getItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };

  function setBridge(value: Partial<SafeStorageAPI> | undefined): void {
    Object.defineProperty(window, 'safeStorage', {
      value,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    bridge = {
      isAvailable: vi.fn().mockResolvedValue(true),
      setItem: vi.fn().mockResolvedValue(true),
      getItem: vi.fn().mockReturnValue('value'),
      removeItem: vi.fn().mockResolvedValue(true),
    };
    setBridge(bridge as unknown as SafeStorageAPI);

    TestBed.configureTestingModule({ providers: [SafeStorageService] });
    service = TestBed.inject(SafeStorageService);
  });

  afterEach(() => setBridge(undefined));

  describe('inside Electron', () => {
    it('reports availability from the bridge', async () => {
      await expect(service.isAvailable()).resolves.toBe(true);
    });

    it('reports unavailable when the bridge throws', async () => {
      bridge.isAvailable.mockRejectedValue(new Error('keychain locked'));
      await expect(service.isAvailable()).resolves.toBe(false);
    });

    it('delegates setItem to the bridge', async () => {
      await expect(service.setItem('k', 'v')).resolves.toBe(true);
      expect(bridge.setItem).toHaveBeenCalledWith('k', 'v');
    });

    it('reports false instead of throwing when the keychain refuses to write', async () => {
      bridge.setItem.mockRejectedValue(new Error('keychain locked'));
      await expect(service.setItem('k', 'v')).resolves.toBe(false);
    });

    it('delegates getItem to the bridge', () => {
      expect(service.getItem('k')).toBe('value');
      expect(bridge.getItem).toHaveBeenCalledWith('k');
    });

    it('returns null when the bridge throws', () => {
      bridge.getItem.mockImplementation(() => {
        throw new Error('boom');
      });
      expect(service.getItem('k')).toBeNull();
    });

    it('delegates removeItem to the bridge', async () => {
      await expect(service.removeItem('k')).resolves.toBe(true);
      expect(bridge.removeItem).toHaveBeenCalledWith('k');
    });
  });

  describe('outside Electron', () => {
    beforeEach(() => setBridge(undefined));

    it('reports unavailable', async () => {
      await expect(service.isAvailable()).resolves.toBe(false);
    });

    it('keeps values in memory instead of writing plaintext to localStorage', async () => {
      await service.setItem('youtube-cookies', 'super-secret-token');

      expect(service.getItem('youtube-cookies')).toBe('super-secret-token');
      expect(localStorage.getItem('youtube-cookies')).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('does not persist across service instances', async () => {
      await service.setItem('k', 'v');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [SafeStorageService] });

      expect(TestBed.inject(SafeStorageService).getItem('k')).toBeNull();
    });

    it('removes a single in-memory value', async () => {
      await service.setItem('a', '1');
      await service.setItem('b', '2');

      await service.removeItem('a');

      expect(service.getItem('a')).toBeNull();
      expect(service.getItem('b')).toBe('2');
    });

    it('never touches localStorage or sessionStorage', async () => {
      await service.setItem('k', 'v');
      await service.removeItem('k');

      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });
});
