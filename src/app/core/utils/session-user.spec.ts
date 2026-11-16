import { describe, expect, it } from 'vitest';
import { sessionUserFromProfile } from './session-user';

const account = { uid: 'abc', displayName: 'Maria', email: 'maria@exemplo.com' };

describe('sessionUserFromProfile', () => {
  it('conta sem perfil fica sem acesso (o cadastro do Firebase Auth é aberto)', () => {
    const user = sessionUserFromProfile(account, null);
    expect(user.role).not.toBe('admin');
    expect(user.permissions).toEqual([]);
  });

  it('perfil desativado fica sem acesso, mesmo sendo admin', () => {
    const user = sessionUserFromProfile(account, { role: 'admin', status: 'inactive', permissions: ['posts'] });
    expect(user.role).not.toBe('admin');
    expect(user.permissions).toEqual([]);
  });

  it('perfil ativo usa papel e módulos gravados', () => {
    expect(sessionUserFromProfile(account, { name: 'M. Silva', role: 'editor', status: 'active', permissions: ['posts', 'viagens'] }))
      .toEqual({ id: 'abc', name: 'M. Silva', email: 'maria@exemplo.com', role: 'editor', permissions: ['posts', 'viagens'] });
  });

  it('perfil antigo sem papel vale como admin, igual às regras do Firestore', () => {
    expect(sessionUserFromProfile(account, { name: 'Maria' }).role).toBe('admin');
  });

  it('ignora permissões em formato inválido', () => {
    expect(sessionUserFromProfile(account, { role: 'editor', permissions: 'posts' }).permissions).toEqual([]);
  });
});
