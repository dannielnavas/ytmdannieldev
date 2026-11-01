import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  session,
  safeStorage,
  screen,
  Tray,
  Menu,
  globalShortcut,
  powerMonitor,
  powerSaveBlocker,
  Notification,
  nativeTheme,
  systemPreferences,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type {
  LoginItemConfig,
  MediaControlAction,
  OSPlaybackState,
  OSThemeInfo,
  OSTrackNotification,
} from './preload';

app.setName('Pulso');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.pulso.app');
}

// Registrar protocolo personalizado pulso:// para Deep Linking con el SO
const PROTOCOL_SCHEME = 'pulso';
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

function extractDeepLinkFromArgv(argv: string[]): string | null {
  const match = argv.find(
    (arg) => typeof arg === 'string' && arg.toLowerCase().startsWith(`${PROTOCOL_SCHEME}://`),
  );
  return match ?? null;
}

let pendingDeepLink: string | null = extractDeepLinkFromArgv(process.argv);

function dispatchDeepLink(url: string): void {
  if (!url || !url.toLowerCase().startsWith(`${PROTOCOL_SCHEME}://`)) return;

  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('os:deep-link', url);
    pendingDeepLink = null;
  } else {
    pendingDeepLink = url;
  }
}

// Asegurar instancia única
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
    const deepLink = extractDeepLinkFromArgv(commandLine);
    if (deepLink) {
      dispatchDeepLink(deepLink);
    }
  });
}

// macOS: manejar enlaces pulso:// abiertos desde Finder / navegador
app.on('open-url', (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

// Optimización de caché de red de Chromium para imágenes y multimedia
app.commandLine.appendSwitch('disk-cache-size', '1073741824'); // 1 GB de caché en disco
app.commandLine.appendSwitch('media-cache-size', '536870912'); // 512 MB de caché multimedia
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Habilita el soporte nativo de gestos AVRCP Bluetooth (Sony WH-1000XM5, AirPods Max)
// y teclas multimedia del sistema (macOS MPNowPlayingInfoCenter, Windows SMTC, Linux MPRIS).
app.commandLine.appendSwitch(
  'enable-features',
  'HardwareMediaKeyHandling,MediaSessionService',
);

let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

let isMiniPlayer = false;
let normalBounds = { width: 1280, height: 720, x: 0, y: 0 };
let miniPlayerPosition: { x: number; y: number } | null = null;
let wasMaximized = false;
let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null;
let powerSaveBlockerId: number | null = null;

let currentOSPlaybackState: OSPlaybackState = {
  track: null,
  isPlaying: false,
  isLiked: false,
  progress: -1,
};

interface PersistedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
  miniPlayerX?: number;
  miniPlayerY?: number;
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function isBoundsVisibleOnAnyDisplay(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  try {
    const displays = screen.getAllDisplays();
    return displays.some((display) => {
      const wa = display.workArea;
      return (
        bounds.x + bounds.width > wa.x + 40 &&
        bounds.x < wa.x + wa.width - 40 &&
        bounds.y + bounds.height > wa.y + 40 &&
        bounds.y < wa.y + wa.height - 40
      );
    });
  } catch {
    return true;
  }
}

function loadWindowState(): PersistedWindowState {
  const fallback: PersistedWindowState = { width: 1280, height: 720, isMaximized: false };
  try {
    const filePath = getWindowStatePath();
    if (!fs.existsSync(filePath)) return fallback;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<PersistedWindowState>;
    const width =
      typeof raw.width === 'number' && raw.width >= 800 ? Math.round(raw.width) : fallback.width;
    const height =
      typeof raw.height === 'number' && raw.height >= 500
        ? Math.round(raw.height)
        : fallback.height;

    const state: PersistedWindowState = {
      width,
      height,
      isMaximized: Boolean(raw.isMaximized),
    };

    if (typeof raw.x === 'number' && typeof raw.y === 'number') {
      const candidate = { x: Math.round(raw.x), y: Math.round(raw.y), width, height };
      if (isBoundsVisibleOnAnyDisplay(candidate)) {
        state.x = candidate.x;
        state.y = candidate.y;
      }
    }

    if (typeof raw.miniPlayerX === 'number' && typeof raw.miniPlayerY === 'number') {
      const miniCandidate = {
        x: Math.round(raw.miniPlayerX),
        y: Math.round(raw.miniPlayerY),
        width: 390,
        height: 175,
      };
      if (isBoundsVisibleOnAnyDisplay(miniCandidate)) {
        state.miniPlayerX = miniCandidate.x;
        state.miniPlayerY = miniCandidate.y;
        miniPlayerPosition = { x: miniCandidate.x, y: miniCandidate.y };
      }
    }

    return state;
  } catch {
    return fallback;
  }
}

function saveWindowStateImmediate(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    if (!isMiniPlayer && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      normalBounds = mainWindow.getBounds();
    } else if (isMiniPlayer && !mainWindow.isMinimized()) {
      const b = mainWindow.getBounds();
      miniPlayerPosition = { x: b.x, y: b.y };
    }

    const payload: PersistedWindowState = {
      width: normalBounds.width,
      height: normalBounds.height,
      x: normalBounds.x,
      y: normalBounds.y,
      isMaximized: isMiniPlayer ? wasMaximized : mainWindow.isMaximized(),
      ...(miniPlayerPosition
        ? { miniPlayerX: miniPlayerPosition.x, miniPlayerY: miniPlayerPosition.y }
        : {}),
    };

    const filePath = getWindowStatePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch {
    // No interrumpir ejecución si falla la escritura de geometría
  }
}

function scheduleSaveWindowState(): void {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
  }
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    saveWindowStateImmediate();
  }, 400);
}

