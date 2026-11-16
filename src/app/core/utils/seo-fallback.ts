import { Trip } from '../models/trip.model';
import { Post } from '../models/post.model';

/** Corta um texto em ~limit caracteres sem quebrar palavra, p/ meta description. */
export function truncateForMeta(value: string, limit = 160): string {
  const clean = (value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
}

export interface ResolvedSeo {
  title: string;
  description: string;
  image: string;
}

/** Abaixo disto a chamada curta sozinha não descreve a viagem (costuma ser só a data). */
const MIN_USEFUL_DESCRIPTION = 70;

/**
 * Descrição de uma viagem para o Google.
 *
 * Usa a "meta description" cadastrada, quando existe. Sem ela, usa a chamada
 * curta — mas em muitas viagens a chamada é só o período ("21/04/27 a 01/05/27
 * - 11 dias"), o que não diz nada sobre o roteiro e se repete entre viagens.
 * Nesses casos completa com o começo da descrição.
 */
export function tripMetaDescription(
  trip: Partial<Pick<Trip, 'metaDescription' | 'shortDescription' | 'description'>>
): string {
  const custom = (trip.metaDescription || '').trim();
  if (custom) return truncateForMeta(custom);

  const short = truncateForMeta(trip.shortDescription || '', Infinity);
  // Marcadores de lista ("• Terra Santa: ...") não fazem sentido em uma frase corrida.
  const long = truncateForMeta((trip.description || '').replace(/[•●▪■◦]/g, ' '), Infinity);

  if (!long || short.length >= MIN_USEFUL_DESCRIPTION) return truncateForMeta(short || long);
  if (!short) return truncateForMeta(long);
  return truncateForMeta(`${short}${/[.!?:;]$/.test(short) ? '' : '.'} ${long}`);
}

/** Resolve title/description/image de uma viagem com fallback automático. */
export function tripSeo(trip: Trip): ResolvedSeo {
  return {
    title: (trip.metaTitle || trip.title || '').trim(),
    description: tripMetaDescription(trip),
    image: (trip.ogImage || trip.mainImage || '').trim()
  };
}

/** Resolve title/description/image de um post com fallback automático. */
export function postSeo(post: Post): ResolvedSeo {
  return {
    title: (post.metaTitle || post.title || '').trim(),
    description: truncateForMeta(post.metaDescription || post.excerpt || post.content || ''),
    image: (post.ogImage || post.featuredImage || post.contentImages?.[0] || '').trim()
  };
}
