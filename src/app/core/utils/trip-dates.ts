/** Datas civis de roteiros, sem deslocar datas ISO para o dia anterior no Brasil. */
export function formatTripDate(value: Date | string | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

/**
 * Datas exibidas na página (e no PDF) do roteiro.
 *
 * Quando a viagem tem data de início e de fim diferentes, mostra o intervalo.
 * Hoje o cadastro só tem o campo de data de início — a data final é gravada
 * igual a ela — e o intervalo completo fica no campo "Data da Viagem"
 * (`period`, ex.: "21/04/27 a 01/05/27"). Por isso, sem um intervalo de verdade
 * nas datas, vale o período digitado: mostrar só o dia de início escondia a
 * data de volta. A data sozinha fica para viagens sem período preenchido.
 */
export function formatTripDates(start?: Date | string, end?: Date | string, period?: string): string {
  const first = formatTripDate(start);
  const last = formatTripDate(end);
  if (first && last && first !== last) return `${first} a ${last}`;
  return period?.trim() || first || last || 'A definir';
}