function setMiniPlayerMode(win: BrowserWindow, enable: boolean): void {
  if (isMiniPlayer === enable) return;
  isMiniPlayer = enable;

  if (enable) {
    wasMaximized = win.isMaximized();
    if (wasMaximized) {
      win.unmaximize();
    }
    normalBounds = win.getBounds();
    win.setAlwaysOnTop(true, 'floating');
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    win.setMinimumSize(360, 160);
    win.setSize(390, 175);
    try {
      if (
        miniPlayerPosition &&
        isBoundsVisibleOnAnyDisplay({
          x: miniPlayerPosition.x,
          y: miniPlayerPosition.y,
          width: 390,
          height: 175,
        })
      ) {
        win.setPosition(miniPlayerPosition.x, miniPlayerPosition.y);
      } else {
        const currentDisplay = screen.getDisplayMatching(normalBounds);
        const { workArea } = currentDisplay;
        const x = Math.round(workArea.x + workArea.width - 410);
        const y = Math.round(workArea.y + workArea.height - 195);
        win.setPosition(x, y);
      }
    } catch {
      // Fallback si la detección de display falla
    }
  } else {
    const currentMiniBounds = win.getBounds();
    miniPlayerPosition = { x: currentMiniBounds.x, y: currentMiniBounds.y };
    win.setAlwaysOnTop(false);
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(false);
    }
    win.setMinimumSize(800, 500);
    win.setBounds(normalBounds);
    if (wasMaximized) {
      win.maximize();
    }
  }

  saveWindowStateImmediate();
  win.webContents.send('window-mini-player-change', isMiniPlayer);
}

