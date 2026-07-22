export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl: string;
  /** Arte vertical opcional usada em telas pequenas. Textos e botão são os mesmos da versão desktop. */
  imageUrlMobile?: string;
  link?: string;
  buttonText?: string;
  order: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
