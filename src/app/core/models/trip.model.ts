export interface Trip {
  id: number;
  title: string;
  slug: string;
  tripType?: 'peregrinacao' | 'regular' | 'curadoria';
  destination: string;
  country?: string;
  period?: string;
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
  foreignPrice?: number | string;
  foreignCurrency?: 'USD' | 'EUR' | 'GBP' | '';
  foreignExchangeRate?: number;
  availableSpots: number;
  showAvailableSpots?: boolean;
  spiritualGuide?: string;
  coordinator?: string;
  operator?: string;
  experienceImages?: string[];
  hotels?: Array<{
    name: string;
    image: string;
  }>;
  paymentMethods?: string[];
  cancellationPolicy?: string;
  included: string[];
  notIncluded: string[];
  itinerary?: string; // HTML ou Markdown
  status: 'active' | 'inactive';
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
