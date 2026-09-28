# Sonara

Reproductor de YouTube Music para escritorio. Electron 39 + Angular 22.

## Requisitos

- Node.js 20 o superior
- [pnpm](https://pnpm.io) (usa el gestor de paquetes nativo; `npm`/`npx` rompen
  la cadena de Electron Forge)

## Comandos

| Comando                  | Qué hace                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `pnpm dev`               | Levanta `ng serve` y, cuando responde, compila y abre Electron  |
| `pnpm build`             | Build de producción del renderer a `dist/ytmdannieldev/browser` |
| `pnpm build:all`         | Renderer + proceso principal                                    |
| `pnpm electron:build-ts` | Solo el proceso principal (TS → CommonJS en `dist-electron/`)   |
| `pnpm test`              | Tests unitarios con Vitest                                      |
| `pnpm dist`              | Empaquetado para la plataforma actual                           |
| `pnpm dist:mac`          | macOS (DMG + ZIP)                                               |
| `pnpm dist:win`          | Windows (NSIS + Portable)                                       |
| `pnpm dist:linux`        | Linux (Pacman, AppImage, DEB)                                   |

`pnpm dev` necesita ambos procesos: `ng serve` por sí solo da una página Angular
sin los puentes de Electron, y sin renderer la app no tiene interfaz.

Para ejecutar un único spec:

```bash
pnpm ng test -- --include='**/detail-hero.spec.ts'
```

`ng test` no admite varios `--include` a la vez: hay que ejecutar la suite
completa o un solo patrón.

## Estructura

```
electron/          proceso principal y preload (tsconfig propio, CommonJS)
src/app/
  features/        auth, home, library, search, shell (páginas y rutas)
  shared/          componentes reutilizables
  core/            modelos, store, guards, interceptores, servicios
  styles.css       estilos globales
```

El renderer es una SPA con `withHashLocation()`. Las rutas con parámetros
(`/album/:albumId`, `/playlist/:playlistId`) viajan en la URL, así que un enlace
se puede recargar y compartir; el resultado de búsqueda, por ser una respuesta
enorme, vive en `SearchStore` y solo en memoria.

## Contrato IPC

`electron/preload.ts`, `src/electron.d.ts` y los consumidores de
`window.electronAPI` / `window.safeStorage` / `window.windowControls` tienen que
estar sincronizados: si cambia uno, hay que actualizar los otros o TypeScript
dejará de compilar.

Superficie expuesta:

- `windowControls`: `minimize`, `maximize`, `close`, `isMaximized`,
  `onMaximizedChange`.
- `safeStorage`: `isAvailable`, `setItem`, `getItem`, `removeItem`.
- `electronAPI.loginWithGoogle`, `electronAPI.getUserData`.

`safeStorage.getItem` es síncrono a propósito: el interceptor HTTP necesita el
token al construir la petición y un guard funcional tampoco puede esperar.

## Seguridad

- El token se guarda cifrado con la clave del sistema operativo
  (`safeStorage`). Si no hay cifrado disponible, el valor queda solo en memoria
  y se pierde al recargar: nunca se escribe en texto plano.
- El archivo `secure-storage.json` se escribe con permisos `0600` y mediante
  temporal + `rename`.
- Los handlers IPC validan claves y valores antes de tocar el disco.
- La ventana principal bloquea popups y navegaciones fuera de la app.
- El interceptor solo adjunta el token a los orígenes de
  `API_ALLOWED_ORIGINS` (`src/app/core/config/api.config.ts`).
- La app no tiene CSP ni `sandbox: true` en la ventana principal: conviene
  añadirlos cuando se pueda verificar el comportamiento con las imágenes
  remotas de YouTube.

## Backend

El renderer llama a un backend externo, definido en `src/app/core/config/api.config.ts`:

- `/auth/login-cookie`
- `/youtube/dashboard`
- `/youtube/stream`

No está en este repositorio y tiene que estar desplegado para obtener datos
reales. En los tests se mockea `HttpClient`.

## Reproducción

`PlaybackService` es la única fuente de verdad: posee el `HTMLAudioElement` y
expone cola, índice, posición, volumen, velocidad, modos y el stream. Ningún
componente crea audio propio, así que no hay dos elementos compitiendo.

El stream se carga con `crossOrigin = 'anonymous'` para que el `AnalyserNode` del
visualizador reciba un búfer legible; sin la cabecera
`access-control-allow-origin` que inyecta `electron/main.ts` para el origen del
backend, el elemento rechazaría la respuesta. Por lo mismo el proceso principal
no concede más permisos que `speaker-selection`, y solo al origen de la app.

### Atajos de teclado

| Tecla               | Acción                     |
| ------------------- | -------------------------- |
| `Espacio` / `K`     | Reproducir o pausar        |
| `←` / `→`           | Pista anterior / siguiente |
| `Shift` + `←` / `→` | Retroceder o avanzar 10 s  |
| `↑` / `↓`           | Volumen                    |
| `M`                 | Silenciar                  |
| `S` / `R`           | Aleatorio / repetir        |
| `+` / `-`           | Velocidad (0.5x–2x)        |
| `Inicio`            | Volver al principio        |
| `0`–`9`             | Saltar a ese porcentaje    |

Dentro de un campo de texto, de un `contenteditable` o con `Ctrl`/`Cmd`/`Alt`
pulsado, los atajos ceden el paso a la tecla.

En la cola: `Ctrl`/`Cmd` + `↑`/`↓` reordena la fila enfocada y `Supr` la quita.
También funciona arrastrando.

### Estado y reanudación

La cola, el índice, la posición, el volumen, la velocidad y los modos se guardan
en `localStorage` (`sonara.playback-state.v1`) y se restauran al reabrir la app.
No es un secreto, por eso no pasa por `safeStorage`: la cookie de sesión sigue
cifrada aparte. No se intenta el autoplay; la pista queda cargada y la posición
se aplica en el primer play.

### Offset de letras

Las marcas de tiempo vienen de Lrclib y no siempre coinciden con el audio. En la
vista de reproducción se corrigen en pasos de medio segundo (±10 s) y la
corrección se guarda entre sesiones. Al pulsar una línea se salta al punto que
el usuario estaba viendo, no a su marca original.

## Convenciones

- Componentes standalone sin `standalone: true` y sin
  `ChangeDetection.OnPush`: Angular 22 ya los aplica por defecto.
- `inject()` para DI, `@Service()` para servicios singleton.
- Señales (`input()`, `output()`, `computed()`, `linkedSignal()`) y control flow
  nativo (`@if`, `@for`, `@switch`).
- Tailwind CSS v4 vía `@tailwindcss/postcss`.
- Prettier con `printWidth: 100` y comillas simples: `pnpm exec prettier --check .`
  debe pasar antes de commitear.

## Estructura del paquete

La configuración de `electron-builder` vive en `package.json` bajo `build`. Los
iconos se resuelven en tiempo de ejecución desde `process.resourcesPath`, y el
paquete incluye solo dos locales (`en-US`, `es`).
