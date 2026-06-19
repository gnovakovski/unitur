import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { UploadService } from '../../../core/services/upload.service';
import { CurrencyEntry, ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { ForeignCurrencyCode, formatForeignCurrency, getCurrencyCode, parseForeignAmount } from '../../../core/utils/currency-format';
import { tripScope } from '../../../core/utils/trip-scope';
import { SiteContentService, MenuOption } from '../../../core/services/site-content.service';
import { LEGACY_TRIP_TYPE_TO_MENU_ID } from '../../../core/models/site-content.model';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { MultiImageUploadComponent, GalleryItem } from '../../../shared/components/multi-image-upload/multi-image-upload.component';
import { HotelListUploadComponent, HotelItem } from '../../../shared/components/hotel-list-upload/hotel-list-upload.component';
import { SavingOverlayComponent } from '../../../shared/components/saving-overlay/saving-overlay.component';
import { UnsavedChangesModalComponent } from '../../../shared/components/unsaved-changes-modal/unsaved-changes-modal.component';
import { UnsavedFormBase } from '../../../shared/components/unsaved-changes-modal/unsaved-form.base';

@Component({
  selector: 'app-viagem-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ImageUploadComponent,
    MultiImageUploadComponent,
    HotelListUploadComponent,
    SavingOverlayComponent,
    UnsavedChangesModalComponent
  ],
  templateUrl: './viagem-form.component.html',
  styleUrl: './viagem-form.component.scss'
})
export class ViagemFormComponent extends UnsavedFormBase implements OnInit {
  tripForm: FormGroup;
  isEditMode = false;
  tripId: number | null = null;
  saving = false;
  savingStep = '';
  error = '';
  exchangeRateText = '';
  itineraryDays: Array<{ title: string; description: string }> = [];
  paymentBlocks: Array<{ title: string; description: string }> = [];
  availableCurrencies: CurrencyEntry[] = [];
  menuOptions: MenuOption[] = [];
  selectedMenuIds = new Set<string>();
  private lastExchangeRate: number | undefined;

  protected fieldLabels: Record<string, string> = {
    title: 'Nome da viagem',
    menuIds: 'Menus onde aparece',
    country: 'País',
    period: 'Embarque',
    startDate: 'Data de embarque',
    duration: 'Duração',
    availableSpots: 'Vagas',
    price: 'Preço',
    priceTagline: 'Frase acima do preço',
    foreignCurrency: 'Moeda estrangeira',
    foreignPrice: 'Valor convertido',
    status: 'Status',
    spiritualGuide: 'Guia Espiritual Convidado',
    coordinator: 'Coordenador',
    showAvailableSpots: 'Exibir vagas',
    mainImage: 'Imagem principal',
    shortDescription: 'Chamada curta',
    description: 'Descrição completa',
    experienceImages: 'Galeria da experiência',
    hotels: 'Hotéis',
    itinerary: 'Roteiro',
    paymentMethods: 'Formas de pagamento',
    includedText: 'Incluso',
    notIncludedText: 'Não incluso',
    cancellationPolicy: 'Política de cancelamento',
    scope: 'Abrangência (nacional/internacional)',
    metaTitle: 'Meta título (SEO)',
    metaDescription: 'Meta descrição (SEO)',
    ogImage: 'Imagem de compartilhamento (SEO)'
  };

  protected getMainForm(): FormGroup { return this.tripForm; }
  protected async triggerSave(): Promise<void> { await this.saveTrip(); }

