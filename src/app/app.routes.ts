import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { viagensCategoryMatcher } from './core/routing/viagens-category.matcher';

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
    matcher: viagensCategoryMatcher,
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
      },
      {
        path: 'conteudo',
        loadComponent: () => import('./features/admin/conteudo/conteudo-hub.component').then(m => m.ConteudoHubComponent)
      },
      {
        path: 'conteudo/cabecalho',
        loadComponent: () => import('./features/admin/conteudo/cabecalho-form.component').then(m => m.CabecalhoFormComponent)
      },
      {
        path: 'conteudo/contato',
        loadComponent: () => import('./features/admin/conteudo/contato-form.component').then(m => m.ContatoFormComponent)
      },
      {
        path: 'conteudo/home',
        loadComponent: () => import('./features/admin/conteudo/home-form.component').then(m => m.HomeFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'conteudo/rodape',
        loadComponent: () => import('./features/admin/conteudo/footer-form.component').then(m => m.FooterFormComponent)
      },
      {
        path: 'conteudo/sobre',
        loadComponent: () => import('./features/admin/sobre/sobre-form.component').then(m => m.SobreFormComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/admin/usuarios/usuarios-list.component').then(m => m.UsuariosListComponent)
      },
      {
        path: 'sobre',
        redirectTo: 'conteudo/sobre',
        pathMatch: 'full'
      }
    ]
  },

  {
    path: '**',
    redirectTo: ''
  }
];
