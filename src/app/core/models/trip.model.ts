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
  mainImagePosition?: string; // ex.: "50% 30%" (object-position)
  mainImageFit?: 'cover' | 'contain'; // object-fit
  mainImageRotation?: number; // graus
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
  status: 'active' | 'inactive' | 'draft';
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
