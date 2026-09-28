# Changelog

Todas las novedades relevantes del proyecto.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el versionado es [SemVer](https://semver.org/lang/es/).

## [No publicado]

### Añadido

- `SearchStore` para el resultado de búsqueda, en lugar de compartirlo por la
  clave `'search'` de un store global sin tipar.
- Rutas con parámetros (`/album/:albumId`, `/playlist/:playlistId`) y
  `withComponentInputBinding()`: las páginas de detalle ya no dependen de estado
  global y un enlace recargado abre el conteúdo correcto.
- Componentes compartidos que sustituyen a copias divergentes:
  `DetailSongRow` (3 componentes, ~400 líneas), `DetailHero` (2 componentes,
  ~250 líneas) y `app-thumb` + `ThumbnailFallback` (5 tripletas de degradado de
  miniaturas más 4 bloques dentro de `list-search`).
- `CoverPalette`, que centraliza los estilos derivados del color dominante de la
  portada (ColorThief), antes repetidos en tres componentes.
- `api.config.ts` con `API_BASE_URL`, `API_ALLOWED_ORIGINS`, `apiUrl()` e
  `isApiRequest()`: el interceptor solo adjunta el token al backend propio.
- Job de CI con Prettier y tests; los builds solo se ejecutan si pasan.
- `PlaybackService` es también el dueño del `HTMLAudioElement`: `player-bar` y
  `now-playing` ya no crean audio propio, así que no hay dos elementos
  compitiendo por el stream.
- `PlaybackStateStore`: la cola, el índice, la posición, el volumen, la velocidad
  y los modos se restauran al reabrir la app. No se intenta el autoplay (el
  navegador y Electron lo bloquean); la pista queda cargada y la posición se
  aplica en el primer play.
- Control de velocidad (0.5x–2x) en la barra y con los atajos `+` / `-`.
- Selector de salida de audio con `HTMLMediaElement.setSinkId()`, con
  enumeración de dispositivos y degradación limpia cuando la API no existe o el
  navegador la rechaza.
- Atajos globales de teclado (`PlaybackShortcutsService`) en una sola tabla,
  cediendo el paso a la tecla cuando el foco está en un campo de texto.
- MediaSession: metadatos, carátula, estado de reproducción, posición y controles
  del sistema (llavero, teclado multimedia, auriculares Bluetooth).
- Cola editable: reordenar arrastrando, quitar con el botón o con `Supr`, y
  vaciarla. El orden editado es el canónico, así que apagar el modo aleatorio no
  lo deshace.
- `AudioVisualizerService`: espectro en tiempo real con `AnalyserNode` sobre el
  elemento que ya suena, en lugar de la forma de onda precalculada de
  WaveSurfer (que además decodificaba el stream por segunda vez).
- Desfase de letras ajustable en pasos de medio segundo y persistido entre
  sesiones, porque las marcas de tiempo de Lrclib a veces no coinciden con el
  audio.
- Búsqueda dentro de la letra, sin distinguir mayúsculas ni acentos, con las
  coincidencias resaltadas.
- Empaquetado por plataforma con `extraResources` e iconos en rutas
  deterministas (`process.resourcesPath`), sin adivinar entre candidatos.

### Cambiado

- `Auth.login()` usa `switchMap` en vez de `tap(async …)`, que completaba el
  observable antes de persistir el token y perdía los fallos de escritura.
- `authorizationGuard` devuelve `UrlTree` en lugar de navegar imperativamente.
- `PlaybackService` es la única fuente de verdad de cola, stream e intención de
  reproducción: expone `toQueueItems()`, `playShuffled()` y `$stream`, y ya no
  expone el campo mutable `shouldPlay`.
- `now-playing` y `player-bar` leen la pista del servicio en vez del store
  global.
- El servicio de letras usa `HttpParams` y su parser LRC admite minutos de tres
  cifras, varios tags por línea y metadatos.
- `home.ts` narrowing por discriminante en lugar de castear con `as any`.
- `cycleRate()` recibe la dirección (`'up'` | 'down'`): antes `-` aceleraba en
  lugar de ralentizar.
- Quitar la pista en curso recarga siempre el elemento en la que lo sustituye.
  Antes solo se recargaba si estaba sonando, así que al quitarla en pausa la
  interfaz anunciaba la siguiente pero el siguiente play reanudaba la eliminada.
  La continuación usa `_shouldPlay` en vez de `_isPlaying`, para no perder el
  arranque cuando la pista aún está cargando.
- `stop()` limpia el metadato de MediaSession, que antes seguía announcing la
  pista después de detener la reproducción.
- El estado de reproducción se persiste por instantáneas coalescidas coalescidas, con
  `flush()` en los eventos que pueden cerrar el proceso.

### Corregido

- Las imágenes con `crossorigin="anonymous"` (la portada del detalle, la de la
  barra y la de _now playing_) no se mostraban. Dos motivos encadenados:
  `onHeadersReceived` estaba registrado dos veces en la misma sesión y Electron
  solo atiende el último, así que el override `access-control-allow-origin: *`
  de las imágenes dejó de aplicarse; y como el proceso principal reescribe el
  `Origin` de la petición a `https://music.youtube.com` para evitar los 429,
  Google lo reflejaba en `access-control-allow-origin` y el chequeo CORS
  fallaba contra el origen real de la app (`net::ERR_FAILED`). Ahora hay un
  único listener para los dos filtros.
- El degradado de `app-thumb` no degradaba: `nextIndex` avanzaba desde la
  candidata de mayor calidad (siempre fuera de rango, así que un solo fallo
  acababa en el placeholder) y `getHighResThumbnail` reescribía todas las
  candidatas al mismo tamaño, de modo que el "reintento" pedía la misma URL que
  acababa de fallar. Ahora recorre la lista hacia atrás y cada candidata se pide
  al tamaño que realmente tiene, sin superar los píxeles disponibles.

### Eliminado

- `GlobalStorage` (`Record<string, any>` global). Era el origen de seis
  reactividades distintas para la misma pista y obligaba a escribir en un store
  antes de cada navegación.
- `IStream` y `Dashboard.stream()`, código muerto.
- Superficie IPC de `safeStorage` sin uso: de nueve métodos a cuatro, eliminando
  los handlers correspondientes del proceso principal.
- Las animaciones del ecualizador y las reglas de scrollbar estaban duplicadas
  en siete ficheros CSS (y `album`/`playlist` usaban `custom-scrollbar` sin
  definirla); ahora viven una vez en `styles.css`.
- `dist-electron/` sale del índice de git: es salida compilada y ya estaba en
  `.gitignore`, pero seguía versionada.
- `wavesurfer.js`: ya no se usa para nada tras migrar a `AnalyserNode`.
- `<audio>` duplicados en `player-bar` y `now-playing`.

### Seguridad

- `speaker-selection` es el único permiso que se concede, y solo al origen de la
  app; todo lo demás (cámara, micrófono, ubicación) se rechaza. Sin él
  `setSinkId()` no hace nada en Chromium.
- El proceso principal inyecta `access-control-allow-origin` para el origen del
  backend: el stream se carga con `crossOrigin='anonymous'` para que el
  `AnalyserNode` no reciba un búfer manchado, y sin esa cabecera el elemento
  rechazaba la respuesta entera.
- El token ya **nunca** se escribe en texto plano. Sin `safeStorage` (fuera de
  Electron) el valor vive solo en memoria y se pierde al recargar; con el
  keychain bloqueado la escritura falla de forma explícita en vez de simular
  éxito.
- El archivo de sesión cifrada se escribe con permisos `0600` y mediante
  temporal + `rename`, para que una interrupción no lo deje corrupto.
- Los handlers IPC validan la clave y el valor antes de tocar el disco, lo que
  cierra la inyección de claves tipo `__proto__`.
- La ventana principal bloquea popups y navegaciones fuera de la app.
- El interceptor HTTP usa una allowlist de orígenes en vez de adjuntar el
  bearer a cualquier petición saliente.

### Empaquetado

- Tamaño instalado en macOS arm64: 341 MB → 242 MB; en Windows: 420 MB → 328 MB.
- `app.asar`: 55,8 MB → 1,9 MB. `node_modules` ya no se empaqueta.
- Locales: 53 → 2 (`en-US`, `es`).