  constructor(
    private fb: FormBuilder,
    private tripService: TripService,
    private uploadService: UploadService,
    private exchangeRateService: ExchangeRateService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private siteContentService: SiteContentService
  ) {
    super();
    this.tripForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      // Mantido por compatibilidade; o vínculo de menus agora é `menuIds`.
      tripType: ['regular'],
      // IDs dos menus em que a viagem aparece. Pelo menos um é exigido.
      menuIds: [[] as string[], [Validators.required, Validators.minLength(1)]],
      country: ['', [Validators.required]],
      period: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      duration: [1, [Validators.required, Validators.min(1)]],
      availableSpots: [0, [Validators.required, Validators.min(0)]],
      price: ['', [Validators.required, Validators.min(1)]],
      priceTagline: ['Aéreo e apartamento duplo, a partir de:'],
      foreignCurrency: [''],
      foreignPrice: [''],
      status: ['active', [Validators.required]],
      spiritualGuide: [''],
      coordinator: [''],
      showAvailableSpots: [true],
      mainImage: [''],
      shortDescription: ['', [Validators.required]],
      description: ['', [Validators.required]],
      experienceImages: [[] as GalleryItem[]],
      hotels: [[] as HotelItem[]],
      itinerary: [''],
      includedText: [''],
      notIncludedText: [''],
      cancellationPolicy: [''],
      // Define a URL canônica: /roteiros-nacionais/ ou /roteiros-internacionais/
      scope: ['internacional', [Validators.required]],
      // SEO (opcionais; vazio => fallback p/ título, chamada curta e imagem principal)
      metaTitle: ['', [Validators.maxLength(70)]],
      metaDescription: ['', [Validators.maxLength(160)]],
      ogImage: ['']
    });
  }

  get canSaveTrip(): boolean {
    return this.tripForm.valid;
  }

  /** Preço base em reais formatado (ex.: R$ 28.354,40) para exibição readonly. */
  get formattedPrice(): string {
    const value = Number(this.tripForm.get('price')?.value);
    if (!value || Number.isNaN(value) || value <= 0) {
      return '';
    }
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get includedPreview(): string[] {
    return this.parseLines(this.tripForm.get('includedText')?.value || '');
  }

  get notIncludedPreview(): string[] {
    return this.parseLines(this.tripForm.get('notIncludedText')?.value || '');
  }

  ngOnInit() {
    this.exchangeRateService.rates$.subscribe(content => {
      this.availableCurrencies = content.currencies;
      this.cdr.markForCheck();
    });
    this.exchangeRateService.loadRates().subscribe();

    // Carrega os menus disponíveis (cache local imediato + Firestore).
    this.menuOptions = this.siteContentService.getMenuOptions();
    this.siteContentService.loadHeader().subscribe(() => {
      this.menuOptions = this.siteContentService.getMenuOptions();
      this.cdr.markForCheck();
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.tripId = Number(id);
      this.loadTrip(this.tripId);
    }

    this.tripForm.get('foreignPrice')?.valueChanges.subscribe(() => this.updateConvertedPrice());
    this.tripForm.get('foreignCurrency')?.valueChanges.subscribe(() => this.updateConvertedPrice());
  }

  loadTrip(id: number) {
    this.tripService.getTrip(id).subscribe({
      next: trip => {
        const menuIds = this.resolveMenuIds(trip);
        this.selectedMenuIds = new Set(menuIds);
        this.tripForm.patchValue({
          title: trip.title,
          tripType: trip.tripType || 'regular',
          menuIds,
          country: trip.country || trip.destination,
          period: trip.period || '',
          startDate: this.formatDateInput(trip.startDate),
          duration: trip.duration,
          availableSpots: trip.availableSpots,
          price: trip.price,
          priceTagline: trip.priceTagline ?? 'Aéreo e apartamento duplo, a partir de:',
          foreignCurrency: trip.foreignCurrency || this.detectCurrency(trip.foreignPrice),
          foreignPrice: trip.foreignPrice ? formatForeignCurrency(trip.foreignPrice, trip.foreignCurrency || this.detectCurrency(trip.foreignPrice)) : '',
          status: trip.status,
          spiritualGuide: trip.spiritualGuide || '',
          coordinator: trip.coordinator || '',
          showAvailableSpots: trip.showAvailableSpots !== false,
          mainImage: trip.mainImage || '',
          shortDescription: trip.shortDescription || '',
          description: trip.description || '',
          experienceImages: (trip.experienceImages || trip.gallery || []) as GalleryItem[],
          hotels: (trip.hotels || []).map(h => ({ name: h.name, image: h.image })) as HotelItem[],
          itinerary: trip.itinerary || '',
          includedText: (trip.included || []).join('\n'),
          notIncludedText: (trip.notIncluded || []).join('\n'),
          cancellationPolicy: trip.cancellationPolicy || '',
          // Docs legados sem `scope` recebem o valor inferido pelo país.
          scope: tripScope(trip),
          metaTitle: trip.metaTitle || '',
          metaDescription: trip.metaDescription || '',
          ogImage: trip.ogImage || ''
        });
        this.itineraryDays = this.parseItineraryDays(trip.itinerary || '');
        this.paymentBlocks = this.parsePaymentBlocks(trip.paymentMethods);
        this.tripForm.markAsPristine();
        this.lastExchangeRate = trip.foreignExchangeRate;
        this.updateConvertedPrice();
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.message || 'Erro ao carregar viagem.';
        this.cdr.markForCheck();
      }
    });
  }

  async saveTrip() {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.markSaving(true);
    this.error = '';
    this.savingStep = 'Salvando informações da viagem...';

    try {
      try {
        await this.updateConvertedPrice(true);
      } catch (rateErr) {
        console.warn('Câmbio indisponível, prosseguindo sem atualizar conversão.', rateErr);
      }
      const value = this.tripForm.getRawValue();
      const {
        includedText,
        notIncludedText,
        mainImage,
        experienceImages,
        hotels,
        ...baseValue
      } = value;

      const mainImageFile = mainImage instanceof File ? mainImage : null;
      const existingMainImage = mainImage instanceof File ? '' : String(mainImage || '');

      const galleryItems = (experienceImages || []) as GalleryItem[];
      const hotelItems = (hotels || []) as HotelItem[];

      // Separa o que já é URL (mantém) do que é File pendente
      const existingExperienceUrls = galleryItems.filter(item => typeof item === 'string') as string[];
      const existingHotelsResolved = hotelItems
        .filter(item => typeof item.image === 'string')
        .map(item => ({ name: item.name, image: item.image as string }));

      const now = new Date();
      const startDate = value.startDate ? new Date(`${value.startDate}T00:00:00`) : now;

      const menuIds = Array.from(this.selectedMenuIds);
      // tripType legado é derivado dos menus para manter a home (que ainda lê
      // tripType) coerente. Usa o id do menu como tripType quando bate com os
      // tipos conhecidos; senão cai em 'regular'.
      const derivedType = this.deriveLegacyTripType(menuIds);

      const tripData: Partial<Trip> = {
        ...baseValue,
        menuIds,
        tripType: derivedType,
        mainImage: existingMainImage,
        foreignPrice: baseValue.foreignCurrency ? (parseForeignAmount(baseValue.foreignPrice) ?? '') : '',
        foreignExchangeRate: baseValue.foreignCurrency ? this.lastExchangeRate : undefined,
        destination: value.country,
        categoryId: 0,
        startDate,
        endDate: startDate,
        featured: menuIds.includes('curadoria'),
        experienceImages: existingExperienceUrls,
        gallery: existingExperienceUrls,
        hotels: existingHotelsResolved,
        itinerary: this.serializeItineraryDays(this.itineraryDays),
        paymentMethods: this.serializePaymentBlocks(this.paymentBlocks),
        included: this.parseLines(includedText),
        notIncluded: this.parseLines(notIncludedText)
      };

      const saved = this.isEditMode && this.tripId
        ? await firstValueFrom(this.tripService.updateTrip(this.tripId, tripData))
        : await firstValueFrom(this.tripService.createTrip(tripData));

      const tripIdToUse = saved?.id || this.tripId;

      const pendingExperienceFiles = galleryItems.filter(item => item instanceof File) as File[];
      const pendingHotelItems = hotelItems.filter(item => item.image instanceof File);

      const hasUploads = mainImageFile || pendingExperienceFiles.length > 0 || pendingHotelItems.length > 0;

      if (hasUploads && tripIdToUse) {
        const totalUploads = (mainImageFile ? 1 : 0) + pendingExperienceFiles.length + pendingHotelItems.length;
        let done = 0;
        const updateStep = () => {
          done++;
          this.savingStep = `Enviando imagens (${done}/${totalUploads})...`;
        };

        this.savingStep = `Enviando imagens (0/${totalUploads})...`;
        const updates: Partial<Trip> = {};

        try {
          if (mainImageFile) {
            const uploaded = await firstValueFrom(
              this.uploadService.uploadToEntity(mainImageFile, 'viagens', tripIdToUse).pipe(timeout(60000))
            );
            updates.mainImage = uploaded.url;
            updateStep();
          }

          // Upload das imagens de experiência preservando a ordem original do array.
          let experienceFinal: string[] = [];
          if (pendingExperienceFiles.length > 0) {
            const fileToUrl = new Map<File, string>();
            for (const file of pendingExperienceFiles) {
              const uploaded = await firstValueFrom(
                this.uploadService.uploadToEntity(file, 'viagens', tripIdToUse).pipe(timeout(60000))
              );
              fileToUrl.set(file, uploaded.url);
              updateStep();
            }
            experienceFinal = galleryItems.map(item =>
              typeof item === 'string' ? item : (fileToUrl.get(item) || '')
            ).filter(Boolean);
            updates.experienceImages = experienceFinal;
            updates.gallery = experienceFinal;
          }

          // Upload das imagens de hotéis preservando ordem e nomes.
          if (pendingHotelItems.length > 0) {
            const hotelFileToUrl = new Map<File, string>();
            for (const hotel of pendingHotelItems) {
              const uploaded = await firstValueFrom(
                this.uploadService.uploadToEntity(hotel.image as File, 'viagens', tripIdToUse).pipe(timeout(60000))
              );
              hotelFileToUrl.set(hotel.image as File, uploaded.url);
              updateStep();
            }
            const resolvedHotels = hotelItems.map(item => {
              if (typeof item.image === 'string') {
                return { name: item.name, image: item.image };
              }
              const url = hotelFileToUrl.get(item.image as File) || '';
              return { name: item.name, image: url };
            }).filter(h => h.image);
            updates.hotels = resolvedHotels;
          }

          if (Object.keys(updates).length > 0) {
            this.savingStep = 'Finalizando...';
            await firstValueFrom(this.tripService.updateTrip(tripIdToUse, updates));
          }
        } catch (uploadErr: any) {
          this.error = `Viagem salva, mas falhou o upload de uma imagem: ${uploadErr?.message || 'erro desconhecido'}. Edite a viagem para tentar novamente.`;
          console.error('Upload error', uploadErr);
          this.saving = false;
          this.savingStep = '';
          return;
        }
      }

      this.tripForm.markAsPristine();
      this.markSaving(false, true);
      this.router.navigate(['/admin/viagens']);
    } catch (err: any) {
      this.error = err?.message || 'Erro ao salvar viagem. Verifique permissão do Firestore.';
      this.markSaving(false, false);
      throw err;
    } finally {
      this.saving = false;
      this.savingStep = '';
    }
  }

  cancel() {
    this.router.navigate(['/admin/viagens']);
  }

  // ---------- Menus em que a viagem aparece ----------
  isMenuSelected(menuId: string): boolean {
    return this.selectedMenuIds.has(menuId);
  }

  toggleMenu(menuId: string, checked: boolean) {
    if (checked) {
      this.selectedMenuIds.add(menuId);
    } else {
      this.selectedMenuIds.delete(menuId);
    }
    const control = this.tripForm.get('menuIds');
    control?.setValue(Array.from(this.selectedMenuIds));
    control?.markAsDirty();
    control?.markAsTouched();
  }

  /** Resolve os menuIds de uma viagem, migrando o tripType legado quando faltar. */
  private resolveMenuIds(trip: Trip): string[] {
    const fromTrip = Array.isArray(trip.menuIds) ? trip.menuIds.filter(Boolean) : [];
    if (fromTrip.length) return fromTrip;
    const legacy = LEGACY_TRIP_TYPE_TO_MENU_ID[trip.tripType || 'regular'];
    return legacy ? [legacy] : [];
  }

  /** Deriva o tripType legado a partir dos menus selecionados (compat com a home). */
  private deriveLegacyTripType(menuIds: string[]): Trip['tripType'] {
    const legacyByMenu: Record<string, Trip['tripType']> = {
      peregrinacao: 'peregrinacao',
      regulares: 'regular',
      curadoria: 'curadoria'
    };
    for (const id of menuIds) {
      if (legacyByMenu[id]) return legacyByMenu[id];
    }
    return 'regular';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.tripForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  addItineraryDay() {
    this.itineraryDays = [...this.itineraryDays, { title: '', description: '' }];
    this.tripForm.markAsDirty();
  }

  removeItineraryDay(index: number) {
    this.itineraryDays = this.itineraryDays.filter((_, i) => i !== index);
    this.tripForm.markAsDirty();
  }

  updateItineraryTitle(index: number, value: string) {
    const next = [...this.itineraryDays];
    if (!next[index]) return;
    next[index] = { ...next[index], title: value };
    this.itineraryDays = next;
    this.tripForm.markAsDirty();
  }

  updateItineraryDescription(index: number, value: string) {
    const next = [...this.itineraryDays];
    if (!next[index]) return;
    next[index] = { ...next[index], description: value };
    this.itineraryDays = next;
    this.tripForm.markAsDirty();
  }

  moveItineraryDay(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.itineraryDays.length) return;
    const next = [...this.itineraryDays];
    [next[index], next[target]] = [next[target], next[index]];
    this.itineraryDays = next;
    this.tripForm.markAsDirty();
  }

  // ---------- Formas de pagamento (blocos) ----------
  addPaymentBlock() {
    this.paymentBlocks = [...this.paymentBlocks, { title: '', description: '' }];
    this.tripForm.markAsDirty();
  }

  removePaymentBlock(index: number) {
    this.paymentBlocks = this.paymentBlocks.filter((_, i) => i !== index);
    this.tripForm.markAsDirty();
  }

  updatePaymentTitle(index: number, value: string) {
    const next = [...this.paymentBlocks];
    if (!next[index]) return;
    next[index] = { ...next[index], title: value };
    this.paymentBlocks = next;
    this.tripForm.markAsDirty();
  }

  updatePaymentDescription(index: number, value: string) {
    const next = [...this.paymentBlocks];
    if (!next[index]) return;
    next[index] = { ...next[index], description: value };
    this.paymentBlocks = next;
    this.tripForm.markAsDirty();
  }

  movePaymentBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.paymentBlocks.length) return;
    const next = [...this.paymentBlocks];
    [next[index], next[target]] = [next[target], next[index]];
    this.paymentBlocks = next;
    this.tripForm.markAsDirty();
  }

  /** Aceita tanto o formato novo (array de blocos) quanto o legado (string[]). */
  private parsePaymentBlocks(value: unknown): Array<{ title: string; description: string }> {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => {
        if (typeof item === 'string') {
          return { title: item.trim(), description: '' };
        }
        if (item && typeof item === 'object') {
          const obj = item as { title?: string; description?: string };
          return { title: (obj.title || '').trim(), description: (obj.description || '').trim() };
        }
        return { title: '', description: '' };
      })
      .filter(b => b.title || b.description);
  }

  private serializePaymentBlocks(blocks: Array<{ title: string; description: string }>): Array<{ title: string; description?: string }> {
    return blocks
      .map(b => ({ title: (b.title || '').trim(), description: (b.description || '').trim() }))
      .filter(b => b.title || b.description)
      .map(b => b.description ? { title: b.title, description: b.description } : { title: b.title });
  }

  private parseItineraryDays(value: string): Array<{ title: string; description: string }> {
    return String(value || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [title = '', description = ''] = line.split('|').map(item => item.trim());
        return { title, description };
      });
  }

  private serializeItineraryDays(days: Array<{ title: string; description: string }>): string {
    return days
      .map(day => {
        const title = (day.title || '').trim();
        const description = (day.description || '').trim();
        if (!title && !description) return '';
        if (!description) return title;
        return `${title} | ${description}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  private parseLines(value: string): string[] {
    return String(value || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private async updateConvertedPrice(waitForResult = false): Promise<void> {
    const currency = this.tripForm.get('foreignCurrency')?.value as ForeignCurrencyCode | '';
    const foreignAmount = parseForeignAmount(this.tripForm.get('foreignPrice')?.value);
    const priceControl = this.tripForm.get('price');

    if (!currency) {
      // Sem moeda estrangeira: o preço em R$ passa a ser editável manualmente.
      this.tripForm.get('foreignPrice')?.setValue('', { emitEvent: false });
      this.exchangeRateText = '';
      this.lastExchangeRate = undefined;
      return;
    }

    if (!foreignAmount || foreignAmount <= 0) {
      priceControl?.setValue('', { emitEvent: false });
      this.exchangeRateText = `Informe o valor em ${currency} para calcular o preço em reais.`;
      this.lastExchangeRate = undefined;
      return;
    }

    const applyRate = (rate: number | null) => {
      if (!rate || rate <= 0) {
        priceControl?.setValue('', { emitEvent: false });
        this.exchangeRateText = `Cadastre a cotação do ${currency} em "Cotações de câmbio" na lista de viagens.`;
        this.lastExchangeRate = undefined;
        return;
      }

      const brlValue = foreignAmount * rate;
      this.lastExchangeRate = rate;
      priceControl?.setValue(Number(brlValue.toFixed(2)), { emitEvent: false });
      this.exchangeRateText = `Câmbio usado: 1 ${currency} = R$ ${rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (waitForResult) {
      const rate = await firstValueFrom(this.exchangeRateService.getCurrencyRate(currency));
      applyRate(rate.value);
      return;
    }

    this.exchangeRateService.getCurrencyRate(currency).subscribe(rate => applyRate(rate.value));
  }

  private detectCurrency(value?: number | string): ForeignCurrencyCode | '' {
    if (!value) {
      return '';
    }

    return getCurrencyCode(value);
  }

  private formatDateInput(date?: Date): string {
    if (!date) {
      return '';
    }

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toISOString().slice(0, 10);
  }
}
