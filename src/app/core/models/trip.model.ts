export interface Trip {
  id: number;
  title: string;
  slug: string;
  destination: string;
  description: string;
  shortDescription: string;
  categoryId: number;
  category?: any;
  mainImage: string;
  gallery: string[];
  startDate: Date;
  endDate: Date;
  duration: number; // em dias
  price: number;
  availableSpots: number;
  included: string[];
  notIncluded: string[];
  itinerary?: string; // HTML ou Markdown
  status: 'active' | 'inactive';
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
