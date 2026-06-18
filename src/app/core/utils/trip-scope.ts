import { Trip } from '../models/trip.model';

export type TripScope = 'nacional' | 'internacional';

/** Estados brasileiros + termos que indicam destino nacional. */
const BRAZIL_HINTS = [
  'brasil', 'brazil',
  'acre', 'alagoas', 'amapa', 'amazonas', 'bahia', 'ceara', 'distrito federal',
  'espirito santo', 'goias', 'maranhao', 'mato grosso', 'minas gerais', 'para',
  'paraiba', 'parana', 'pernambuco', 'piaui', 'rio de janeiro', 'rio grande',
  'rondonia', 'roraima', 'santa catarina', 'sao paulo', 'sergipe', 'tocantins',
  'aparecida', 'caraca', 'canela', 'gramado'
];

function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Decide o escopo (nacional/internacional) de uma viagem.
 *
 * Usa o campo explícito `trip.scope` quando presente (fonte de verdade gravada
 * pelo admin). Para documentos legados sem o campo, infere por `country`/
 * `destination`: bate com termos brasileiros → 'nacional', senão 'internacional'.
 */
type TripScopeFields = Partial<Pick<Trip, 'scope' | 'country' | 'destination' | 'slug'>>;

export function tripScope(trip: TripScopeFields): TripScope {
  if (trip.scope === 'nacional' || trip.scope === 'internacional') {
    return trip.scope;
  }
  return inferTripScope(trip);
}

/** Inferência pura por país/destino (sem considerar `trip.scope`). */
export function inferTripScope(trip: TripScopeFields): TripScope {
  const haystack = `${normalize(trip.country || '')} ${normalize(trip.destination || '')}`;
  return BRAZIL_HINTS.some(hint => haystack.includes(hint)) ? 'nacional' : 'internacional';
}

/** Caminho canônico público da viagem (com barra final, igual ao WordPress). */
export function tripCanonicalPath(trip: TripScopeFields): string {
  const base = tripScope(trip) === 'nacional' ? 'roteiros-nacionais' : 'roteiros-internacionais';
  return `/${base}/${trip.slug}/`;
}
