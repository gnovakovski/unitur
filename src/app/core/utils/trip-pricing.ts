import { Trip } from '../models/trip.model';
import { ForeignCurrencyCode, formatForeignAmount, parseForeignAmount } from './currency-format';

/** Só os campos de preço de uma viagem — o cálculo não precisa do resto. */
export type TripPriceFields = Partial<
  Pick<Trip, 'price' | 'foreignPrice' | 'foreignCurrency' | 'foreignExchangeRate'>
>;

export interface ResolvedTripPrice {
  /** Preço em reais a exibir. */
  brl: number;
  /** Valor na moeda estrangeira exatamente como foi cadastrado. null = viagem só em R$. */
  foreign: number | null;
  /** Código da moeda estrangeira ('' quando a viagem é só em reais). */
  currency: ForeignCurrencyCode | '';
  /** Cotação que gerou o `brl`. null quando o par veio congelado do cadastro. */
  rate: number | null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positive(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * Resolve os DOIS valores exibidos de uma viagem a partir de uma única fonte de
 * verdade: o valor em moeda estrangeira cadastrado no admin.
 *
 * O preço em reais é sempre derivado (`valor estrangeiro × cotação atual`) e
 * nunca lido do `price` gravado. Isso é o que garante que o site mostre o mesmo
 * par que o admin vê no formulário mesmo depois de alguém atualizar a cotação em
 * "Cotações de câmbio" — antes, o R$ ficava congelado no câmbio do dia do
 * cadastro e o valor em dólar era recalculado por cima dele, então os dois
 * números divergiam do que estava cadastrado.
 *
 * `trip.price` continua sendo gravado e é usado como fallback em dois casos:
 *  - viagem sem moeda estrangeira (preço em reais digitado à mão);
 *  - nenhuma cotação disponível (moeda removida da tabela e sem cotação gravada).
 */
export function computeTripPrice(trip: TripPriceFields, currentRate: number | null): ResolvedTripPrice {
  const storedBrl = positive(trip.price) ?? 0;
  const currency = String(trip.foreignCurrency || '').trim();
  const foreign = parseForeignAmount(trip.foreignPrice);

  if (!currency || !foreign) {
    return { brl: storedBrl, foreign: null, currency: '', rate: null };
  }

  // Cotação atual; se a moeda saiu da tabela, usa a gravada no último save.
  const rate = positive(currentRate) ?? positive(trip.foreignExchangeRate);

  if (!rate) {
    // Sem cotação nenhuma: mantém o par congelado do cadastro.
    return { brl: storedBrl, foreign, currency, rate: null };
  }

  return { brl: round2(foreign * rate), foreign, currency, rate };
}

/** "R$27.245,40" — formato usado nos cards e no painel de reserva. */
export function formatTripBRL(value: number): string {
  const numeric = positive(value);
  if (!numeric) return 'Consulte';
  return `R$${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "US$ 4.990,00" — vazio quando a viagem não tem valor em moeda estrangeira. */
export function formatTripForeign(resolved: ResolvedTripPrice): string {
  if (!resolved.foreign || !resolved.currency) return '';
  return formatForeignAmount(resolved.foreign, resolved.currency);
}