function registerWindowIpcHandlers() {
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      setMiniPlayerMode(win, true);
    }
  });

  ipcMain.on('window-minimize-system', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on('window-toggle-mini-player', (event, enable?: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const target = typeof enable === 'boolean' ? enable : !isMiniPlayer;
      setMiniPlayerMode(win, target);
    }
  });

  ipcMain.handle('window-is-mini-player', () => {
    return isMiniPlayer;
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (isMiniPlayer) {
        setMiniPlayerMode(win, false);
        return;
      }
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle('window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });
}

const isPackaged = app.isPackaged; // Detecta si estamos en desarrollo o producción
const isDev = !isPackaged;

/**
 * Origen del backend. Debe coincidir con `API_BASE_URL` de
 * `src/app/core/config/api.config.ts`: es el único origen al que se le inyectan
 * cabeceras CORS para el stream de audio.
 */
const API_ORIGIN = 'https://ytmdannieldev-back.vercel.app';

/**
 * Busca el primer archivo existente dentro de una lista de rutas posibles.
 */
function findExistingPath(paths: string[]): string {
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return '';
}

/**
 * Ruta del ícono de runtime, relativa a `process.resourcesPath` dentro del paquete.
 * Cada destino de electron-builder copia exactamente un archivo a `icons/` (ver
 * `extraResources` en package.json), así que no hay que adivinar entre candidatos.
 */
const RUNTIME_ICON: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'icons/icon.icns',
  win32: 'icons/icon.ico',
  linux: 'icons/icon.png',
};

/**
 * Retorna la ruta absoluta del ícono de ventana, o '' si no está disponible.
 */
function getWindowIconPath(): string {
  const relative = RUNTIME_ICON[process.platform];
  if (!relative) {
    return '';
  }
  // En desarrollo `process.resourcesPath` apunta a los recursos del propio Electron,
  // así que se busca primero en el project dir.
  const candidates = isPackaged
    ? [path.join(process.resourcesPath, relative)]
    : [path.join(app.getAppPath(), relative), path.join(process.resourcesPath, relative)];
  return findExistingPath(candidates);
}

function sendMediaControl(action: MediaControlAction): void {
  mainWindow?.webContents.send('window-media-control', action);
}

function truncateLabel(text: string, maxLength = 38): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getLinuxAutostartFilePath(): string {
  const configHome = process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
  return path.join(configHome, 'autostart', 'pulso.desktop');
}

function getLoginItemConfig(): LoginItemConfig {
  if (process.platform === 'linux') {
    return {
      openAtLogin: fs.existsSync(getLinuxAutostartFilePath()),
      openAsHidden: true,
    };
  }
  try {
    const settings = app.getLoginItemSettings();
    return {
      openAtLogin: Boolean(settings.openAtLogin),
      openAsHidden: true,
    };
  } catch {
    return { openAtLogin: false, openAsHidden: false };
  }
}

function setLoginItemConfig(config: LoginItemConfig): LoginItemConfig {
  const openAtLogin = Boolean(config?.openAtLogin);
  const openAsHidden = config?.openAsHidden ?? true;

  if (process.platform === 'linux') {
    try {
      const desktopPath = getLinuxAutostartFilePath();
      if (openAtLogin) {
        fs.mkdirSync(path.dirname(desktopPath), { recursive: true });
        const content = [
          '[Desktop Entry]',
          'Type=Application',
          'Name=Pulso',
          'Comment=Modern YouTube Music Desktop Player',
          `Exec="${process.execPath}" --hidden`,
          'Icon=pulso',
          'Terminal=false',
          'Categories=AudioVideo;Audio;Player;',
          'X-GNOME-Autostart-enabled=true',
          '',
        ].join('\n');
        fs.writeFileSync(desktopPath, content, 'utf-8');
      } else if (fs.existsSync(desktopPath)) {
        fs.unlinkSync(desktopPath);
      }
    } catch (err) {
      console.warn('No se pudo configurar autostart en Linux:', err);
    }
  } else {
    try {
      app.setLoginItemSettings({
        openAtLogin,
        args: openAsHidden ? ['--hidden'] : [],
      });
    } catch (err) {
      console.warn('No se pudo configurar LoginItem en el SO:', err);
    }
  }

  refreshTrayMenu();
  return getLoginItemConfig();
}

function buildMacDockMenu(): Menu {
  const { track, isPlaying, isLiked } = currentOSPlaybackState;
  const headerLabel = track
    ? `♪ ${truncateLabel(track.title, 34)} — ${truncateLabel(track.artist, 26)}`
    : 'Sin reproducción activa';

  return Menu.buildFromTemplate([
    {
      label: headerLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isPlaying ? 'Pausar' : 'Reproducir',
      enabled: Boolean(track),
      click: () => sendMediaControl('toggle-play'),
    },
    {
      label: 'Siguiente pista',
      enabled: Boolean(track),
      click: () => sendMediaControl('next'),
    },
    {
      label: 'Pista anterior',
      enabled: Boolean(track),
      click: () => sendMediaControl('previous'),
    },
    { type: 'separator' },
    {
      label: isLiked ? '♥ Quitar de Me gusta' : '♡ Añadir a Me gusta',
      enabled: Boolean(track),
      click: () => sendMediaControl('toggle-like'),
    },
  ]);
}

/**
 * Configura el ícono y menú de la aplicación en el Dock de macOS en tiempo de ejecución.
 */
function setupMacDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) {
    return;
  }
  app.dock.setMenu(buildMacDockMenu());

  const dockIconPath = getWindowIconPath();
  if (!dockIconPath) {
    return;
  }
  const icon = nativeImage.createFromPath(dockIconPath);
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

