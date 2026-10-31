import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { PlaybackService } from './playback.service';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

/** `setSinkId` is Chromium-only, and Electron can still refuse it. */
function isSetSinkIdAvailable(): boolean {
  return (
    typeof HTMLMediaElement !== 'undefined' &&
    typeof HTMLMediaElement.prototype.setSinkId === 'function'
  );
}

/**
 * Audio output device picker, best effort.
 *
 * `setSinkId` is not universally available (no Firefox, no Safari) and even
 * where it exists it can reject with `NotAllowedError` or `SecurityError`. When
 * that happens the feature is disabled instead of leaving a control that
 * silently does nothing.
 */
@Service()
export class AudioOutputService {
  private readonly _playback = inject(PlaybackService);

  private readonly _supported = isSetSinkIdAvailable();
  private readonly _devices = signal<AudioOutputDevice[]>([]);
  private readonly _currentId = signal('');

  /** False as soon as the platform rejects the API. */
  public readonly $available = signal(this._supported);
  public readonly $deviceId = this._currentId.asReadonly();
  public readonly $devices = this._devices.asReadonly();

  /** Only worth rendering with more than one output to choose from. */
  public readonly $hasChoices = computed(() => this._devices().length > 1);

  public constructor() {
    if (!this._supported) return;

    void this.refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', this._onDeviceChange);
    inject(DestroyRef).onDestroy(() =>
      navigator.mediaDevices?.removeEventListener?.('devicechange', this._onDeviceChange),
    );
  }

  public async refresh(): Promise<void> {
    if (!this._supported) return;

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) {
      this._disable();
      return;
    }

    try {
      const all = await mediaDevices.enumerateDevices();
      const outputs = all
        .filter((device) => device.kind === 'audiooutput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          // Until a permission is granted the labels are empty strings.
          label: device.label || `Dispositivo ${index + 1}`,
        }));

      this._devices.set(outputs);
    } catch {
      this._disable();
      return;
    }

    if (this._devices().length === 0) {
      this._disable();
    }
  }

  /** @param deviceId empty string means "system default". */
  public async select(deviceId: string): Promise<void> {
    if (!this.$available()) return;

    try {
      await this._playback.element().setSinkId(deviceId);
      this._currentId.set(deviceId);
    } catch (error) {
      // `NotAllowedError` and `SecurityError` are the documented refusals.
      this._disable();
      console.warn('No se pudo cambiar el dispositivo de salida:', error);
    }
  }

  private _disable(): void {
    this.$available.set(false);
    this._devices.set([]);
  }

  private readonly _onDeviceChange = async (): Promise<void> => {
    const previousIds = new Set(this._devices().map((d) => d.deviceId));
    await this.refresh();

    if (previousIds.size === 0 || !this.$available()) return;

    const currentIds = new Set(this._devices().map((d) => d.deviceId));
    const deviceRemoved = [...previousIds].some((id) => !currentIds.has(id));

    if (deviceRemoved) {
      // When Bluetooth headphones (e.g. Sony WH-1000XM5 or AirPods Max) are
      // turned off, placed in their case, or disconnected, pause automatically
      // so audio does not suddenly blast out of the built-in speakers.
      if (this._playback.$isPlaying()) {
        this._playback.pause();
      }
      const selectedId = this._currentId();
      if (selectedId && !currentIds.has(selectedId)) {
        await this.select('');
      }
    }
  };
}
