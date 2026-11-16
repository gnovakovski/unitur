import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { viagensMenuGuard } from './core/routing/viagens-menu.guard';

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
  // Paridade com o WordPress antigo: /sobre/sobre-a-unitur e /contato
  {
    path: 'sobre/sobre-a-unitur',
    loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'contato',
    loadComponent: () => import('./features/contato/contato.component').then(m => m.ContatoComponent)
  },
  {
    path: 'viagens',
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  // Listagem por categoria, padrão WordPress: /categoria-internacional/<cat>
  {
    path: 'categoria-internacional/:cat',
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  // /viagens/<slug> é a listagem de um menu do cabeçalho quando <slug> é de um
  // menu cadastrado (viagensMenuGuard); senão cai na rota de detalhe, mais abaixo.
  {
    path: 'viagens/:slug',
    canMatch: [viagensMenuGuard],
    loadComponent: () => import('./features/viagens/viagens.component').then(m => m.ViagensComponent)
  },
  // Detalhe da viagem nos caminhos do WordPress antigo (preserva ranking).
  // O canonical é resolvido por `scope` dentro do ProductDetailComponent.
  {
    path: 'roteiros-internacionais/:slug',
    loadComponent: () => import('./features/product/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'roteiros-nacionais/:slug',
    loadComponent: () => import('./features/product/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'viagens/:slug',
    loadComponent: () => import('./features/product/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'blog',
    loadComponent: () => import('./features/blog/blog-list.component').then(m => m.BlogListComponent)
  },
  // Paginação e categorias do blog no padrão WordPress.
  {
    path: 'blog/page/:page',
    loadComponent: () => import('./features/blog/blog-list.component').then(m => m.BlogListComponent)
  },
  {
    path: 'blog/categoria/:cat',
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
        canActivate: [permissionGuard('posts')],
        loadComponent: () => import('./features/admin/posts/posts-list.component').then(m => m.PostsListComponent)
      },
      {
        path: 'posts/novo',
        canActivate: [permissionGuard('posts')],
        loadComponent: () => import('./features/admin/posts/post-form.component').then(m => m.PostFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'posts/:id/editar',
        canActivate: [permissionGuard('posts')],
        loadComponent: () => import('./features/admin/posts/post-form.component').then(m => m.PostFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'viagens/nova',
        canActivate: [permissionGuard('viagens')],
        loadComponent: () => import('./features/admin/viagens/viagem-form.component').then(m => m.ViagemFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'viagens/:id/editar',
        canActivate: [permissionGuard('viagens')],
        loadComponent: () => import('./features/admin/viagens/viagem-form.component').then(m => m.ViagemFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'viagens',
        canActivate: [permissionGuard('viagens')],
        loadComponent: () => import('./features/admin/viagens/viagens-list.component').then(m => m.ViagensListComponent)
      },
      {
        path: 'moeda',
        canActivate: [permissionGuard('moeda')],
        loadComponent: () => import('./features/admin/moeda/moeda.component').then(m => m.MoedaComponent)
      },
      {
        path: 'categorias',
        canActivate: [permissionGuard('categorias')],
        loadComponent: () => import('./features/admin/categorias/categorias-list.component').then(m => m.CategoriasListComponent)
      },
      {
        path: 'banners',
        canActivate: [permissionGuard('banners')],
        loadComponent: () => import('./features/admin/banners/banners-list.component').then(m => m.BannersListComponent)
      },
      {
        path: 'depoimentos',
        canActivate: [permissionGuard('depoimentos')],
        loadComponent: () => import('./features/admin/depoimentos/depoimentos-list.component').then(m => m.DepoimentosListComponent)
      },
      {
        path: 'conteudo',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/conteudo/conteudo-hub.component').then(m => m.ConteudoHubComponent)
      },
      {
        path: 'conteudo/cabecalho',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/conteudo/cabecalho-form.component').then(m => m.CabecalhoFormComponent)
      },
      {
        path: 'conteudo/newsletter',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/conteudo/newsletter-list.component').then(m => m.NewsletterListComponent)
      },
      {
        path: 'conteudo/contato',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/conteudo/contato-form.component').then(m => m.ContatoFormComponent)
      },
      {
        path: 'conteudo/home',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/conteudo/home-form.component').then(m => m.HomeFormComponent),
        canDeactivate: [unsavedChangesGuard]
      },
      {
        path: 'conteudo/rodape',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/conteudo/footer-form.component').then(m => m.FooterFormComponent)
      },
      {
        path: 'conteudo/sobre',
        canActivate: [permissionGuard('conteudo')],
        loadComponent: () => import('./features/admin/sobre/sobre-form.component').then(m => m.SobreFormComponent)
      },
      {
        path: 'usuarios',
        canActivate: [permissionGuard('usuarios')],
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
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