function registerAuthIpcHandlers() {
  ipcMain.handle('auth:login-google', async () => {
    return new Promise<string>((resolve, reject) => {
      let isResolved = false;
      let windowShown = false;
      const iconPath = getWindowIconPath();

      authWindow = new BrowserWindow({
        title: 'Iniciar sesión con Google - Pulso',
        width: 500,
        height: 600,
        parent: mainWindow ?? undefined,
        modal: true,
        show: false,
        icon: iconPath || undefined,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL(
        'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F',
      );

      const checkLoggedInAndResolve = async () => {
        if (isResolved || !authWindow) return;

        const currentUrl = authWindow.webContents.getURL();
        if (!currentUrl.includes('music.youtube.com')) return;

        let loggedIn = false;
        try {
          // Preguntamos DIRECTAMENTE a la página ya autenticada, no con un fetch externo
          loggedIn = await authWindow.webContents.executeJavaScript(`
            (function() {
              try {
                return !!(window.ytcfg && window.ytcfg.data_ && window.ytcfg.data_.LOGGED_IN === true);
              } catch (e) {
                return false;
              }
            })();
          `);
        } catch {
          loggedIn = false;
        }

        if (loggedIn) {
          const cookies = await session.defaultSession.cookies.get({ domain: '.youtube.com' });
          const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

          if (cookieHeader.includes('SAPISID')) {
            isResolved = true;
            clearInterval(retryInterval);
            clearTimeout(fallbackTimer);
            authWindow.close();
            resolve(cookieHeader);
            return;
          }
        }

        if (!windowShown && authWindow) {
          windowShown = true;
          authWindow.show();
        }
      };

      authWindow.webContents.on('did-navigate', checkLoggedInAndResolve);
      authWindow.webContents.on('did-navigate-in-page', checkLoggedInAndResolve);
      authWindow.webContents.on('did-finish-load', checkLoggedInAndResolve);

      // El SPA de YouTube Music tarda un poco en montar `ytcfg`,
      // así que reintentamos cada 1.5s mientras estemos ahí.
      const retryInterval = setInterval(checkLoggedInAndResolve, 1500);

      const fallbackTimer = setTimeout(() => {
        if (!isResolved && !windowShown && authWindow) {
          windowShown = true;
          authWindow.show();
        }
      }, 4000);

      authWindow.on('closed', () => {
        clearInterval(retryInterval);
        clearTimeout(fallbackTimer);
        authWindow = null;
        if (!isResolved) {
          reject('Ventana de autenticación cerrada por el usuario');
        }
      });
    });
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      await session.defaultSession.clearStorageData({
        storages: ['cookies', 'localstorage'],
      });
      return true;
    } catch (err) {
      console.error('Error clearing session cookies on logout:', err);
      return false;
    }
  });
}

function registerSafeStorageIpcHandlers() {
  const getStorageFilePath = () => path.join(app.getPath('userData'), 'secure-storage.json');

  /**
   * Valida que el argumento recibido por IPC sea una clave usable.
   *
   * `ipcMain` entrega `any`: sin esta comprobación, un renderer comprometido
   * podría mandar un objeto y terminar con claves como `"__proto__"` o
   * `constructor` dentro del JSON de sesión.
   */
  function assertKey(key: unknown): asserts key is string {
    if (typeof key !== 'string' || key.length === 0 || key.length > 256) {
      throw new Error('Clave de almacenamiento inválida.');
    }
    if (!/^[\w.-]+$/.test(key)) {
      throw new Error('La clave de almacenamiento contiene caracteres no permitidos.');
    }
  }

  function assertValue(value: unknown): asserts value is string {
    if (typeof value !== 'string') {
      throw new Error('Valor de almacenamiento inválido.');
    }
  }

  const getSecureStorageData = (): Record<string, string> => {
    try {
      const filePath = getStorageFilePath();
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, string>;
        }
      }
    } catch (error) {
      console.error('Error al leer secure-storage:', error);
    }
    return {};
  };

  const saveSecureStorageData = (data: Record<string, string>): void => {
    const filePath = getStorageFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Se escribe en un temporal y se renombra: una interrupción a mitad de
    // escritura ya no puede dejar el archivo de sesión corrupto.
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    fs.renameSync(tmpPath, filePath);
  };

  ipcMain.handle('safe-storage:is-available', () => {
    return safeStorage.isEncryptionAvailable();
  });

  ipcMain.handle('safe-storage:set-item', (_event, key: unknown, value: unknown) => {
    assertKey(key);
    assertValue(value);
    if (!safeStorage.isEncryptionAvailable()) {
      return false;
    }
    const buffer = safeStorage.encryptString(value);
    const data = getSecureStorageData();
    data[key] = buffer.toString('base64');
    saveSecureStorageData(data);
    return true;
  });

  ipcMain.on('safe-storage:get-item-sync', (event, key: unknown) => {
    try {
      assertKey(key);
      const encryptedBase64 = getSecureStorageData()[key];
      if (!encryptedBase64 || !safeStorage.isEncryptionAvailable()) {
        event.returnValue = null;
        return;
      }
      event.returnValue = safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'));
    } catch (error) {
      console.error('Error al obtener item sincrónicamente:', error);
      event.returnValue = null;
    }
  });

  ipcMain.handle('safe-storage:remove-item', (_event, key: unknown) => {
    assertKey(key);
    const data = getSecureStorageData();
    if (key in data) {
      delete data[key];
      saveSecureStorageData(data);
      return true;
    }
    return false;
  });
}

