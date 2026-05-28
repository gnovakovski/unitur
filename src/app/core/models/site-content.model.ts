export interface HeaderLink {
  id: string;
  label: string;
  route: string;
  order: number;
  visible: boolean;
}

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
  whatsapp: '5551327233770',
  email: 'grupos@unitur.com.br',
  instagram: '',
  facebook: '',
  linkedin: '',
  address: 'Praça. Mal. Deodoro, 130 - Conj. 301',
  cep: '90.010-300',
  city: 'Porto Alegre - RS'
};

export const DEFAULT_HOME_CONTENT: SiteHomeContent = {
  searchTitle: 'Encontre sua próxima aventura',
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
