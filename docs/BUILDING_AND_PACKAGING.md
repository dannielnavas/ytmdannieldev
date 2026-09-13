# Guía de Compilación, Empaquetado y Distribución: Sonara

Esta guía explica cómo compilar Sonara para **Linux** (especialmente **CachyOS / Arch Linux**), **Windows** y **macOS**, cómo gestionar la ausencia de certificados de pago y cómo instalar la aplicación en cada sistema.

---

## 1. Comandos de Compilación Rápida

| Plataforma | Comando | Formatos generados en `dist-release/` |
| :--- | :--- | :--- |
| **Linux (CachyOS / Arch / Ubuntu)** | `pnpm dist:linux` | `.pacman` (CachyOS/Arch), `.AppImage`, `.deb` |
| **Windows (10 / 11)** | `pnpm dist:win` | `Sonara Setup 0.1.0.exe` (NSIS), `Sonara 0.1.0.exe` (Portable) |
| **macOS (Apple Silicon e Intel)** | `pnpm dist:mac` | `Sonara-0.1.0-arm64.dmg`, `Sonara-0.1.0.dmg`, `.zip` |
| **Todas a la vez** | `pnpm dist` | Todos los paquetes multiplataforma |

> **Nota:** Todos los comandos compilan primero automáticamente Angular (`ng build --base-href ./`) y el proceso principal de Electron (`tsc -p tsconfig.electron.json`), antes de generar los instaladores.

---

## 2. Instalación en Linux (CachyOS / Arch Linux)

CachyOS está basada en Arch Linux, por lo que dispone de dos opciones ideales generadas:

### Opción A: Paquete Nativo Pacman (`.pacman`) [Recomendada]
1. Abre una terminal en la carpeta `dist-release/`:
   ```bash
   sudo pacman -U Sonara-0.1.0.pacman
   ```
2. La aplicación quedará instalada de forma nativa en `/opt/Sonara/`, integrada en el menú de aplicaciones de tu escritorio (KDE Plasma, GNOME, Hyprland, etc.) bajo la categoría de Audio.
3. Para desinstalarla cuando lo desees:
   ```bash
   sudo pacman -R sonara
   ```

### Opción B: Formato Universal AppImage (`.AppImage`)
No requiere instalación ni permisos de administrador:
```bash
chmod +x Sonara-0.1.0.AppImage
./Sonara-0.1.0.AppImage
```
*(Si usas utilidades como `AppImageLauncher` o `Geary`, se integrará automáticamente en el menú del sistema).*

---

## 3. Certificados de Firma Digital (Gratuitos vs De Pago)

### A. Linux (CachyOS, Ubuntu, Fedora)
- **No se requieren certificados comerciales ni pagos.**
- Linux es un ecosistema abierto: los archivos `.pacman`, `.AppImage` y `.deb` se instalan y ejecutan directamente sin ninguna advertencia del sistema operativo.

---

### B. macOS (Gatekeeper)
- **Certificado comercial:** Apple cobra **$99 USD al año** (Apple Developer Program) para otorgar un certificado "Developer ID" y realizar la notarización en sus servidores.
- **Solución gratuita implementada en Sonara:**
  - El empaquetado usa **Ad-hoc Signing** (`identity: null`), lo que firma el ejecutable con una identidad local válida para que el sistema operativo permita su ejecución sin errores de integridad.
  - Al compartir el `.dmg` o la app por internet (Telegram, GitHub, Drive), macOS le añade el atributo de "cuarentena".
  - **Cómo abrir la app en Mac sin pagar certificado:**
    1. **Método gráfico:** Haz clic derecho (o `Ctrl + Clic`) sobre `Sonara.app` -> selecciona **Abrir** -> confirma en el diálogo haciendo clic en **Abrir**. (Solo se hace la primera vez).
    2. **Método por terminal:** Si el usuario ve el mensaje *"Sonara está dañada o no se puede verificar"*, se soluciona ejecutando una sola vez:
       ```bash
       xattr -cr /Applications/Sonara.app
       ```

---

### C. Windows (Microsoft Defender SmartScreen)
- **Certificado comercial:** Microsoft exige certificados EV (*Extended Validation*) o OV emitidos por autoridades como DigiCert o Sectigo, los cuales cuestan entre $200 y $500 USD anuales.
- **Solución gratuita implementada en Sonara:**
  - Sonara se compila con instalador estándar NSIS y versión portable.
  - Cuando un usuario descargue el `.exe` por primera vez, Windows SmartScreen mostrará la ventana azul: *"Windows protegió su PC"*.
  - **Instrucción para el usuario:**
    1. Hacer clic en el enlace azul **"Más información"** (*More info*).
    2. Hacer clic en el botón **"Ejecutar de todas formas"** (*Run anyway*).
    3. Una vez ejecutada unas cuantas veces o a medida que los usuarios descarguen la app, SmartScreen va ganando reputación automáticamente.

#### (Opcional) Creación de un Certificado Auto-firmado en Windows
Si deseas firmar el binario con tu propio certificado auto-firmado, puedes ejecutar en PowerShell (como Administrador) en una máquina Windows:
```powershell
# 1. Crear el certificado auto-firmado
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Sonara, O=Sonara Developers" -CertStoreLocation "Cert:\CurrentUser\My"

# 2. Exportarlo con contraseña
$password = ConvertTo-SecureString -String "TuContrasenaSegura" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "sonara-cert.pfx" -Password $password
```
Para usarlo en `package.json`:
```json
"win": {
  "certificateFile": "sonara-cert.pfx",
  "certificatePassword": "TuContrasenaSegura"
}
```
*(Nota: Aunque esté autofirmado, los usuarios seguirán viendo SmartScreen a menos que instalen el certificado en su almacén de "Entidades de certificación raíz de confianza", por lo que el método de "Más información -> Ejecutar de todas formas" es el estándar más práctico para proyectos independientes).*

---

## 4. Compilación Automatizada en la Nube (GitHub Actions)

El repositorio incluye el workflow [.github/workflows/build.yml](../.github/workflows/build.yml).

### Cómo funciona:
1. Cada vez que crees una etiqueta (tag) en Git, por ejemplo:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. GitHub levantará automáticamente 3 máquinas virtuales simultáneas:
   - **Ubuntu Linux**: compila `.pacman`, `.AppImage` y `.deb`.
   - **Windows**: compila `Sonara Setup 0.1.0.exe` y `Sonara 0.1.0.exe`.
   - **macOS**: compila los instaladores `.dmg` y `.zip` (para Apple Silicon e Intel).
3. Publicará automáticamente un **GitHub Release** con todos los archivos listos para descarga pública directa.
4. También puedes ejecutar el workflow manualmente desde la pestaña **Actions** en tu repositorio de GitHub usando el botón **"Run workflow"**.