/**
 * Configura la optimización de red y mitigación de errores 429 para imágenes de YouTube Music:
 * 1. Simula peticiones legítimas del cliente web de YouTube Music (Referer y Origin).
 * 2. Limpia el User-Agent para evitar bloqueos por cliente automatizado/Electron.
 * 3. Habilita cabeceras CORS para permitir análisis de color (ColorThief) y para el
 *    `HTMLAudioElement`, que carga el stream con `crossOrigin = 'anonymous'`.
 * 4. Fuerza cabeceras de caché inmutable (30 días) para que Chromium sirva las imágenes desde disco.
 */
function setupImageOptimization(): void {
  const googleFilter = {
    urls: [
      '*://*.googleusercontent.com/*',
      '*://*.ytimg.com/*',
      '*://*.ggpht.com/*',
      '*://*.youtube.com/*',
      '*://music.youtube.com/*',
    ],
  };

  // El stream de audio se carga en un `HTMLAudioElement` con
  // `crossOrigin = 'anonymous'` para poder analysed con un `AnalyserNode`.
  // El backend sirve el audio desde su propio origen, así que sin esta cabecera
  // el elemento rechaza la respuesta y no reproduce nada.
  const streamFilter = {
    urls: [`${API_ORIGIN}/*`],
  };

  // 1. Enmascarar peticiones salientes con cabeceras de cliente oficial
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [...googleFilter.urls, ...streamFilter.urls] },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };

      if (details.url.startsWith(API_ORIGIN)) {
        // En producción (empaquetado con file://), Chromium envía Origin: file:// o null.
        // El backend NestJS en producción solo acepta 'http://localhost:4200' en su lista
        // de CORS, rechazando cualquier otro origen con un error 500 ('No permitido por CORS').
        // Forzando el origen a 'http://localhost:4200', el backend siempre aceptará la petición.
        requestHeaders['Origin'] = 'http://localhost:4200';
      } else {
        requestHeaders['Referer'] = 'https://music.youtube.com/';
        requestHeaders['Origin'] = 'https://music.youtube.com';

        // Normalizar User-Agent removiendo Electron para evitar rate-limits de bot
        const userAgent = requestHeaders['User-Agent'] || requestHeaders['user-agent'];
        if (userAgent && userAgent.includes('Electron')) {
          requestHeaders['User-Agent'] = userAgent.replace(/Electron\/[0-9.]+\s?/, '');
        }
      }

      callback({ requestHeaders });
    },
  );

  // 2. Interceptar respuestas para habilitar CORS y asegurar almacenamiento en disco.
  //
  // Un solo listener para los dos filtros: Electron solo atiende el último
  // `onHeadersReceived` que se registra en la sesión, así que registrar dos
  // dejaba el primero (el de las imágenes) sin efecto.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: [...googleFilter.urls, ...streamFilter.urls] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      if (details.url.startsWith(API_ORIGIN)) {
        // El audio no debe quedar cacheado: la cola puede repetir la misma pista.
        responseHeaders['cache-control'] = ['no-store'];

        // Permitir acceso desde cualquier origen (tanto dev http://localhost:4200 como
        // producción file://). Si se usa '*', la especificación Fetch exige eliminar
        // 'access-control-allow-credentials' para evitar que Chromium bloquee la respuesta.
        responseHeaders['access-control-allow-origin'] = ['*'];
        delete responseHeaders['access-control-allow-credentials'];
        delete responseHeaders['Access-Control-Allow-Credentials'];
        responseHeaders['access-control-allow-methods'] = [
          'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        ];
        responseHeaders['access-control-allow-headers'] = ['*'];
      } else {
        // Permitir CORS para ColorThief y canvas sin restricciones
        responseHeaders['access-control-allow-origin'] = ['*'];
        responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
        responseHeaders['access-control-allow-headers'] = ['*'];

        if (details.statusCode >= 200 && details.statusCode < 300) {
          // Si la imagen cargó con éxito (2xx), forzar almacenamiento persistente
          // en caché de disco.
          responseHeaders['cache-control'] = ['public, max-age=2592000, immutable'];
        }
      }

      callback({ responseHeaders });
    },
  );
}

/**
 * La app se sirve desde el dev server o desde un `file://` empaquetado: cualquier
 * otro origen no es de nuestra app.
 */
function isAppOrigin(url: string): boolean {
  return isDev ? url.startsWith('http://localhost:4200') : url.startsWith('file://');
}

