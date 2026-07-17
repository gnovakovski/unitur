/**
 * Etiqueta cadastrada pelo admin e exibida no card e na página da viagem
 * (ex.: "Poucas vagas restantes"). Fica em uma coleção própria: a viagem
 * guarda só o `id`, então renomear a frase ou trocar a cor reflete em todas
 * as viagens que usam a tag.
 */
export interface TripTag {
  id: number;
  label: string;
  /** Cor de fundo do badge (hex, ex.: "#ff812c"). */
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_TAG_COLOR = '#ff812c';
