import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  // Public routes
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'viagens',
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  {
    path: 'viagens/peregrinacao',
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  {
    path: 'viagens/regulares',
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  {
    path: 'viagens/curadoria',
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  {
    path: 'viagens/:slug',
    loadComponent: () => import('./features/product/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'blog',
    loadComponent: () => import('./features/blog/blog-list.component').then(m => m.BlogListComponent)
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./features/blog/blog-detail.component').then(m => m.BlogDetailComponent)
  },

  // Admin routes
  {
    path: 'administrador',
    loadComponent: () => import('./features/admin/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'viagens',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        redirectTo: 'viagens',
        pathMatch: 'full'
      },
      {
        path: 'posts',
        loadComponent: () => import('./features/admin/posts/posts-list.component').then(m => m.PostsListComponent)
      },
      {
        path: 'posts/novo',
        loadComponent: () => import('./features/admin/posts/post-form.component').then(m => m.PostFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'posts/:id/editar',
        loadComponent: () => import('./features/admin/posts/post-form.component').then(m => m.PostFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'viagens/nova',
        loadComponent: () => import('./features/admin/viagens/viagem-form.component').then(m => m.ViagemFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'viagens/:id/editar',
        loadComponent: () => import('./features/admin/viagens/viagem-form.component').then(m => m.ViagemFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'viagens',
        loadComponent: () => import('./features/admin/viagens/viagens-list.component').then(m => m.ViagensListComponent)
      },
      {
        path: 'categorias',
        loadComponent: () => import('./features/admin/categorias/categorias-list.component').then(m => m.CategoriasListComponent)
      },
      {
        path: 'banners',
        loadComponent: () => import('./features/admin/banners/banners-list.component').then(m => m.BannersListComponent)
      },
      {
        path: 'depoimentos',
        loadComponent: () => import('./features/admin/depoimentos/depoimentos-list.component').then(m => m.DepoimentosListComponent)
      }
    ]
  },

  {
    path: '**',
    redirectTo: ''
  }
];
