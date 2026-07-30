import { describe, expect, it } from 'vitest';
import { parseForeignAmount } from './currency-format';
import { computeTripPrice, formatTripBRL, formatTripForeign } from './trip-pricing';

describe('parseForeignAmount', () => {
  it('lê o formato pt-BR completo', () => {
    expect(parseForeignAmount('4.990,00')).toBe(4990);
    expect(parseForeignAmount('US$ 4.990,00')).toBe(4990);
    expect(parseForeignAmount('27.245,40')).toBe(27245.4);
  });

  it('trata ponto/vírgula sozinhos com 3 dígitos como separador de milhar', () => {
    // Antes "4.990" virava 4,99 e o preço em reais saía ~5 mil vezes menor.
    expect(parseForeignAmount('4.990')).toBe(4990);
    expect(parseForeignAmount('1.500')).toBe(1500);
    expect(parseForeignAmount('4,990')).toBe(4990);
    expect(parseForeignAmount('12.345.678')).toBe(12345678);
  });

  it('mantém 1 ou 2 casas como decimal', () => {
    expect(parseForeignAmount('1,5')).toBe(1.5);
    expect(parseForeignAmount('1.5')).toBe(1.5);
    expect(parseForeignAmount('1500,50')).toBe(1500.5);
    expect(parseForeignAmount('1,500.00')).toBe(1500);
  });

  it('devolve null para vazio e para valores não positivos', () => {
    expect(parseForeignAmount('')).toBeNull();
    expect(parseForeignAmount('US$')).toBeNull();
    expect(parseForeignAmount(0)).toBeNull();
  });
});

describe('computeTripPrice', () => {
  const trip = {
    price: 27095.7,            // gravado quando o dólar estava 5,43
    foreignPrice: 4990,
    foreignCurrency: 'USD',
    foreignExchangeRate: 5.43
  };

  it('deriva o R$ do valor cadastrado com a cotação atual', () => {
    const resolved = computeTripPrice(trip, 5.46);
    expect(resolved.foreign).toBe(4990);
    expect(resolved.brl).toBe(27245.4);
    expect(formatTripForeign(resolved)).toBe('US$ 4.990,00');
    expect(formatTripBRL(resolved.brl)).toBe('R$27.245,40');
  });

  it('nunca recalcula o valor estrangeiro a partir do R$ gravado', () => {
    // Era exatamente o bug: 27.095,70 / 5,46 = US$ 4.962,58.
    expect(computeTripPrice(trip, 5.46).foreign).toBe(4990);
  });

  it('cai na cotação gravada quando a moeda sai da tabela', () => {
    const resolved = computeTripPrice(trip, null);
    expect(resolved.brl).toBe(27095.7);
    expect(resolved.foreign).toBe(4990);
  });

  it('sem cotação nenhuma, mantém o par congelado do cadastro', () => {
    const resolved = computeTripPrice({ ...trip, foreignExchangeRate: null }, null);
    expect(resolved.brl).toBe(27095.7);
    expect(resolved.foreign).toBe(4990);
  });

  it('usa o preço em reais direto quando a viagem não tem moeda estrangeira', () => {
    const resolved = computeTripPrice({ price: 8500, foreignCurrency: '', foreignPrice: '' }, 5.46);
    expect(resolved.brl).toBe(8500);
    expect(resolved.foreign).toBeNull();
    expect(formatTripForeign(resolved)).toBe('');
  });

  it('aceita o formato legado com a moeda dentro do texto', () => {
    const resolved = computeTripPrice(
      { price: 0, foreignPrice: 'US$ 4.990,00', foreignCurrency: 'USD' },
      5.46
    );
    expect(resolved.brl).toBe(27245.4);
  });

  it('mostra "Consulte" quando não há preço algum', () => {
    expect(formatTripBRL(computeTripPrice({}, 5.46).brl)).toBe('Consulte');
  });
});
