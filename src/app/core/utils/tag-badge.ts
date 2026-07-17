import { DEFAULT_TAG_COLOR, TripTag } from '../models/tag.model';

/** Dados prontos para pintar o badge da tag no card / na página da viagem. */
export interface TagBadge {
  label: string;
  background: string;
  textColor: string;
}

/**
 * Texto preto ou branco conforme o brilho da cor de fundo escolhida pelo
 * admin, para a frase não sumir em tags claras (ex.: amarelo).
 */
export function tagTextColor(background: string): string {
  const hex = String(background || '').replace('#', '').trim();
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return '#ffffff';

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Luminância percebida (ITU-R BT.601).
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1a1a1a' : '#ffffff';
}

/**
 * Resolve o badge de uma viagem a partir do `tagId`. Retorna null quando a
 * viagem não tem tag ou quando a tag foi excluída pelo admin — nesse caso o
 * card simplesmente não mostra badge.
 */
export function resolveTagBadge(tagId: number | null | undefined, tags: TripTag[]): TagBadge | null {
  if (tagId === null || tagId === undefined) return null;

  const tag = (tags || []).find(item => Number(item.id) === Number(tagId));
  if (!tag || !tag.label) return null;

  const background = tag.color || DEFAULT_TAG_COLOR;
  return { label: tag.label, background, textColor: tagTextColor(background) };
}
