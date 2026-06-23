import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { ForeignCurrencyCode, formatForeignAmount } from '../../core/utils/currency-format';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { SeoService } from '../../core/services/seo.service';
import { LEGACY_TRIP_TYPE_TO_MENU_ID, slugFromHeaderRoute } from '../../core/models/site-content.model';

interface ViagemCard {
  slug: string;
  title: string;
  location: string;
  date: string;
  duration: string;
  image: string;
  imagePosition?: string;
  imageFit?: string;
  imageRotation?: number;
  price: string;
  spots: string;
  showSpots: boolean;
  foreignPrice?: string;
  guide: string;
  coordinator: string;
  category: string;
  menuIds: string[];
  startDate?: Date;
  /**
   * Texto pré-normalizado (minúsculo, sem acentos) com todos os campos
   * pesquisáveis da viagem (país, destino, coordenador, guia, descrições,
   * período etc.). Usado pelo filtro de busca livre da home/listagem.
   */
  searchText: string;
}

interface CategoryFilter {
  /** '' representa "Todas". */
  id: string;
  label: string;
}

@Component({
  selector: 'app-viagens',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './viagens.component.html',
  styleUrl: './viagens.component.scss'
})
export class ViagensComponent implements OnInit, OnDestroy {
  private readonly fallbackImage = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop';
  loading = false;
  error = '';

  viagens: ViagemCard[] = [];

