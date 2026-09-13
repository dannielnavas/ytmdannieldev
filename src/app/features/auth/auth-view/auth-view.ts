import { Component, inject, OnInit, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideAudioLines,
  LucideHeart,
  LucideMoon,
  LucideMusic,
  LucideStar,
  LucideSun,
} from '@lucide/angular';
import { Auth } from '../../../core/services/auth/auth';

@Component({
  selector: 'app-auth-view',
  standalone: true,
  imports: [
    NgOptimizedImage,
    LucideHeart,
    LucideMusic,
    LucideAudioLines,
    LucideStar,
    LucideSun,
    LucideMoon,
  ],
  template: `
    @let isLoading = $isLoading();
    @let errorMessage = $errorMessage();
    @let isDark = $isDark();

    <div
      class="relative flex items-center justify-center min-h-screen w-full bg-background text-text-primary transition-colors duration-200 p-4"
    >
      <!-- Botón de cambio de tema rápido -->
      <button
        type="button"
        (click)="toggleTheme()"
        class="absolute top-5 right-5 p-2.5 rounded-xl bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
        [title]="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      >
        @if (isDark) {
          <svg lucideSun class="w-4 h-4 text-warning"></svg>
        } @else {
          <svg lucideMoon class="w-4 h-4 text-text-secondary"></svg>
        }
      </button>

      <!-- Tarjeta principal de autenticación -->
      <div
        class="w-full max-w-md bg-surface border border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-6 shadow-xl transition-colors duration-200"
      >
        <div class="flex flex-col items-center text-center">
          <img
            [ngSrc]="'logo.png'"
            alt="Logo Sonara"
            width="92"
            height="92"
            priority
            class="mb-3 drop-shadow-sm"
          />
          <h2 class="text-3xl font-extrabold tracking-tight text-text-primary">SONARA</h2>
          <p class="text-sm font-medium text-text-secondary mt-1">
            Tu reproductor personal de YouTube Music
          </p>
        </div>

        <section class="flex flex-col items-center justify-center text-center">
          <h3 class="text-xl font-bold text-text-primary mb-1.5">¡Bienvenido de nuevo!</h3>
          <p class="text-sm text-text-secondary text-balance max-w-xs">
            Inicia sesión para acceder a tu música, playlists y recomendaciones personalizadas.
          </p>
        </section>

        <!-- Botón de Inicio con Google -->
        <button
          type="button"
          (click)="login()"
          [disabled]="isLoading"
          class="w-full flex items-center justify-center gap-3 bg-surface hover:bg-surface-hover text-text-primary font-medium py-3 px-4 border border-border rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out cursor-pointer"
        >
          <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          @if (!isLoading) {
            <span>Iniciar sesión con Google</span>
          } @else {
            <span class="flex items-center gap-2">
              <svg
                class="animate-spin h-4 w-4 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Conectando...
            </span>
          }
        </button>

        @if (errorMessage) {
          <div
            class="w-full bg-error/10 border border-error/20 text-error text-xs rounded-lg p-3 text-center"
          >
            {{ errorMessage }}
          </div>
        }

        <hr class="w-full border-border my-1" />

        <!-- Características destacadas -->
        <section class="grid grid-cols-4 gap-2 w-full pt-1">
          <article class="flex flex-col items-center justify-center text-center group">
            <div
              class="bg-surface-elevated group-hover:bg-surface-hover text-text-secondary group-hover:text-primary p-2.5 rounded-full border border-border transition-colors"
            >
              <svg lucideMusic color="#ef476f" class="w-4 h-4"></svg>
            </div>
            <p class="text-center text-[11px] text-text-secondary mt-1.5 leading-tight">
              Canciones
            </p>
          </article>

          <article class="flex flex-col items-center justify-center text-center group">
            <div
              class="bg-surface-elevated group-hover:bg-surface-hover text-text-secondary group-hover:text-primary p-2.5 rounded-full border border-border transition-colors"
            >
              <svg lucideHeart color="#ffd166" class="w-4 h-4"></svg>
            </div>
            <p class="text-center text-[11px] text-text-secondary mt-1.5 leading-tight">
              Favoritos
            </p>
          </article>

          <article class="flex flex-col items-center justify-center text-center group">
            <div
              class="bg-surface-elevated group-hover:bg-surface-hover text-text-secondary group-hover:text-primary p-2.5 rounded-full border border-border transition-colors"
            >
              <svg lucideAudioLines color="#06d6a0" class="w-4 h-4"></svg>
            </div>
            <p class="text-center text-[11px] text-text-secondary mt-1.5 leading-tight">
              Alta fidelidad
            </p>
          </article>

          <article class="flex flex-col items-center justify-center text-center group">
            <div
              class="bg-surface-elevated group-hover:bg-surface-hover text-text-secondary group-hover:text-primary p-2.5 rounded-full border border-border transition-colors"
            >
              <svg lucideStar color="#118ab2" class="w-4 h-4"></svg>
            </div>
            <p class="text-center text-[11px] text-text-secondary mt-1.5 leading-tight">
              Populares
            </p>
          </article>
        </section>

        <!-- Pie de página -->
        <footer class="text-center text-xs text-text-muted mt-2 text-balance">
          <p class="text-text-muted">
            Al iniciar sesión, aceptas nuestros <br />
            <a
              href="#"
              class="text-primary hover:text-primary-hover underline underline-offset-2 transition-colors"
              >Términos de Servicio</a
            >
            y
            <a
              href="#"
              class="text-primary hover:text-primary-hover underline underline-offset-2 transition-colors"
              >Política de Privacidad</a
            >
          </p>
        </footer>
      </div>
    </div>
  `,
  styles: [``],
})
export class AuthViewComponent implements OnInit {
  private readonly _auth = inject(Auth);
  private readonly _router = inject(Router);

  public $isLoading = signal(false);
  public $errorMessage = signal('');
  public $isDark = signal(false);

  ngOnInit(): void {
    this.loadModes();
  }

  public loadModes(): void {
    if (typeof window !== 'undefined') {
      const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
      const prefersDark =
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : false;
      const shouldBeDark =
        savedTheme === 'dark' ||
        (!savedTheme && prefersDark) ||
        document?.documentElement?.classList.contains('dark');

      this.$isDark.set(!!shouldBeDark);
      if (document?.documentElement) {
        if (shouldBeDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
      }
    }
  }

  public toggleTheme(): void {
    const next = !this.$isDark();
    this.$isDark.set(next);

    if (next) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }

  async login() {
    this.$isLoading.set(true);
    this.$errorMessage.set('');

    try {
      if (!window.electronAPI?.loginWithGoogle) {
        throw new Error('La API de Electron no está disponible en este entorno.');
      }
      const cookies = await window.electronAPI.loginWithGoogle();
      this.loginWithGoogle(cookies);
    } catch (error) {
      console.error(error);
      this.$errorMessage.set('No se pudo completar el inicio de sesión. Inténtalo de nuevo.');
    } finally {
      this.$isLoading.set(false);
    }
  }

  private loginWithGoogle(cookies: string): void {
    console.log(cookies);
    this._auth.login(cookies).subscribe({
      next: (res) => {
        this._router.navigate(['/home']);
      },
      error: (err) => {
        console.error(err);
        this.$errorMessage.set('No se pudo completar el inicio de sesión. Inténtalo de nuevo.');
      },
      complete: () => {
        this.$isLoading.set(false);
      },
    });
  }
}
