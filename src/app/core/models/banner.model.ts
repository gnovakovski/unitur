export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl: string;
  link?: string;
  buttonText?: string;
  order: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
