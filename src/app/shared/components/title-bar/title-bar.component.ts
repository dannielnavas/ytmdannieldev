import { Component, inject, input } from '@angular/core';
import { WindowControlsService } from '../../../core/services/window-controls.service';

@Component({
  selector: 'app-title-bar',
  standalone: true,
  template: `
    <header
      class="h-9 w-full bg-[#0a0812]/90 backdrop-blur-md text-neutral-300 border-b border-white/[0.06] flex items-center justify-between select-none fixed top-0 left-0 right-0 z-50 text-xs font-medium shadow-xs"
      style="-webkit-app-region: drag;"
      (dblclick)="onDoubleClick()"
    >
      @if (controls.isMac()) {
        <!-- ======================= MAC OS LAYOUT ======================= -->
        <!-- Botones de Semáforo (Traffic Lights) a la IZQUIERDA -->
        <div
          class="group/traffic flex items-center gap-2 pl-3.5 pr-2 h-full shrink-0"
          style="-webkit-app-region: no-drag;"
        >
          <!-- Cerrar (Rojo) -->
          <button
            type="button"
            class="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/60 hover:brightness-95 active:brightness-90 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
            title="Cerrar"
            aria-label="Cerrar ventana"
            (click)="controls.close()"
          >
            <svg
              class="w-2 h-2 text-[#4d0000] opacity-0 group-hover/traffic:opacity-100 transition-opacity duration-150"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>

          <!-- Minimizar (Amarillo) -->
          <button
            type="button"
            class="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/60 hover:brightness-95 active:brightness-90 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
            title="Minimizar (Mini Reproductor)"
            aria-label="Minimizar a Mini Reproductor"
            (click)="controls.minimize()"
          >
            <svg
              class="w-2 h-2 text-[#5c3e00] opacity-0 group-hover/traffic:opacity-100 transition-opacity duration-150"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3.5"
              stroke-linecap="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <!-- Maximizar / Pantalla Completa (Verde) -->
          <button
            type="button"
            class="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/60 hover:brightness-95 active:brightness-90 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
            [title]="controls.isMaximized() ? 'Restaurar' : 'Maximizar'"
            aria-label="Maximizar o restaurar ventana"
            (click)="controls.maximize()"
          >
            <svg
              class="w-2 h-2 text-[#004d11] opacity-0 group-hover/traffic:opacity-100 transition-opacity duration-150"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M4 11V4h7l-3 3 5 5-2 2-5-5-2 2zm16 2v7h-7l3-3-5-5 2-2 5 5 2-2z" />
            </svg>
          </button>
        </div>

        <!-- Título e Ícono Centrados estilo nativo macOS -->
        <div
          class="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none max-w-[50%] overflow-hidden"
        >
          <svg
            class="w-3.5 h-3.5 text-neutral-300 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span class="truncate text-xs font-semibold text-neutral-300 tracking-wide">
            {{ $title() }}
          </span>
        </div>

        <!-- Acciones a la DERECHA en macOS: Mini Reproductor -->
        <div class="flex items-center gap-1 pr-3 h-full" style="-webkit-app-region: no-drag;">
          <button
            type="button"
            class="h-6 px-2.5 rounded-md flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors focus:outline-none cursor-pointer"
            title="Modo Mini Reproductor"
            aria-label="Modo Mini Reproductor"
            (click)="controls.toggleMiniPlayer(true)"
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <rect
                x="11"
                y="9"
                width="9"
                height="7"
                rx="1"
                fill="currentColor"
                fill-opacity="0.35"
              />
            </svg>
            <span class="text-[11px] font-medium text-neutral-400 group-hover:text-neutral-200"
              >Mini</span
            >
          </button>
        </div>
      } @else {
        <!-- ======================= WINDOWS / LINUX LAYOUT ======================= -->
        <!-- Ícono y Título a la IZQUIERDA -->
        <div class="flex items-center gap-2 px-3.5 h-full overflow-hidden pointer-events-none">
          <svg
            class="w-4 h-4 text-neutral-200 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span class="truncate tracking-wide text-neutral-200 text-xs font-semibold">
            {{ $title() }}
          </span>
        </div>

        <!-- Botones de Control de Ventana a la DERECHA -->
        <div class="flex items-center h-full shrink-0" style="-webkit-app-region: no-drag;">
          <!-- Mini Reproductor -->
          <button
            type="button"
            class="h-full w-10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none cursor-pointer"
            title="Modo Mini Reproductor"
            aria-label="Modo Mini Reproductor"
            (click)="controls.toggleMiniPlayer(true)"
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <rect
                x="11"
                y="9"
                width="9"
                height="7"
                rx="1"
                fill="currentColor"
                fill-opacity="0.35"
              />
            </svg>
          </button>

          <!-- Minimizar -->
          <button
            type="button"
            class="h-full w-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none cursor-pointer"
            title="Minimizar (Mini Reproductor)"
            aria-label="Minimizar a Mini Reproductor"
            (click)="controls.minimize()"
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <!-- Maximizar / Restaurar -->
          <button
            type="button"
            class="h-full w-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none cursor-pointer"
            [title]="controls.isMaximized() ? 'Restaurar' : 'Maximizar'"
            aria-label="Maximizar o restaurar ventana"
            (click)="controls.maximize()"
          >
            @if (controls.isMaximized()) {
              <!-- Ícono Restaurar (dos cuadros superpuestos) -->
              <svg
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M8 4h10a2 2 0 0 1 2 2v10" />
                <rect x="4" y="8" width="12" height="12" rx="1.5" />
              </svg>
            } @else {
              <!-- Ícono Maximizar (un cuadro) -->
              <svg
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            }
          </button>

          <!-- Cerrar (Rojo estilo Windows 11 Fluent) -->
          <button
            type="button"
            class="h-full w-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#c42b1c] active:bg-[#b02316] transition-colors focus:outline-none cursor-pointer"
            title="Cerrar"
            aria-label="Cerrar ventana"
            (click)="controls.close()"
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
      }
    </header>
  `,
})
export class TitleBarComponent {
  readonly $title = input<string>('Pulso');
  readonly controls = inject(WindowControlsService);

  onDoubleClick(): void {
    this.controls.maximize();
  }
}
