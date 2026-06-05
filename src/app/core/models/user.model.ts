/**
 * Chaves dos módulos administráveis do painel.
 * Cada usuário (que não seja admin) recebe a lista de módulos que pode acessar.
 * A fonte de verdade com rótulos/ícones/rotas fica em `modules.config.ts`.
 */
export type ModuleKey =
  | 'viagens'
  | 'moeda'
  | 'posts'
  | 'categorias'
  | 'depoimentos'
  | 'conteudo'
  | 'banners'
  | 'usuarios';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  /**
   * Módulos liberados para o usuário. Ignorado quando `role === 'admin'`
   * (admin tem acesso a tudo). Ausente em contas antigas — ver fallback no
   * AuthService.
   */
  permissions?: ModuleKey[];
  status: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}
