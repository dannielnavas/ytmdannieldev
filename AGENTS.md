# AGENTS.md

Electron desktop app "Sonara" (YouTube Music player): Angular 22 renderer + Electron main process. The Angular CLI output dir is `dist/ytmdannieldev/browser/`; the compiled Electron main runs from `dist-electron/`.

## Commands

Use `pnpm` (npm/npx will misbehave with the Electron-forge toolchain).

- `pnpm dev` — run the whole app: starts `ng serve` (port 4200) and, once it's up (`wait-on`), compiles Electron (`tsc -p tsconfig.electron.json`) and launches Electron pointing at `http://localhost:4200`.
- `pnpm build` — Angular production build to `dist/`.
- `pnpm test` — `ng test`, runs Vitest (not Karma). Run a single spec with `pnpm ng test -- --include='**/home.spec.ts'`.
- `pnpm electron:build-ts` — compile only the Electron process (TS -> CommonJS in `dist-electron/`).
- `pnpm dist` / `pnpm dist:mac` / `pnpm dist:win` / `pnpm dist:linux` — `electron-builder` multiplatform packaging.

This is NOT a pure browser app: `pnpm ng:serve` alone gives only an Angular page with no Electron bridges.

## Architecture

- **Angular renderer**: `src/app/`. Organized as `features/` (auth, home, library, search, shell), `shared/` (components, pipes), `core/` (models, store, guards, interceptors, services).
- **Electron main**: `electron/main.ts` and `electron/preload.ts`, compiled separately by `tsconfig.electron.json` (distinct tsconfig, CommonJS, out to `dist-electron/`).
- **IPC bridge contract** lives in three places that must stay in sync: `electron/preload.ts`, `src/electron.d.ts` (global `Window` typings), and the renderer consumers (`window.electronAPI`, `window.safeStorage`, `window.windowControls`). If you change one, update the others or TypeScript/`window` access will break.
- **Packaging config** is in `package.json` under `build` (`electron-builder`). Outputs go to `dist-release/`. Targets include macOS (DMG/ZIP), Windows (NSIS/Portable), and Linux (Pacman for CachyOS/Arch, AppImage, DEB).
- Window is frameless (`frame: false`) with a custom title bar component; window control IPC handlers (`window-minimize`, etc.) live in `electron/main.ts`.

## Backend dependency

The renderer calls a hardcoded backend at `https://ytmdannieldev-back.vercel.app` (hardcoded in `auth/auth.ts`, `dashboard/dashboard.ts`, `player-bar.ts`). It is NOT part of this repo and must be running for real data: `/auth/login-cookie`, `/youtube/dashboard`, `/youtube/stream`. Tests should mock `HttpClient`.

## Angular conventions (this repo follows Angular v22 defaults)

- Standalone components everywhere; do NOT set `standalone: true` (it is the default).
- Do NOT set `changeDetection: OnPush` (default in v22); prefer signals + `computed()` + `linkedSignal()`.
- Use `inject()` for DI; `@Service()` decorator for new singleton services (v22+) instead of `@Injectable({providedIn:'root'})`.
- Use signal-based inputs/outputs: `input()`, `output()`, `model()`.
- Put host bindings in the `host` object of the decorator (no `@HostBinding`/`@HostListener`).
- Use native control flow (`@if`/`@for`/`@switch`), not `*ngIf`/`*ngFor`.
- Prefer Signal Forms or Reactive forms; pass AXE / WCAG AA checks.
- Component file naming is inconsistent: most features use bare names (`home.ts`, `search.ts`) but `title-bar.component.ts` exists. Match the existing pattern in whatever directory you edit.
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (see `.postcssrc.json`).

## Codegen / lint

- No `eslint`/`lint` script exists. Prettier is configured (`.prettierrc`, `printWidth: 100`, single quotes). If you add files, keep them Prettier-formatted.
- Reuse existing Angular conventions from `.gemini/GEMINI.md` when refreshing AI-driven code; it documents the same v22 conventions above.