/**
 * Chromium exige el permiso `speaker-selection` para que
 * `HTMLMediaElement.setSinkId()` funcione y para que
 * `navigator.mediaDevices.enumerateDevices()` devuelva los nombres de los
 * dispositivos. Pulso solo necesita elegir la salida de audio, así que ese es el
 * único permiso concedido y todo lo demás se rechaza: sin cámara, micrófono,
 * ubicación ni notificaciones.
 */
function setupPermissions(window: BrowserWindow): void {
  const { session } = window.webContents;

  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'speaker-selection' && isAppOrigin(window.webContents.getURL()));
  });

  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === 'speaker-selection' && isAppOrigin(requestingOrigin);
  });
}

function buildTrayContextMenu(): Menu {
  const { track, isPlaying, isLiked } = currentOSPlaybackState;
  const loginConfig = getLoginItemConfig();
  const trackLabel = track
    ? `♪ ${truncateLabel(track.title, 36)} — ${truncateLabel(track.artist, 28)}`
    : 'Pulso — Sin reproducción';

  return Menu.buildFromTemplate([
    {
      label: trackLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Mostrar Pulso',
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: isMiniPlayer ? 'Salir de Mini Reproductor' : 'Alternar Mini Reproductor',
      click: () => {
        if (mainWindow) {
          setMiniPlayerMode(mainWindow, !isMiniPlayer);
        }
      },
    },
    { type: 'separator' },
    {
      label: isPlaying ? 'Pausar' : 'Reproducir',
      enabled: Boolean(track),
      click: () => sendMediaControl('toggle-play'),
    },
    {
      label: 'Siguiente pista',
      enabled: Boolean(track),
      click: () => sendMediaControl('next'),
    },
    {
      label: 'Pista anterior',
      enabled: Boolean(track),
      click: () => sendMediaControl('previous'),
    },
    {
      label: isLiked ? '♥ Quitar de Me gusta' : '♡ Añadir a Me gusta',
      enabled: Boolean(track),
      click: () => sendMediaControl('toggle-like'),
    },
    { type: 'separator' },
    {
      label: 'Iniciar con el sistema',
      type: 'checkbox',
      checked: loginConfig.openAtLogin,
      click: (menuItem) => {
        setLoginItemConfig({ openAtLogin: menuItem.checked, openAsHidden: true });
      },
    },
    { type: 'separator' },
    {
      label: 'Salir de Pulso',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function refreshTrayMenu(): void {
  if (!tray) return;
  const { track, isPlaying } = currentOSPlaybackState;
  const statusPrefix = track ? (isPlaying ? '▶ ' : '⏸ ') : '';
  const tooltip = track ? `${statusPrefix}Pulso — ${track.title} · ${track.artist}` : 'Pulso';
  tray.setToolTip(tooltip);
  tray.setContextMenu(buildTrayContextMenu());
}

function setupTray(): void {
  const iconPath = getWindowIconPath();
  if (!iconPath) return;

  const trayImage = nativeImage.createFromPath(iconPath);
  if (trayImage.isEmpty()) return;

  const resizedIcon = trayImage.resize({ width: 18, height: 18 });
  tray = new Tray(resizedIcon);
  refreshTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) {
      createWindow();
    } else if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updatePowerSaveBlocker(isPlaying: boolean): void {
  try {
    if (isPlaying) {
      if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      }
    } else if (powerSaveBlockerId !== null) {
      if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
      }
      powerSaveBlockerId = null;
    }
  } catch {
    // Fallback silencioso si la plataforma rechaza powerSaveBlocker
  }
}

function updateTaskbarProgress(state: OSPlaybackState): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    if (!state.track || !Number.isFinite(state.progress) || state.progress < 0) {
      mainWindow.setProgressBar(-1);
      return;
    }
    const clamped = Math.min(1, Math.max(0, state.progress));
    if (process.platform === 'win32') {
      mainWindow.setProgressBar(clamped, { mode: state.isPlaying ? 'normal' : 'paused' });
    } else {
      mainWindow.setProgressBar(clamped);
    }
  } catch {
    // Ignorar errores de barra de progreso no soportada en ciertos gestores de ventanas
  }
}

function createSvgIcon(svgBody: string): Electron.NativeImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">${svgBody}</svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl);
}

