import { Routes } from '@angular/router';
import { MainLayout } from './features/shell/components/main-layout/main-layout';
import { AuthViewComponent } from './features/auth/auth-view/auth-view';
import { authorizationGuard } from './core/guards/authorization-guard';
import { redirectInterceptor } from './core/interceptors/redirect-interceptor';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/auth/auth-view/auth-view').then((m) => m.AuthViewComponent),
        canActivate: [redirectInterceptor],
      },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
        canActivate: [authorizationGuard],
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./features/list-search/page/list-search/list-search').then((m) => m.ListSearch),
        canActivate: [authorizationGuard],
      },
      {
        path: 'playlist',
        loadComponent: () =>
          import('./features/playlist/pages/playlist/playlist').then((m) => m.Playlist),
        canActivate: [authorizationGuard],
      },
      {
        path: 'album',
        loadComponent: () => import('./features/album/pages/album/album').then((m) => m.Album),
        canActivate: [authorizationGuard],
      },
      {
        path: 'now-playing',
        loadComponent: () =>
          import('./features/shell/components/now-playing/now-playing').then((m) => m.NowPlaying),
        canActivate: [authorizationGuard],
      },
    ],
  },
];
