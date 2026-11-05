export interface Banner {
  id: number;
  imageUrl: string;
  /** Arte vertical opcional usada em telas pequenas. O link é o mesmo da versão desktop. */
  imageUrlMobile?: string;
  link?: string;
  buttonText?: string;
  order: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
