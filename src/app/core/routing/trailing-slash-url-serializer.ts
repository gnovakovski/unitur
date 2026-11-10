import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/**
 * Mantém a barra final nas URLs do app (`/blog/post/`), no mesmo formato do
 * WordPress antigo, do canonical e do `trailingSlash: true` da Vercel.
 *
 * Por padrão o Angular serializa sem a barra. Ao abrir `/blog/post/`, ele
 * reescrevia o endereço para `/blog/post` via `history.replaceState`. O GA4
 * (medição otimizada, "mudanças no histórico do navegador") entendia essa troca
 * como uma página nova e registrava 2 page_views por entrada no site. Os links
 * internos também saíam sem a barra e passavam por um redirect 308 da Vercel.
 */
export class TrailingSlashUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    // O parser padrão transformaria a barra final num segmento vazio extra.
    return super.parse(stripTrailingSlash(url));
  }

  override serialize(tree: UrlTree): string {
    return addTrailingSlash(super.serialize(tree));
  }
}

function splitPath(url: string): [string, string] {
  const index = url.search(/[?#]/);
  return index === -1 ? [url, ''] : [url.slice(0, index), url.slice(index)];
}

/** `/blog/post/?q=1` → `/blog/post?q=1`. A raiz `/` fica como está. */
export function stripTrailingSlash(url: string): string {
  const [path, rest] = splitPath(url);
  if (path.length <= 1 || !path.endsWith('/')) return url;
  return (path.replace(/\/+$/, '') || '/') + rest;
}

/** `/blog/post?q=1` → `/blog/post/?q=1`. Não mexe em arquivos (`/x.xml`) nem em outlets nomeados. */
export function addTrailingSlash(url: string): string {
  const [path, rest] = splitPath(url);
  if (!path || path.endsWith('/') || path.includes('(')) return url;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return url;
  return `${path}/${rest}`;
}
