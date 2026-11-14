import { describe, expect, it } from 'vitest';
import { formatTripDates } from './trip-dates';

describe('formatTripDates', () => {
  it('exibe o intervalo completo sem deslocar datas sem horário', () => {
    expect(formatTripDates('2027-03-10', '2027-03-20')).toBe('10/03/2027 a 20/03/2027');
  });

  it('não repete datas iguais e aceita uma única data', () => {
    expect(formatTripDates('2027-03-10', '2027-03-10')).toBe('10/03/2027');
    expect(formatTripDates(undefined, '2027-03-20')).toBe('20/03/2027');
  });

  it('usa o período legado quando não há datas válidas', () => {
    expect(formatTripDates('inválida', undefined, 'Março de 2027')).toBe('Março de 2027');
    expect(formatTripDates()).toBe('A definir');
  });
});
