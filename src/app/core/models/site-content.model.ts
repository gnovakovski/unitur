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
  address: string;
  cep: string;
  city: string;
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
  address: 'Praça. Mal. Deodoro, 130 - Conj. 301',
  cep: '90.010-300',
  city: 'Porto Alegre - RS'
};
