export interface Trip {
  id: number;
  title: string;
  slug: string;
  /**
   * @deprecated Mantido apenas para compatibilidade com viagens antigas.
   * A classificação por menu agora é feita por `menuIds`. Para docs legados
   * sem `menuIds`, o id do menu correspondente é inferido a partir deste campo.
   */
  tripType?: 'peregrinacao' | 'regular' | 'curadoria';
  /**
   * IDs dos menus do cabeçalho em que esta viagem deve aparecer.
   * São os mesmos `HeaderLink.id` configurados em Conteúdo > Cabeçalho.
   * Uma viagem pode aparecer em vários menus ao mesmo tempo.
   */
  menuIds?: string[];
  /**
   * Define a URL canônica da viagem (SEO):
   *   'nacional'      -> /roteiros-nacionais/<slug>/
   *   'internacional' -> /roteiros-internacionais/<slug>/
   * Para docs legados sem este campo, é inferido por `country` (ver tripScope()).
   */
  scope?: 'nacional' | 'internacional';
  /**
   * Tag exibida no card e na página da viagem. Guarda só o `TripTag.id`
   * (a frase e a cor vivem na coleção `tags`). null / ausente => sem tag.
   */
  tagId?: number | null;
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
  /**
   * Mensagem que já vem preenchida no WhatsApp quando o cliente clica em
   * "Reservar agora". Vazio => usa o texto padrão com o nome da viagem
   * (ver `whatsappLink` em product-detail).
   */
  whatsappMessage?: string;
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
  // SEO (opcionais; fallback automático para title/shortDescription/mainImage)
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  createdAt: Date;
  updatedAt: Date;
}
