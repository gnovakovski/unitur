import { Trip } from '../models/trip.model';
import { HeaderLink, LEGACY_TRIP_TYPE_TO_MENU_ID } from '../models/site-content.model';

type TripMenuSource = Pick<Trip, 'menuIds' | 'tripType'>;

/**
 * Menus (ids de `HeaderLink`) em que a viagem aparece. Viagens antigas, sem
 * `menuIds`, caem no menu equivalente ao `tripType` legado.
 */
export function resolveTripMenuIds(trip: TripMenuSource): string[] {
  const fromTrip = Array.isArray(trip.menuIds) ? trip.menuIds.filter(Boolean) : [];
  if (fromTrip.length) return fromTrip;
  const legacy = LEGACY_TRIP_TYPE_TO_MENU_ID[trip.tripType || 'regular'];
  return legacy ? [legacy] : [];
}

/**
 * Menus ATUAIS (Conteúdo > Cabeçalho) da viagem, na ordem dela.
 *
 * O id do menu nunca muda, mas o admin pode renomeá-lo — o menu `regulares`,
 * por exemplo, hoje se chama "Peregrinações Internacionais". Por isso o texto
 * exibido vem sempre do cabeçalho, nunca de um mapa fixo por `tripType`.
 */
export function tripMenus(trip: TripMenuSource, links: HeaderLink[]): HeaderLink[] {
  return resolveTripMenuIds(trip)
    .map(id => links.find(link => link.id === id))
    .filter((link): link is HeaderLink => !!link);
}

/** Nome da categoria da viagem (primeiro menu dela); genérico se o menu sumiu. */
export function tripMenuLabel(trip: TripMenuSource, links: HeaderLink[]): string {
  return tripMenus(trip, links)[0]?.label || 'Viagens';
}