  /** id do menu selecionado; '' = Todas. */
  selectedMenuId = '';
  /** Label exibido no hero/SEO. */
  selectedCategory = 'Todas';
  /** Filtros (chips) montados a partir dos menus reais do header. */
  categories: CategoryFilter[] = [{ id: '', label: 'Todas' }];
  private routeSub?: Subscription;
  private querySub?: Subscription;
  private filterDestination = '';
  private filterStartDate: Date | null = null;
  private filterEndDate: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService,
    private exchangeRateService: ExchangeRateService,
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef,
    private seo: SeoService
  ) {}

  ngOnInit() {
    // Monta os filtros com o que já está em cache (imediato)...
    this.rebuildCategories();
    this.updateSelectedCategory();

    // ...e atualiza quando o header chegar do Firestore (slug → menu).
    this.siteContentService.loadHeader().subscribe(() => {
      this.rebuildCategories();
      this.updateSelectedCategory();
      this.cdr.detectChanges();
    });

    this.routeSub = this.route.url.subscribe(() => {
      this.updateSelectedCategory();
      this.cdr.detectChanges();
    });
    this.querySub = this.route.queryParamMap.subscribe(params => {
      this.filterDestination = this.normalizeSearch((params.get('destination') || '').trim());
      this.filterStartDate = this.parseFilterDate(params.get('startDate'));
      this.filterEndDate = this.parseFilterDate(params.get('endDate'));
      this.cdr.detectChanges();
    });
    this.updateSelectedCategory();
    this.loadTrips();
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  /** Reconstrói os chips de filtro a partir dos menus reais do header. */
  private rebuildCategories() {
    const menus = this.siteContentService.getCurrentHeaderLinks()
      .filter(link => link.visible)
      .map(link => ({ id: link.id, label: link.label }));
    this.categories = [{ id: '', label: 'Todas' }, ...menus];
  }

  /**
   * Resolve o menu selecionado a partir do slug da URL.
   * Casa pelo ID estável do menu (via slug da rota), não por label — assim
   * renomear o menu nunca quebra a listagem.
   */
  private updateSelectedCategory() {
    const path = this.route.snapshot.url.map(s => s.path).join('/');
    const lastSegment = this.route.snapshot.url[this.route.snapshot.url.length - 1]?.path || '';

    if (!path || path === 'viagens') {
      this.selectedMenuId = '';
      this.selectedCategory = 'Todas';
      this.applySeo();
      return;
    }

    const links = this.siteContentService.getCurrentHeaderLinks();
    const link = links.find(l => slugFromHeaderRoute(l.route) === lastSegment);

    this.selectedMenuId = link?.id || '';
    this.selectedCategory = link?.label || 'Todas';
    this.applySeo();
  }

  /** Meta tags da listagem; varia título/canonical conforme a categoria. */
  private applySeo() {
    const path = '/' + this.route.snapshot.url.map(s => s.path).join('/');
    const canonicalPath = (path === '/' ? '/viagens' : path) + '/';

    const isAll = this.selectedCategory === 'Todas';
    const title = isAll
      ? 'Viagens e Roteiros | Unitur Agência de Viagens'
      : `${this.selectedCategory} | Unitur`;
    const description = isAll
      ? 'Confira todas as viagens e roteiros da Unitur: peregrinações, viagens regulares e curadoria pelo Brasil e pelo mundo.'
      : `Conheça as opções de ${this.selectedCategory.toLowerCase()} organizadas pela Unitur, com acompanhamento em todas as etapas.`;

    this.seo.setMeta({ title, description, canonicalPath, type: 'website' });
  }

  get filtered() {
    const destination = this.filterDestination;
    const startDate = this.filterStartDate;
    const endDate = this.filterEndDate;
    const hasSearch = !!destination || !!startDate || !!endDate;

    // Busca livre ("like"): cada termo digitado precisa aparecer em algum dos
    // campos pesquisáveis da viagem (país, destino, coordenador, guia,
    // descrições etc.), concatenados em `searchText`. Vários termos =>
    // todos precisam casar (AND), permitindo refinar a busca.
    const terms = destination ? destination.split(/\s+/).filter(Boolean) : [];

    return this.viagens.filter(v => {
      const matchesCategory = hasSearch || !this.selectedMenuId || v.menuIds.includes(this.selectedMenuId);
      const matchesSearch = terms.length === 0 || terms.every(term => v.searchText.includes(term));
      const tripDate = this.parseFilterDate(v.startDate);
      const matchesStart = !startDate || (tripDate ? tripDate >= startDate : false);
      const matchesEnd = !endDate || (tripDate ? tripDate <= endDate : false);

      return matchesCategory && matchesSearch && matchesStart && matchesEnd;
    });
  }

  selectCategory(cat: CategoryFilter) {
    this.selectedMenuId = cat.id;
    this.selectedCategory = cat.label;
  }

  useFallbackImage(event: Event) {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.fallbackImage;
  }

  private loadTrips() {
    this.loading = true;
    this.error = '';

    this.tripService.getTrips({ status: 'active', limit: 100 }).pipe(
      catchError((err) => {
        console.error('Erro ao carregar viagens publicas', err);
        this.error = 'Não foi possível carregar as viagens cadastradas.';
        return of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe(response => {
      this.viagens = response.data.map(trip => this.mapTrip(trip));
      this.cdr.detectChanges();
    });
  }

  private mapTrip(trip: Trip): ViagemCard {
    const card: ViagemCard = {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      location: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: this.normalizeImage(trip.mainImage),
      imagePosition: trip.mainImagePosition || '50% 50%',
      imageFit: trip.mainImageFit || 'cover',
      imageRotation: Number(trip.mainImageRotation || 0),
      price: trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte',
      foreignPrice: '',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: (trip.spiritualGuide || '').trim(),
      coordinator: (trip.coordinator || '').trim(),
      menuIds: this.resolveMenuIds(trip),
      category: this.getCategoryLabel(trip),
      startDate: trip.startDate,
      searchText: this.buildSearchText(trip)
    };
    this.attachForeignPrice(card, trip);
    return card;
  }

  /**
   * Concatena e normaliza (minúsculo, sem acentos) todos os campos por onde a
   * busca livre deve procurar: país, destino, título, coordenador, guia
   * espiritual, período/data e as descrições. Assim o filtro vira um "like"
   * sobre todas essas informações de uma vez.
   */
  private buildSearchText(trip: Trip): string {
    const parts = [
      trip.title,
      trip.country,
      trip.destination,
      trip.period,
      trip.coordinator,
      trip.spiritualGuide,
      trip.operator,
      trip.shortDescription,
      trip.description,
      this.getCategoryLabel(trip)
    ];
    return this.normalizeSearch(parts.filter(Boolean).join(' '));
  }

  /** Minúsculo + sem acentos, para comparações de busca tolerantes. */
  private normalizeSearch(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  private attachForeignPrice(card: ViagemCard, trip: Trip) {
    const currency = trip.foreignCurrency as ForeignCurrencyCode | '' | undefined;
    if (!currency || !trip.price || Number(trip.price) <= 0) return;
    this.exchangeRateService.convertFromBRL(Number(trip.price), currency).subscribe(({ value }) => {
      if (value && value > 0) {
        card.foreignPrice = formatForeignAmount(value, currency);
        this.cdr.detectChanges();
      }
    });
  }

  private normalizeImage(value?: string): string {
    const image = String(value || '').trim();
    return image || this.fallbackImage;
  }

  private parseFilterDate(value?: Date | string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(`${value}`.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  /** menuIds da viagem, migrando o tripType legado quando o campo não existir. */
  private resolveMenuIds(trip: Trip): string[] {
    const fromTrip = Array.isArray(trip.menuIds) ? trip.menuIds.filter(Boolean) : [];
    if (fromTrip.length) return fromTrip;
    const legacy = LEGACY_TRIP_TYPE_TO_MENU_ID[trip.tripType || 'regular'];
    return legacy ? [legacy] : [];
  }

  /** Label do badge do card: nome do primeiro menu real da viagem. */
  private getCategoryLabel(trip: Trip): string {
    const menuIds = this.resolveMenuIds(trip);
    const links = this.siteContentService.getCurrentHeaderLinks();
    for (const id of menuIds) {
      const link = links.find(l => l.id === id);
      if (link) return link.label;
    }

    // Fallback para viagens cujo menu não existe mais no header.
    const labels: Record<string, string> = {
      peregrinacao: 'Viagens de Peregrinação',
      regular: 'Viagens Regulares',
      curadoria: 'Viagens de Curadoria'
    };
    return labels[trip.tripType || 'regular'] || 'Viagens';
  }

  private formatPeriod(date?: Date) {
    if (!date) {
      return 'A definir';
    }

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return 'A definir';
    }

    return parsedDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  }
}

