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

  it('usa o período do cadastro quando as datas não formam um intervalo', () => {
    // É o caso de todas as viagens atuais: o formulário grava a data final igual à inicial.
    expect(formatTripDates('2027-04-21', '2027-04-21', '21/04/27 a 01/05/27')).toBe('21/04/27 a 01/05/27');
    expect(formatTripDates('2027-04-21', undefined, ' 21/04/27 a 01/05/27 ')).toBe('21/04/27 a 01/05/27');
  });

  it('prefere o intervalo das datas quando início e fim são diferentes', () => {
    expect(formatTripDates('2027-04-21', '2027-05-01', 'texto antigo')).toBe('21/04/2027 a 01/05/2027');
  });

  it('usa o período legado quando não há datas válidas', () => {
    expect(formatTripDates('inválida', undefined, 'Março de 2027')).toBe('Março de 2027');
    expect(formatTripDates()).toBe('A definir');
  });
});
