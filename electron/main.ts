import { app, BrowserWindow, ipcMain, nativeImage, session, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

app.setName('Sonara');

// Optimización de caché de red de Chromium para imágenes y multimedia
app.commandLine.appendSwitch('disk-cache-size', '1073741824'); // 1 GB de caché en disco
app.commandLine.appendSwitch('media-cache-size', '536870912'); // 512 MB de caché multimedia

let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged; // Detecta si estamos en desarrollo o producción

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
 * Retorna la ruta adecuada del ícono de ventana según el sistema operativo:
 * - Windows: icon.ico
 * - Linux: 512x512.png (o icon.png)
 * - macOS: icon.icns (o icon.png)
 */
function getWindowIconPath(): string {
  const baseDirs = [
    app.getAppPath(),
    path.resolve(__dirname, '..'),
    process.resourcesPath,
    __dirname,
  ];

  if (process.platform === 'win32') {
    return findExistingPath(
      baseDirs.flatMap((dir) => [
        path.join(dir, 'icons', 'windows', 'icon.ico'),
        path.join(dir, 'icons', 'icon.ico'),
        path.join(dir, 'icons', 'icon.png'),
      ]),
    );
  }

  if (process.platform === 'linux') {
    return findExistingPath(
      baseDirs.flatMap((dir) => [
        path.join(dir, 'icons', 'linux', 'icons', '512x512.png'),
        path.join(dir, 'icons', 'linux', 'icons', '256x256.png'),
        path.join(dir, 'icons', 'icon.png'),
      ]),
    );
  }

  if (process.platform === 'darwin') {
    return findExistingPath(
      baseDirs.flatMap((dir) => [
        path.join(dir, 'icons', 'macos', 'icon.icns'),
        path.join(dir, 'icons', 'icon.icns'),
        path.join(dir, 'icons', 'macos', '512x512.png'),
        path.join(dir, 'icons', 'icon.png'),
      ]),
    );
  }

  return findExistingPath(baseDirs.map((dir) => path.join(dir, 'icons', 'icon.png')));
}

/**
 * Configura el ícono de la aplicación en el Dock de macOS en tiempo de ejecución.
 */
function setupMacDockIcon(): void {
  if (process.platform === 'darwin' && app.dock) {
    const baseDirs = [
      app.getAppPath(),
      path.resolve(__dirname, '..'),
      process.resourcesPath,
      __dirname,
    ];

    const dockIconPath = findExistingPath(
      baseDirs.flatMap((dir) => [
        path.join(dir, 'icons', 'macos', '512x512.png'),
        path.join(dir, 'icons', 'macos', '1024x1024.png'),
        path.join(dir, 'icons', 'icon.png'),
        path.join(dir, 'icons', 'macos', 'icon.icns'),
      ]),
    );

    if (dockIconPath) {
      const icon = nativeImage.createFromPath(dockIconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
      }
    }
  }
}

function registerWindowIpcHandlers() {
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
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

  const getSecureStorageData = (): Record<string, string> => {
    try {
      const filePath = getStorageFilePath();
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error al leer secure-storage:', error);
    }
    return {};
  };

  const saveSecureStorageData = (data: Record<string, string>): void => {
    try {
      const filePath = getStorageFilePath();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error al guardar secure-storage:', error);
    }
  };

  ipcMain.handle('safe-storage:is-available', () => {
    return safeStorage.isEncryptionAvailable();
  });

  ipcMain.handle('safe-storage:encrypt-string', (_event, plainText: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage no está disponible en este sistema.');
    }
    const buffer = safeStorage.encryptString(plainText);
    return buffer.toString('base64');
  });

  ipcMain.handle('safe-storage:decrypt-string', (_event, encryptedBase64: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage no está disponible en este sistema.');
    }
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  });

  ipcMain.handle('safe-storage:set-item', (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage no está disponible en este sistema.');
    }
    const buffer = safeStorage.encryptString(value);
    const data = getSecureStorageData();
    data[key] = buffer.toString('base64');
    saveSecureStorageData(data);
    return true;
  });

  ipcMain.handle('safe-storage:get-item', (_event, key: string) => {
    const data = getSecureStorageData();
    const encryptedBase64 = data[key];
    if (!encryptedBase64) {
      return null;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage no está disponible en este sistema.');
    }
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  });

  ipcMain.on('safe-storage:get-item-sync', (event, key: string) => {
    try {
      const data = getSecureStorageData();
      const encryptedBase64 = data[key];
      if (!encryptedBase64) {
        event.returnValue = null;
        return;
      }
      if (!safeStorage.isEncryptionAvailable()) {
        event.returnValue = null;
        return;
      }
      const buffer = Buffer.from(encryptedBase64, 'base64');
      event.returnValue = safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('Error al obtener item sincrónicamente:', error);
      event.returnValue = null;
    }
  });

  ipcMain.handle('safe-storage:remove-item', (_event, key: string) => {
    const data = getSecureStorageData();
    if (key in data) {
      delete data[key];
      saveSecureStorageData(data);
      return true;
    }
    return false;
  });

  ipcMain.handle('safe-storage:clear', () => {
    saveSecureStorageData({});
    return true;
  });
}

/**
 * Configura la optimización de red y mitigación de errores 429 para imágenes de YouTube Music:
 * 1. Simula peticiones legítimas del cliente web de YouTube Music (Referer y Origin).
 * 2. Limpia el User-Agent para evitar bloqueos por cliente automatizado/Electron.
 * 3. Habilita cabeceras CORS para permitir análisis de color (ColorThief).
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

  // 2. Interceptar respuestas para habilitar CORS y asegurar almacenamiento en disco
  session.defaultSession.webRequest.onHeadersReceived(googleFilter, (details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    // Permitir CORS para ColorThief y canvas sin restricciones
    responseHeaders['access-control-allow-origin'] = ['*'];
    responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
    responseHeaders['access-control-allow-headers'] = ['*'];

    // Si la imagen cargó con éxito (2xx), forzar almacenamiento persistente en caché de disco
    const status = details.statusCode;
    if (status >= 200 && status < 300) {
      responseHeaders['cache-control'] = ['public, max-age=2592000, immutable'];
    }

    callback({ responseHeaders });
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
