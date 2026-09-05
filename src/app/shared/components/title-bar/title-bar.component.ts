import { Component, inject, input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { WindowControlsService } from '../../../core/services/window-controls.service';

@Component({
  selector: 'app-title-bar',
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <header
      class="h-9 w-full bg-[#0f0f0f] text-neutral-300 border-b border-white/5 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-50 text-xs font-medium"
      style="-webkit-app-region: drag;"
      (dblclick)="onDoubleClick()"
    >
      <!-- Logo y Título -->
      <div class="flex items-center gap-2 px-3 h-full overflow-hidden pointer-events-none">
        <!-- Ícono estilo YouTube Music -->
        <img ngSrc="logo.png" alt="Logo sonara" width="24" height="24" class="rounded-sm" />
        <span class="truncate tracking-wide text-neutral-200 text-xs font-semibold">
          {{ $title() }}
        </span>
      </div>

      <!-- Botones de Control de Ventana -->
      <div class="flex items-center h-full shrink-0" style="-webkit-app-region: no-drag;">
        <!-- Minimizar -->
        <button
          type="button"
          class="h-full w-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
          title="Minimizar"
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
          class="h-full w-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
          [title]="controls.isMaximized() ? 'Restaurar' : 'Maximizar'"
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

        <!-- Cerrar -->
        <button
          type="button"
          class="h-full w-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-red-600 transition-colors focus:outline-none"
          title="Cerrar"
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
    </header>
  `,
})
export class TitleBarComponent {
  readonly $title = input<string>('Sonara');
  readonly controls = inject(WindowControlsService);

  onDoubleClick(): void {
    this.controls.maximize();
  }
}
