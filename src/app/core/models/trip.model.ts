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
  priceTagline?: string;
  foreignPrice?: number | string;
  foreignCurrency?: string;
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
  /**
   * Formas de pagamento exibidas como blocos no detalhe da viagem.
   * Formato legado (string[]) ainda é aceito ao carregar — convertido para
   * blocos só com `title` em `mapFirestoreTrip` / form admin.
   */
  paymentMethods?: Array<{ title: string; description?: string }>;
  cancellationPolicy?: string;
  included: string[];
  notIncluded: string[];
  itinerary?: string; // HTML ou Markdown
  status: 'active' | 'inactive' | 'draft';
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
