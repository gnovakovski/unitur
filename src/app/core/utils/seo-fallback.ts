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

/** Resolve title/description/image de uma viagem com fallback automático. */
export function tripSeo(trip: Trip): ResolvedSeo {
  return {
    title: (trip.metaTitle || trip.title || '').trim(),
    description: truncateForMeta(trip.metaDescription || trip.shortDescription || trip.description || ''),
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
