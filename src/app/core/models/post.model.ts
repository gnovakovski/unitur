export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage?: string;
  contentImages?: string[];
  categoryId: number;
  category?: Category;
  tags: string[];
  relatedTrips?: number[];
  status: 'draft' | 'published';
  // SEO (opcionais; fallback automático para title/excerpt/featuredImage)
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  // Metadados da migração do blog antigo (WordPress).
  sourceId?: number;
  sourceUrl?: string;
  sourceCategoryIds?: number[];
  sourceCategories?: string[];
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: number;
    name: string;
  };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  type: 'blog' | 'trip' | 'both';
  color?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}
