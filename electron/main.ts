import { app, BrowserWindow, ipcMain, nativeImage, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

app.setName('Sonara');

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
    return new Promise((resolve, reject) => {
      let isResolved = false;
      const iconPath = getWindowIconPath();

      authWindow = new BrowserWindow({
        title: 'Iniciar sesión con Google - Sonara',
        width: 500,
        height: 600,
        parent: mainWindow ?? undefined,
        modal: true,
        icon: iconPath || undefined,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL('https://accounts.google.com/ServiceLogin?service=youtube');

      // Escuchar cuando la ventana se cierra o cuando navega a YouTube Music con éxito
      authWindow.webContents.on('did-navigate', async (_event, url) => {
        if (url.includes('music.youtube.com') || url.includes('youtube.com')) {
          // Obtenemos las cookies de la sesión de esa ventana
          const cookies = await session.defaultSession.cookies.get({ domain: '.youtube.com' });

          // Filtramos las cookies esenciales que requiere la API de YouTube Music (como SAPISID, HSID, etc.)
          const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

          if (cookieHeader.includes('SAPISID')) {
            isResolved = true;
            if (authWindow) authWindow.close();
            resolve(cookieHeader); // Devolvemos el string de cookies listo para tu backend
          }
        }
      });

      authWindow.on('closed', () => {
        authWindow = null;
        if (!isResolved) {
          reject('Ventana de autenticación cerrada por el usuario');
        }
      });
    });
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
    mainWindow.loadFile(path.join(__dirname, '../dist/ytmdannieldev/browser/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupMacDockIcon();
  registerWindowIpcHandlers();
  registerAuthIpcHandlers();
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
