import { app, BrowserWindow, ipcMain, nativeImage, session, safeStorage, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

app.setName('Sonara');

// Optimización de caché de red de Chromium para imágenes y multimedia
app.commandLine.appendSwitch('disk-cache-size', '1073741824'); // 1 GB de caché en disco
app.commandLine.appendSwitch('media-cache-size', '536870912'); // 512 MB de caché multimedia

let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;

let isMiniPlayer = false;
let normalBounds = { width: 1280, height: 720, x: 0, y: 0 };
let wasMaximized = false;

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
      const currentDisplay = screen.getDisplayMatching(normalBounds);
      const { workArea } = currentDisplay;
      const x = Math.round(workArea.x + workArea.width - 410);
      const y = Math.round(workArea.y + workArea.height - 195);
      win.setPosition(x, y);
    } catch {
      // Fallback si la detección de display falla
    }
  } else {
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

/**
 * Configura el ícono de la aplicación en el Dock de macOS en tiempo de ejecución.
 */
function setupMacDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) {
    return;
  }
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
        title: 'Iniciar sesión con Google - Sonara',
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
  session.defaultSession.webRequest.onBeforeSendHeaders(googleFilter, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };

    requestHeaders['Referer'] = 'https://music.youtube.com/';
    requestHeaders['Origin'] = 'https://music.youtube.com';

    // Normalizar User-Agent removiendo Electron para evitar rate-limits de bot
    const userAgent = requestHeaders['User-Agent'] || requestHeaders['user-agent'];
    if (userAgent && userAgent.includes('Electron')) {
      requestHeaders['User-Agent'] = userAgent.replace(/Electron\/[0-9.]+\s?/, '');
    }

    callback({ requestHeaders });
  });

  // 2. Interceptar respuestas para habilitar CORS y asegurar almacenamiento en disco.
  //
  // Un solo listener para los dos filtros: Electron solo atiende el último
  // `onHeadersReceived` que se registra en la sesión, así que registrar dos
  // dejaba el primero (el de las imágenes) sin efecto. Y sin este `*` las
  // imágenes con `crossorigin="anonymous"` no cargan: el `Origin` del punto 1 es
  // reescrito a `https://music.youtube.com` y Google lo refleja en
  // `access-control-allow-origin`, que entonces no coincide con el origen real
  // de la app y el navegador rechaza la imagen con `net::ERR_FAILED`.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: [...googleFilter.urls, ...streamFilter.urls] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      // Permitir CORS para ColorThief y canvas sin restricciones
      responseHeaders['access-control-allow-origin'] = ['*'];
      responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
      responseHeaders['access-control-allow-headers'] = ['*'];

      if (details.url.startsWith(API_ORIGIN)) {
        // El audio no debe quedar cacheado: la cola puede repetir la misma pista.
        responseHeaders['cache-control'] = ['no-store'];
      } else if (details.statusCode >= 200 && details.statusCode < 300) {
        // Si la imagen cargó con éxito (2xx), forzar almacenamiento persistente
        // en caché de disco.
        responseHeaders['cache-control'] = ['public, max-age=2592000, immutable'];
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
 * dispositivos. Sonara solo necesita elegir la salida de audio, así que ese es el
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

function createWindow() {
  const iconPath = getWindowIconPath();

  mainWindow = new BrowserWindow({
    title: 'Sonara',
    width: 1280,
    height: 720,
    frame: false, // Opcional: útil si vas a usar tu propia barra de título personalizada
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Puente seguro que definimos antes
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

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

  // Notificar al renderer cuando la ventana cambia de estado maximizado/restaurado
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-change', false);
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

app.whenReady().then(async () => {
  setupMacDockIcon();
  setupImageOptimization();
  registerWindowIpcHandlers();
  registerAuthIpcHandlers();
  registerSafeStorageIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
