/**
 * Código de moeda estrangeira (ex.: USD, EUR, GBP, ARS...).
 * Aberto para qualquer string porque a lista de moedas é configurada
 * dinamicamente pelo admin em "Cotações de câmbio".
 */
export type ForeignCurrencyCode = string;

const defaultSymbols: Record<string, string> = {
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  BRL: 'R$',
  ARS: 'AR$',
  CAD: 'CA$',
  AUD: 'AU$',
  JPY: '¥',
  CHF: 'CHF'
};

const currencyPatterns: Array<{ patterns: RegExp[]; code: string }> = [
  { patterns: [/eur/i, /€/], code: 'EUR' },
  { patterns: [/gbp/i, /£/], code: 'GBP' },
  { patterns: [/usd/i, /us\$/i, /u\$/i, /\$/], code: 'USD' }
];

/** Permite que o app registre símbolos personalizados em runtime. */
const runtimeSymbols: Record<string, string> = {};

export function registerCurrencySymbol(code: string, symbol: string): void {
  if (!code || !symbol) return;
  runtimeSymbols[code.toUpperCase()] = symbol;
}

export function getCurrencySymbol(code: ForeignCurrencyCode | ''): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  return runtimeSymbols[upper] || defaultSymbols[upper] || upper;
}

export function formatForeignAmount(amount: number, currency: ForeignCurrencyCode): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return `${getCurrencySymbol(currency)} ${amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function parseForeignAmount(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  return parseCurrencyAmount(String(value));
}

export function formatForeignCurrency(value?: number | string, currency?: ForeignCurrencyCode | ''): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const code = currency || getCurrencyCode(value);
  const symbol = getCurrencySymbol(code);
  const amount = typeof value === 'number' ? value : parseCurrencyAmount(value);

  if (amount === null) {
    const text = String(value).trim();
    return text ? normalizeCurrencyPrefix(text, symbol) : '';
  }

  return `${symbol} ${amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function getCurrencyCode(value: number | string): ForeignCurrencyCode {
  return detectCurrencyCode(value) || 'USD';
}

/**
 * Igual a `getCurrencyCode`, mas devolve '' quando o valor não traz símbolo nem
 * código de moeda. Use esta quando assumir dólar por engano teria efeito colateral
 * (ex.: recalcular o preço em reais de uma viagem antiga gravada só com número).
 */
export function detectCurrencyCode(value: number | string): ForeignCurrencyCode | '' {
  if (typeof value === 'number') {
    return '';
  }

  const text = String(value || '').trim();
  return currencyPatterns.find(currency => currency.patterns.some(pattern => pattern.test(text)))?.code || '';
}

/**
 * Lê um valor monetário digitado, aceitando pt-BR ("1.500,00") e en ("1,500.00").
 *
 * Regras:
 *  - com os dois separadores, o último é o decimal e o outro é milhar;
 *  - com um separador repetido ("12.345.678"), tudo é milhar;
 *  - com um separador único, só vale como decimal se sobrarem 1 ou 2 casas —
 *    "1.500" e "4,990" são milhar, porque preço não tem 3 casas decimais.
 */
function parseCurrencyAmount(value: string): number | null {
  const numericText = value.replace(/[^\d.,-]/g, '');

  if (!numericText) {
    return null;
  }

  const commas = (numericText.match(/,/g) || []).length;
  const dots = (numericText.match(/\./g) || []).length;
  const lastComma = numericText.lastIndexOf(',');
  const lastDot = numericText.lastIndexOf('.');

  let decimalSeparator = '';
  if (commas > 0 && dots > 0) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (commas === 1 || dots === 1) {
    const decimals = numericText.length - Math.max(lastComma, lastDot) - 1;
    if (decimals > 0 && decimals <= 2) {
      decimalSeparator = commas === 1 ? ',' : '.';
    }
  }

  const normalized = decimalSeparator
    ? numericText
        .split(decimalSeparator === ',' ? '.' : ',').join('')
        .split(decimalSeparator).join('.')
    : numericText.replace(/[.,]/g, '');

  if (!/\d/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : null;
}

function normalizeCurrencyPrefix(value: string, symbol: string): string {
  const cleaned = value
    .replace(/^(usd|eur|gbp|us\$|u\$|\$|€|£)\s*/i, '')
    .trim();

  return `${symbol} ${cleaned}`.trim();
}