function updateWindowsThumbarButtons(state: OSPlaybackState): void {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return;
  try {
    const hasTrack = Boolean(state.track);
    const flags: Array<'enabled' | 'disabled'> = [hasTrack ? 'enabled' : 'disabled'];

    const prevIcon = createSvgIcon('<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>');
    const playPauseIcon = state.isPlaying
      ? createSvgIcon('<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>')
      : createSvgIcon('<path d="M8 5v14l11-7z"/>');
    const nextIcon = createSvgIcon('<path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"/>');

    mainWindow.setThumbarButtons([
      {
        tooltip: 'Pista anterior',
        icon: prevIcon,
        flags,
        click: () => sendMediaControl('previous'),
      },
      {
        tooltip: state.isPlaying ? 'Pausar' : 'Reproducir',
        icon: playPauseIcon,
        flags,
        click: () => sendMediaControl('toggle-play'),
      },
      {
        tooltip: 'Siguiente pista',
        icon: nextIcon,
        flags,
        click: () => sendMediaControl('next'),
      },
    ]);
  } catch {
    // Ignorar si la ventana aún no tiene handle de barra de tareas en Windows
  }
}

function getOSThemeInfo(): OSThemeInfo {
  let accentColor: string | undefined;
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      const raw = systemPreferences.getAccentColor?.();
      if (typeof raw === 'string' && raw.length >= 6) {
        accentColor = `#${raw.slice(0, 6)}`;
      }
    } catch {
      accentColor = undefined;
    }
  }
  return {
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    inHighContrastColors: nativeTheme.shouldUseHighContrastColors,
    ...(accentColor ? { accentColor } : {}),
  };
}

function showTrackNotification(payload: OSTrackNotification): void {
  if (!payload?.title) return;
  try {
    if (!Notification.isSupported()) return;
    // Solo notificar cuando el usuario está fuera de la app o la ventana está oculta
    const isWindowActive =
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isVisible() &&
      !mainWindow.isMinimized() &&
      mainWindow.isFocused();
    if (isWindowActive) return;

    const subtitleParts = [payload.artist, payload.album].filter(Boolean);
    const iconPath = getWindowIconPath();
    const notification = new Notification({
      title: payload.title,
      body: subtitleParts.join(' · ') || 'Pulso',
      silent: true,
      ...(iconPath ? { icon: iconPath } : {}),
    });

    notification.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  } catch {
    // Algunas distribuciones Linux sin daemon D-Bus de notificaciones pueden fallar
  }
}

function registerOSIntegrationIpcHandlers(): void {
  ipcMain.on('os:playback-state', (_event, state: OSPlaybackState) => {
    if (!state || typeof state !== 'object') return;
    const prevTrackId = currentOSPlaybackState.track?.videoId ?? null;
    const prevPlaying = currentOSPlaybackState.isPlaying;
    const prevLiked = currentOSPlaybackState.isLiked;

    currentOSPlaybackState = {
      track: state.track
        ? {
            videoId: String(state.track.videoId || ''),
            title: String(state.track.title || ''),
            artist: String(state.track.artist || ''),
            ...(state.track.album ? { album: String(state.track.album) } : {}),
            ...(state.track.thumbnailUrl ? { thumbnailUrl: String(state.track.thumbnailUrl) } : {}),
          }
        : null,
      isPlaying: Boolean(state.isPlaying),
      isLiked: Boolean(state.isLiked),
      progress: typeof state.progress === 'number' ? state.progress : -1,
    };

    updatePowerSaveBlocker(currentOSPlaybackState.isPlaying);
    updateTaskbarProgress(currentOSPlaybackState);

    const metadataOrStateChanged =
      (currentOSPlaybackState.track?.videoId ?? null) !== prevTrackId ||
      currentOSPlaybackState.isPlaying !== prevPlaying ||
      currentOSPlaybackState.isLiked !== prevLiked;

    if (metadataOrStateChanged) {
      refreshTrayMenu();
      if (process.platform === 'darwin' && app.dock) {
        app.dock.setMenu(buildMacDockMenu());
      }
      updateWindowsThumbarButtons(currentOSPlaybackState);
    }
  });

  ipcMain.on('os:track-notification', (_event, payload: OSTrackNotification) => {
    showTrackNotification(payload);
  });

  ipcMain.handle('os:get-login-item', () => {
    return getLoginItemConfig();
  });

  ipcMain.handle('os:set-login-item', (_event, config: LoginItemConfig) => {
    return setLoginItemConfig(config);
  });

  ipcMain.handle('os:get-theme-info', () => {
    return getOSThemeInfo();
  });

  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('os:theme-changed', getOSThemeInfo());
    }
  });
}

