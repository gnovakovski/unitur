import { describe, expect, it } from 'vitest';
import { HeaderLink } from '../models/site-content.model';
import { compareHomeTripMenus, resolveTripMenuIds, tripMenuLabel, tripMenus } from './trip-menu';

// Espelha o cabeçalho de produção: o menu `regulares` foi renomeado.
const links: HeaderLink[] = [
  { id: 'peregrinacao', label: 'Peregrinações Nacionais', route: '/viagens/peregrinacoes-nacionais', order: 0, visible: true },
  { id: 'regulares', label: 'Peregrinações Internacionais', route: '/viagens/peregrinacoes-internacionais', order: 1, visible: true },
  { id: 'curadoria', label: 'Viagens Culturais', route: '/viagens/viagens-culturais', order: 2, visible: true }
];

describe('trip-menu', () => {
  it('prioriza internacionais, nacionais e culturais na home sem modificar o cabeçalho', () => {
    expect([...links].sort(compareHomeTripMenus).map(link => link.label)).toEqual([
      'Peregrinações Internacionais', 'Peregrinações Nacionais', 'Viagens Culturais'
    ]);
    expect(links[0].id).toBe('peregrinacao');
  });
  it('usa o nome atual do menu, não o rótulo fixo do tripType', () => {
    expect(tripMenuLabel({ menuIds: ['regulares'], tripType: 'regular' }, links)).toBe('Peregrinações Internacionais');
  });

  it('migra viagens antigas sem menuIds pelo tripType', () => {
    expect(resolveTripMenuIds({ tripType: 'regular' })).toEqual(['regulares']);
    expect(tripMenuLabel({ tripType: 'peregrinacao' }, links)).toBe('Peregrinações Nacionais');
    expect(tripMenuLabel({}, links)).toBe('Peregrinações Internacionais');
  });

  it('lista todos os menus da viagem e ignora menus que não existem mais', () => {
    expect(tripMenus({ menuIds: ['curadoria', 'removido', 'peregrinacao'] }, links).map(link => link.label))
      .toEqual(['Viagens Culturais', 'Peregrinações Nacionais']);
  });

  it('cai num nome genérico quando nenhum menu da viagem existe', () => {
    expect(tripMenuLabel({ menuIds: ['removido'], tripType: 'regular' }, links)).toBe('Viagens');
  });
});
