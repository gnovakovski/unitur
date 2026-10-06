import { Post } from '../models/post.model';

/**
 * Assinaturas disponíveis no formulário de post. A primeira é a padrão para
 * posts novos e substitui o antigo "Administrador" fixo no código.
 */
export const POST_AUTHOR_OPTIONS = ['Equipe Unitur', 'Unitur', 'Teresa Breda', 'Cibele Lana'] as const;
export const DEFAULT_POST_AUTHOR: string = POST_AUTHOR_OPTIONS[0];

const INSTITUTIONAL_AUTHORS = new Set(['equipe unitur', 'unitur']);

/** Nomes que não são uma assinatura real (valor técnico gravado por versões antigas do admin). */
const PLACEHOLDER_AUTHORS = new Set(['', 'administrador', 'admin']);

export function isPlaceholderAuthor(name?: string | null): boolean {
  return PLACEHOLDER_AUTHORS.has(String(name || '').trim().toLowerCase());
}

/** Nome exibido como autor do post; placeholders viram a assinatura padrão. */
export function postAuthorName(post: Pick<Post, 'author'> | null | undefined): string {
  const name = String(post?.author?.name || '').trim();
  return isPlaceholderAuthor(name) ? DEFAULT_POST_AUTHOR : name;
}

/** Assinaturas institucionais são marcadas como Organization (e não Person) no JSON-LD. */
export function isInstitutionalAuthor(name: string): boolean {
  return INSTITUTIONAL_AUTHORS.has(name.trim().toLowerCase());
}