function registerGlobalShortcuts(): void {
  const shortcuts: Array<[string, () => void]> = [
    ['CommandOrControl+Shift+Space', () => sendMediaControl('toggle-play')],
    ['CommandOrControl+Shift+Right', () => sendMediaControl('next')],
    ['CommandOrControl+Shift+Left', () => sendMediaControl('previous')],
    ['CommandOrControl+Shift+L', () => sendMediaControl('toggle-like')],
    [
      'CommandOrControl+Shift+M',
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          setMiniPlayerMode(mainWindow, !isMiniPlayer);
        }
      },
    ],
  ];

  for (const [accelerator, handler] of shortcuts) {
    try {
      globalShortcut.register(accelerator, handler);
    } catch {
      // Si otra aplicación ya reservó el atajo, continuar sin interrumpir
    }
  }
}

function setupPowerMonitor(): void {
  try {
    powerMonitor.on('suspend', () => {
      updatePowerSaveBlocker(false);
      sendMediaControl('pause');
      mainWindow?.webContents.send('os:power-suspend');
    });

    powerMonitor.on('resume', () => {
      mainWindow?.webContents.send('os:power-resume');
    });
  } catch {
    // Fallback seguro si powerMonitor no está disponible
  }
}

function createWindow() {
  const iconPath = getWindowIconPath();
  const savedState = loadWindowState();
  const startHidden = process.argv.includes('--hidden');

  normalBounds = {
    width: savedState.width,
    height: savedState.height,
    x: savedState.x ?? 0,
    y: savedState.y ?? 0,
  };

  mainWindow = new BrowserWindow({
    title: 'Pulso',
    width: savedState.width,
    height: savedState.height,
    ...(typeof savedState.x === 'number' && typeof savedState.y === 'number'
      ? { x: savedState.x, y: savedState.y }
      : {}),
    minWidth: 800,
    minHeight: 500,
    show: !startHidden,
    frame: false,
    backgroundColor: '#0a0812',
    ...(process.platform === 'darwin'
      ? {
          vibrancy: 'under-window' as const,
          visualEffectState: 'active' as const,
        }
      : {}),
    ...(process.platform === 'win32'
      ? {
          backgroundMaterial: 'mica' as const,
        }
      : {}),
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Puente seguro que definimos antes
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (savedState.isMaximized && !startHidden) {
    mainWindow.maximize();
  }

  if (iconPath && (process.platform === 'win32' || process.platform === 'linux')) {
    mainWindow.setIcon(iconPath);
  }

  setupPermissions(mainWindow);

  // La app es una SPA de una sola ventana: ni popups ni navegaciones externas.
  // Sin esto, un renderer comprometido podría redirigir la ventana principal a
  // una página de phishing manteniendo el marco de la aplicación.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDevServer = isDev && url.startsWith('http://localhost:4200');
    if (!isDevServer && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      const link = pendingDeepLink;
      pendingDeepLink = null;
      mainWindow?.webContents.send('os:deep-link', link);
    }
    updateWindowsThumbarButtons(currentOSPlaybackState);
  });

  // Notificar al renderer cuando la ventana cambia de estado maximizado/restaurado
  mainWindow.on('maximize', () => {
    scheduleSaveWindowState();
    mainWindow?.webContents.send('window-maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    scheduleSaveWindowState();
    mainWindow?.webContents.send('window-maximized-change', false);
  });

  mainWindow.on('resize', () => {
    scheduleSaveWindowState();
  });

  mainWindow.on('move', () => {
    scheduleSaveWindowState();
  });

  // En lugar de destruir la ventana al cerrar, ocultar a la bandeja si no estamos saliendo
  mainWindow.on('close', (event) => {
    saveWindowStateImmediate();
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (isDev) {
    // En desarrollo, carga la URL local de Angular (por defecto el puerto 4200)
    mainWindow.loadURL('http://localhost:4200');
    // Abre las herramientas de desarrollo automáticamente
    mainWindow.webContents.openDevTools();
  } else {
    // En producción, carga el archivo index.html compilado por Angular
    const productionHtmlPath = findExistingPath([
      path.join(app.getAppPath(), 'dist/ytmdannieldev/browser/index.html'),
      path.join(__dirname, '../dist/ytmdannieldev/browser/index.html'),
      path.join(process.resourcesPath, 'app/dist/ytmdannieldev/browser/index.html'),
    ]);
    mainWindow.loadFile(
      productionHtmlPath || path.join(__dirname, '../dist/ytmdannieldev/browser/index.html'),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  updatePowerSaveBlocker(false);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  updatePowerSaveBlocker(false);
});

app.whenReady().then(async () => {
  setupMacDockIcon();
  setupImageOptimization();
  setupTray();
  registerWindowIpcHandlers();
  registerOSIntegrationIpcHandlers();
  registerAuthIpcHandlers();
  registerSafeStorageIpcHandlers();
  registerGlobalShortcuts();
  setupPowerMonitor();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
