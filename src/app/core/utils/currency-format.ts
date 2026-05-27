export type ForeignCurrencyCode = 'USD' | 'EUR' | 'GBP';

const currencySymbols: Record<ForeignCurrencyCode, string> = {
  USD: 'US$',
  EUR: '\u20ac',
  GBP: '\u00a3'
};

const currencyPatterns: Array<{ patterns: RegExp[]; code: ForeignCurrencyCode }> = [
  { patterns: [/eur/i, /\u20ac/], code: 'EUR' },
  { patterns: [/gbp/i, /\u00a3/], code: 'GBP' },
  { patterns: [/usd/i, /us\$/i, /u\$/i, /\$/], code: 'USD' }
];

export function formatForeignAmount(amount: number, currency: ForeignCurrencyCode): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return `${currencySymbols[currency]} ${amount.toLocaleString('pt-BR', {
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
  const symbol = currencySymbols[code];
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
  if (typeof value === 'number') {
    return 'USD';
  }

  const text = value.trim();
  return currencyPatterns.find(currency => currency.patterns.some(pattern => pattern.test(text)))?.code || 'USD';
}

function parseCurrencyAmount(value: string): number | null {
  const numericText = value.replace(/[^\d.,-]/g, '');

  if (!numericText) {
    return null;
  }

  const lastComma = numericText.lastIndexOf(',');
  const lastDot = numericText.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';
  const normalized = numericText
    .replace(new RegExp(`\\${decimalSeparator === ',' ? '.' : ','}`, 'g'), '')
    .replace(decimalSeparator, '.');
  const amount = Number(normalized);

  return Number.isNaN(amount) ? null : amount;
}

function normalizeCurrencyPrefix(value: string, symbol: string): string {
  const cleaned = value
    .replace(/^(usd|eur|gbp|us\$|u\$|\$|\u20ac|\u00a3)\s*/i, '')
    .trim();

  return `${symbol} ${cleaned}`.trim();
}
