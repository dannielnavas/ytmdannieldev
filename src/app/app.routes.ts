import { Routes } from '@angular/router';
import { MainLayout } from './features/shell/components/main-layout/main-layout';
import { AuthViewComponent } from './features/auth/auth-view/auth-view';
import { authorizationGuard } from './core/guards/authorization-guard';
import { redirectGuard } from './core/guards/redirect-guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/auth/auth-view/auth-view').then((m) => m.AuthViewComponent),
        canActivate: [redirectGuard],
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
        path: 'playlist/:playlistId',
        loadComponent: () =>
          import('./features/playlist/pages/playlist/playlist').then((m) => m.Playlist),
        canActivate: [authorizationGuard],
      },
      {
        path: 'album/:albumId',
        loadComponent: () => import('./features/album/pages/album/album').then((m) => m.Album),
        canActivate: [authorizationGuard],
      },
      {
        path: 'likes',
        loadComponent: () => import('./features/list-likes/list-likes').then((m) => m.ListLikes),
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
