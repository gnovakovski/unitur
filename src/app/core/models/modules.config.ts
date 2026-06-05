import { ModuleKey } from './user.model';

export interface AdminModule {
  key: ModuleKey;
  label: string;
  /**
   * Rota do módulo no painel. Módulos sem rota (ex.: `moeda`) são acessados
   * por um botão dentro de outra tela e por isso não aparecem no menu lateral.
   */
  route?: string;
  /** Chave do ícone usada pelo switch em admin-layout.component.html. */
  icon: string;
}

/**
 * Fonte única de verdade dos módulos administráveis. Usada pelo menu lateral,
 * pelos guards de rota e pelo formulário de permissões do usuário — evita
 * listas duplicadas espalhadas pelo código.
 *
 * A ORDEM define a prioridade do redirect pós-login (primeiro módulo permitido
 * com rota).
 */
export const ADMIN_MODULES: AdminModule[] = [
  { key: 'viagens',     label: 'Viagens',           route: '/admin/viagens',     icon: 'trip' },
  { key: 'moeda',       label: 'Cotações de câmbio', /* sem rota: botão em Viagens */ icon: 'currency' },
  { key: 'posts',       label: 'Posts',             route: '/admin/posts',       icon: 'post' },
  { key: 'categorias',  label: 'Categorias',        route: '/admin/categorias',  icon: 'tag' },
  { key: 'depoimentos', label: 'Depoimentos',       route: '/admin/depoimentos', icon: 'quote' },
  { key: 'conteudo',    label: 'Conteúdo do site',  route: '/admin/conteudo',    icon: 'content' },
  { key: 'banners',     label: 'Banners',           route: '/admin/banners',     icon: 'banner' },
  { key: 'usuarios',    label: 'Usuários',          route: '/admin/usuarios',    icon: 'user' }
];

/** Lista de módulos que aparecem no menu lateral (apenas os que têm rota). */
export const MENU_MODULES: AdminModule[] = ADMIN_MODULES.filter(m => !!m.route);
