import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AudioOutputService } from './audio-output.service';
import { PlaybackService } from './playback.service';
import { AUDIO_FACTORY } from './audio-factory';
import { FakeAudioElement, createFakeAudioFactory } from '../testing/fake-audio-element';

type MediaDevice = { kind: string; deviceId: string; label: string };

function setSinkIdSupport(enabled: boolean): void {
  const proto = HTMLMediaElement.prototype as unknown as Record<string, unknown>;
  if (enabled) {
    proto['setSinkId'] = function setSinkId(): Promise<void> {
      return Promise.resolve();
    };
  } else {
    delete proto['setSinkId'];
  }
}

/** jsdom has no `navigator.mediaDevices` at all. */
function mockMediaDevices(): Record<string, unknown> {
  const nav = navigator as unknown as Record<string, unknown>;
  if (!nav['mediaDevices']) {
    nav['mediaDevices'] = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  }
  return nav['mediaDevices'] as Record<string, unknown>;
}

function mockDevices(devices: MediaDevice[] | 'unsupported' | 'throws'): void {
  const media = mockMediaDevices();
  if (devices === 'unsupported') {
    delete media['enumerateDevices'];
    return;
  }
  media['enumerateDevices'] =
    devices === 'throws'
      ? () => Promise.reject(new Error('denegado'))
      : () => Promise.resolve(devices);
}

// `AudioOutputService` injects the real `PlaybackService`: the point of the test
// is that the selection reaches the element the service owns.
describe('AudioOutputService', () => {
  let audio: FakeAudioElement;

  beforeEach(() => {
    const factory = createFakeAudioFactory();
    audio = factory();

    TestBed.configureTestingModule({
      providers: [
        AudioOutputService,
        PlaybackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_FACTORY, useValue: factory },
      ],
    });
  });

  afterEach(() => {
    setSinkIdSupport(false);
    vi.restoreAllMocks();
  });

  it('is unavailable when the platform has no setSinkId', () => {
    setSinkIdSupport(false);
    mockDevices([{ kind: 'audiooutput', deviceId: 'a', label: 'Altavoces' }]);

    const service = TestBed.inject(AudioOutputService);

    expect(service.$available()).toBe(false);
    expect(service.$hasChoices()).toBe(false);
  });

  it('lists the outputs and hides the picker with a single device', async () => {
    setSinkIdSupport(true);
    mockDevices([{ kind: 'audiooutput', deviceId: 'a', label: 'Altavoces' }]);

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();

    expect(service.$available()).toBe(true);
    expect(service.$hasChoices()).toBe(false);
    expect(service.$devices()).toEqual([{ deviceId: 'a', label: 'Altavoces' }]);
  });

  it('ignores devices that are not audio outputs', async () => {
    setSinkIdSupport(true);
    mockDevices([
      { kind: 'audioinput', deviceId: 'mic', label: 'Micrófono' },
      { kind: 'audiooutput', deviceId: 'a', label: 'Altavoces' },
      { kind: 'audiooutput', deviceId: 'b', label: 'Auriculares' },
    ]);

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();

    expect(service.$devices().map((device) => device.deviceId)).toEqual(['a', 'b']);
    expect(service.$hasChoices()).toBe(true);
  });

  it('names devices that come without a label', async () => {
    setSinkIdSupport(true);
    mockDevices([
      { kind: 'audiooutput', deviceId: 'a', label: '' },
      { kind: 'audiooutput', deviceId: 'b', label: '' },
    ]);

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();

    expect(service.$devices()[0].label).toBe('Dispositivo 1');
    expect(service.$devices()[1].label).toBe('Dispositivo 2');
  });

  it('applies the selection to the element', async () => {
    setSinkIdSupport(true);
    mockDevices([
      { kind: 'audiooutput', deviceId: 'a', label: 'Altavoces' },
      { kind: 'audiooutput', deviceId: 'b', label: 'Auriculares' },
    ]);

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();
    await service.select('b');

    expect(audio.setSinkIdCalls).toEqual(['b']);
    expect(audio.sinkIdValue).toBe('b');
    expect(service.$deviceId()).toBe('b');
  });

  it('disables the picker when the platform refuses', async () => {
    setSinkIdSupport(true);
    mockDevices([
      { kind: 'audiooutput', deviceId: 'a', label: 'Altavoces' },
      { kind: 'audiooutput', deviceId: 'b', label: 'Auriculares' },
    ]);
    audio.setSinkIdError = 'NotAllowedError';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();
    await service.select('b');

    expect(service.$available()).toBe(false);
    expect(service.$hasChoices()).toBe(false);
    expect(service.$deviceId()).toBe('');
  });

  it('disables itself when the device list cannot be read', async () => {
    setSinkIdSupport(true);
    mockDevices('throws');

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();

    expect(service.$available()).toBe(false);
  });

  it('disables itself when there is no output at all', async () => {
    setSinkIdSupport(true);
    mockDevices([{ kind: 'audioinput', deviceId: 'mic', label: 'Micrófono' }]);

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();

    expect(service.$available()).toBe(false);
  });

  it('disables itself when enumeration is not implemented', async () => {
    setSinkIdSupport(true);
    mockDevices('unsupported');

    const service = TestBed.inject(AudioOutputService);
    await service.refresh();

    expect(service.$available()).toBe(false);
  });

  it('ignores a selection once disabled', async () => {
    setSinkIdSupport(false);
    mockDevices([{ kind: 'audiooutput', deviceId: 'a', label: 'Altavoces' }]);

    const service = TestBed.inject(AudioOutputService);
    await service.select('a');

    expect(audio.setSinkIdCalls).toEqual([]);
  });
});
