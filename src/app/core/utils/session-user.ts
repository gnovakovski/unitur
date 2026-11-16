import type { SessionUser } from '../services/auth.service';
import { ModuleKey } from '../models/user.model';

/** O que importa da conta do Firebase Auth para montar a sessão. */
export interface AuthAccount {
  uid: string;
  displayName?: string | null;
  email?: string | null;
}

/** Campos do documento `users/{uid}` usados pela sessão. */
export interface StoredProfile {
  name?: string;
  role?: string;
  status?: string;
  permissions?: unknown;
}

/**
 * Usuário da sessão do painel a partir do perfil gravado em `users/{uid}`.
 *
 * Só quem tem perfil ativo recebe acesso. Conta sem perfil ou desativada entra
 * sem nenhum módulo, e a tela de login a desconecta. O cadastro de contas do
 * Firebase Auth é aberto (o painel cria usuários pelo SDK do navegador), então
 * "estar logado" não prova que a pessoa é da equipe. As regras do Firestore
 * (firestore.rules) aplicam o mesmo critério no servidor.
 *
 * Perfil sem `role` vale como admin, igual às regras: perfis só são criados por
 * administradores, e os mais antigos não tinham esse campo.
 */
export function sessionUserFromProfile(account: AuthAccount, profile: StoredProfile | null): SessionUser {
  const email = account.email || '';
  const fallbackName = account.displayName || email || 'Usuário';

  if (!profile || profile.status === 'inactive') {
    return { id: account.uid, name: profile?.name || fallbackName, email, role: 'none', permissions: [] };
  }

  return {
    id: account.uid,
    name: profile.name || fallbackName,
    email,
    role: profile.role || 'admin',
    permissions: Array.isArray(profile.permissions) ? profile.permissions as ModuleKey[] : []
  };
}
