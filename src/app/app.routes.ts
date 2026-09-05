import { Routes } from '@angular/router';
import { MainLayout } from './features/shell/components/main-layout/main-layout';
import { AuthViewComponent } from './features/auth/auth-view/auth-view';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/auth/auth-view/auth-view').then(m => m.AuthViewComponent),
      },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home').then(m => m.Home),

      }
    ]
  }
];
