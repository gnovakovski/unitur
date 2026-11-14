export interface HeaderLink {
  /**
   * Identificador estável do menu. NÃO muda quando o admin renomeia o label
   * ou edita a rota — é por ele que as viagens (`Trip.menuIds`) se vinculam ao
   * menu, garantindo que renomear/mudar rota nunca quebre o vínculo.
   */
  id: string;
  label: string;
  route: string;
  order: number;
  visible: boolean;
}

/** Prefixo obrigatório de toda rota de menu de viagens. */
export const HEADER_ROUTE_PREFIX = 'viagens';

/**
 * Extrai o slug de categoria a partir da rota de um menu.
 * Sempre devolve o último segmento (ex.: "/viagens/peregrinacao" -> "peregrinacao").
 * Usado pelo matcher de rota, pelo service e pela listagem para falarem a mesma língua.
 */
export function slugFromHeaderRoute(route: string): string {
  const trimmed = (route || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) return '';
  const parts = trimmed.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Mapa de compatibilidade: viagens antigas só têm `tripType`. Quando uma viagem
 * não tiver `menuIds`, inferimos o menu pelo id correspondente abaixo.
 */
export const LEGACY_TRIP_TYPE_TO_MENU_ID: Record<string, string> = {
  peregrinacao: 'peregrinacao',
  regular: 'regulares',
  curadoria: 'curadoria'
};

export interface SiteHeaderContent {
  links: HeaderLink[];
  updatedAt?: Date;
}

export interface SiteContactContent {
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  address: string;
  cep: string;
  city: string;
  updatedAt?: Date;
}

export interface SiteHomeContent {
  searchTitle: string;
  peregrinacoesTitle: string;
  peregrinacoesSubtitle: string;
  regularesTitle: string;
  regularesSubtitle: string;
  worldTitle: string;
  worldSubtitle: string;
  curadoriaTitle: string;
  curadoriaSubtitle: string;
  blogTitle: string;
  blogSubtitle: string;
  testimonialsTitle: string;
  testimonialsSubtitle: string;
  updatedAt?: Date;
}

export interface SiteFooterContent {
  brandName: string;
  tagline: string;
  copyright: string;
  updatedAt?: Date;
}

export const DEFAULT_HEADER_CONTENT: SiteHeaderContent = {
  links: [
    { id: 'peregrinacao', label: 'Viagens de Peregrinação', route: '/viagens/peregrinacao', order: 0, visible: true },
    { id: 'regulares', label: 'Viagens Regulares', route: '/viagens/regulares', order: 1, visible: true },
    { id: 'curadoria', label: 'Viagens de Curadoria', route: '/viagens/curadoria', order: 2, visible: true }
  ]
};

export const DEFAULT_CONTACT_CONTENT: SiteContactContent = {
  phone: '+55 (51) 3272.3377',
  whatsapp: '555132723377',
  email: 'grupos@unitur.com.br',
  instagram: '',
  facebook: '',
  linkedin: '',
  address: 'Praça. Mal. Deodoro, 130 - Conj. 301',
  cep: '90.010-300',
  city: 'Porto Alegre - RS'
};

/**
 * Mantém o WhatsApp somente com dígitos e corrige o número legado que foi
 * cadastrado com um zero excedente no final.
 */
export function normalizeWhatsAppNumber(value?: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits === '5551327233770' ? '555132723377' : digits;
}

export const DEFAULT_HOME_CONTENT: SiteHomeContent = {
  searchTitle: 'Encontre a sua próxima viagem',
  peregrinacoesTitle: 'Próximas Peregrinações',
  peregrinacoesSubtitle: 'Jornadas espirituais que transformam vidas',
  regularesTitle: 'Viagens Regulares',
  regularesSubtitle: 'Roteiros completos para conhecer novos destinos com conforto',
  worldTitle: 'Conheça o Mundo com a Unitur',
  worldSubtitle: 'Destinos incríveis para todos os perfis de viajantes',
  curadoriaTitle: 'Curadoria Unitur',
  curadoriaSubtitle: 'Selecionamos as melhores experiências para você',
  blogTitle: 'Blog Unitur',
  blogSubtitle: 'Dicas, destinos e histórias de quem viaja',
  testimonialsTitle: 'Depoimentos',
  testimonialsSubtitle: 'O que nossos viajantes têm a dizer'
};

export const DEFAULT_FOOTER_CONTENT: SiteFooterContent = {
  brandName: 'Unitur',
  tagline: 'Transformando sonhos em viagens inesquecíveis desde 2020.',
  copyright: 'Unitur. Todos os direitos reservados.'
};
