/** Datas civis de roteiros, sem deslocar datas ISO para o dia anterior no Brasil. */
export function formatTripDate(value: Date | string | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

export function formatTripDates(start?: Date | string, end?: Date | string, period?: string): string {
  const first = formatTripDate(start);
  const last = formatTripDate(end);
  if (first && last && first !== last) return `${first} a ${last}`;
  return first || last || period?.trim() || 'A definir';
}
