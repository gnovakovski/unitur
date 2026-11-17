import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { DEFAULT_TAG_COLOR, TripTag } from '../../../core/models/tag.model';
import { TripService } from '../../../core/services/trip.service';
import { TagService } from '../../../core/services/tag.service';
import { TagBadge, resolveTagBadge, tagTextColor } from '../../../core/utils/tag-badge';
import { UploadService } from '../../../core/services/upload.service';
import { CurrencyEntry, ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { ForeignCurrencyCode, detectCurrencyCode, formatForeignCurrency, parseForeignAmount } from '../../../core/utils/currency-format';
import { tripScope } from '../../../core/utils/trip-scope';
import { defaultWhatsappMessage } from '../../../core/utils/whatsapp-message';
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
  validatingPdf = false;
  pdfError = '';
  error = '';
  exchangeRateText = '';
  itineraryDays: Array<{ title: string; description: string }> = [];
  paymentBlocks: Array<{ title: string; description: string }> = [];
  availableCurrencies: CurrencyEntry[] = [];
  menuOptions: MenuOption[] = [];
  selectedMenuIds = new Set<string>();
  /** Tags disponíveis no select (recarregadas ao cadastrar uma nova). */
  tags: TripTag[] = [];
  tagModalOpen = false;
  savingTag = false;
  tagError = '';
  tagForm: FormGroup;
  private lastExchangeRate: number | undefined;
  private loadedOgImage = '';

  protected fieldLabels: Record<string, string> = {
    title: 'Nome da viagem',
    menuIds: 'Menus onde aparece',
    country: 'País',
    period: 'Data da Viagem',
    startDate: 'Data de início',
    duration: 'Duração',
    availableSpots: 'Vagas',
    price: 'Preço',
    tagId: 'Tag do card',
    priceTagline: 'Frase acima do preço',
    whatsappMessage: 'Mensagem do botão "Reservar agora"',
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
    itineraryPdf: 'Arquivo PDF do roteiro',
    itineraryPdfUrl: 'PDF do roteiro',
    itineraryPdfName: 'Nome do PDF',
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
    private siteContentService: SiteContentService,
    private tagService: TagService
  ) {
    super();
    this.tagForm = this.fb.group({
      label: ['', [Validators.required, Validators.maxLength(40)]],
      color: [DEFAULT_TAG_COLOR, [Validators.required]]
    });
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
      tagId: [null as number | null],
      priceTagline: ['Aéreo e apartamento duplo, a partir de:'],
      whatsappMessage: ['', [Validators.maxLength(600)]],
      foreignCurrency: [''],
      foreignPrice: [''],
      status: ['active', [Validators.required]],
      showOnHome: [true],
      spiritualGuide: [''],
      coordinator: [''],
      showAvailableSpots: [true],
      mainImage: [''],
      shortDescription: ['', [Validators.required]],
      description: ['', [Validators.required]],
      experienceImages: [[] as GalleryItem[]],
      hotels: [[] as HotelItem[]],
      itinerary: [''],
      itineraryPdf: [null as File | null],
      itineraryPdfUrl: [''],
      itineraryPdfName: [''],
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
    return this.tripForm.valid && !this.validatingPdf;
  }

  get itineraryPdfName(): string {
    return this.tripForm.get('itineraryPdf')?.value?.name || this.tripForm.get('itineraryPdfName')?.value || 'Roteiro em PDF';
  }

  async onItineraryPdfSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.saving || this.validatingPdf) return;
    this.validatingPdf = true;
    this.pdfError = '';
    try {
      const validation = await this.uploadService.validatePdf(file);
      if (!validation.valid) {
        this.pdfError = validation.error || 'Selecione um PDF válido.';
        return;
      }
      this.tripForm.get('itineraryPdf')?.setValue(file);
      this.tripForm.get('itineraryPdf')?.markAsDirty();
    } catch (error) {
      this.pdfError = error instanceof Error ? error.message : 'Não foi possível ler o PDF.';
    } finally {
      this.validatingPdf = false;
      this.cdr.markForCheck();
    }
  }

  removeItineraryPdf(): void {
    if (this.saving || this.validatingPdf) return;
    this.tripForm.patchValue({ itineraryPdf: null, itineraryPdfUrl: '', itineraryPdfName: '' });
    this.tripForm.markAsDirty();
    this.pdfError = '';
  }

  /** Preço base em reais formatado (ex.: R$ 28.354,40) para exibição readonly. */
  get formattedPrice(): string {
    const value = Number(this.tripForm.get('price')?.value);
    if (!value || Number.isNaN(value) || value <= 0) {
      return '';
    }
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Badge da tag escolhida, para a prévia ao lado do select. */
  get selectedTagBadge(): TagBadge | null {
    return resolveTagBadge(this.tripForm.get('tagId')?.value, this.tags);
  }

  /** Prévia ao vivo da tag sendo cadastrada na modal. */
  get newTagBadge(): TagBadge {
    const value = this.tagForm.getRawValue();
    const background = value.color || DEFAULT_TAG_COLOR;
    return {
      label: (value.label || '').trim() || 'Poucas vagas restantes',
      background,
      textColor: tagTextColor(background)
    };
  }

  openTagModal(): void {
    this.tagError = '';
    this.tagForm.reset({ label: '', color: DEFAULT_TAG_COLOR });
    this.tagModalOpen = true;
  }

  closeTagModal(): void {
    if (this.savingTag) return;
    this.tagModalOpen = false;
  }

  /**
   * Cadastra a tag, recarrega a lista do select e já deixa a nova selecionada.
   * Não recarrega a tela: o form da viagem continua com tudo preenchido.
   */
  async saveTag(): Promise<void> {
    if (this.tagForm.invalid) {
      this.tagForm.markAllAsTouched();
      return;
    }

    this.savingTag = true;
    this.tagError = '';

    try {
      const value = this.tagForm.getRawValue();
      const created = await firstValueFrom(this.tagService.createTag({
        label: value.label,
        color: value.color
      }));

      this.tags = await firstValueFrom(this.tagService.getAllTags(true));
      this.tripForm.get('tagId')?.setValue(created.id);
      this.tripForm.markAsDirty();
      this.tagModalOpen = false;
    } catch (err: any) {
      this.tagError = err?.message || 'Erro ao salvar a tag.';
    } finally {
      this.savingTag = false;
      this.cdr.markForCheck();
    }
  }

  /** Texto usado no WhatsApp quando a mensagem da viagem fica em branco. */
  get defaultWhatsappMessage(): string {
    return defaultWhatsappMessage(this.tripForm.get('title')?.value);
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

    // Tags disponíveis para o select.
    this.tagService.getAllTags().subscribe(tags => {
      this.tags = tags;
      this.cdr.markForCheck();
    });

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
        // Sem moeda identificada o valor estrangeiro não é conversível, então o
        // campo fica vazio e o preço em reais volta a ser manual — melhor do que
        // assumir dólar e recalcular o preço errado no primeiro save.
        const foreignCurrency = trip.foreignCurrency || this.detectCurrency(trip.foreignPrice);
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
          tagId: trip.tagId ?? null,
          priceTagline: trip.priceTagline ?? 'Aéreo e apartamento duplo, a partir de:',
          whatsappMessage: trip.whatsappMessage || '',
          foreignCurrency,
          foreignPrice: foreignCurrency && trip.foreignPrice
            ? formatForeignCurrency(trip.foreignPrice, foreignCurrency)
            : '',
          status: trip.status,
          showOnHome: trip.showOnHome !== false,
          spiritualGuide: trip.spiritualGuide || '',
          coordinator: trip.coordinator || '',
          showAvailableSpots: trip.showAvailableSpots !== false,
          mainImage: trip.mainImage || '',
          shortDescription: trip.shortDescription || '',
          description: trip.description || '',
          experienceImages: (trip.experienceImages || trip.gallery || []) as GalleryItem[],
          hotels: (trip.hotels || []).map(h => ({ name: h.name, image: h.image })) as HotelItem[],
          itinerary: trip.itinerary || '',
          itineraryPdf: null,
          itineraryPdfUrl: trip.itineraryPdfUrl || '',
          itineraryPdfName: trip.itineraryPdfName || '',
          includedText: (trip.included || []).join('\n'),
          notIncludedText: (trip.notIncluded || []).join('\n'),
          cancellationPolicy: trip.cancellationPolicy || '',
          // Docs legados sem `scope` recebem o valor inferido pelo país.
          scope: tripScope(trip),
          metaTitle: trip.metaTitle || '',
          metaDescription: trip.metaDescription || '',
          ogImage: trip.ogImage || ''
        });
        this.loadedOgImage = trip.ogImage || '';
        this.itineraryDays = this.parseItineraryDays(trip.itinerary || '');
        this.paymentBlocks = this.parsePaymentBlocks(trip.paymentMethods);
        this.tripForm.markAsPristine();
        this.lastExchangeRate = trip.foreignExchangeRate ?? undefined;
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
    if (this.saving || this.validatingPdf) return;
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

      // O recálculo acima roda depois da validação inicial e pode limpar o preço
      // (cotação apagada/zerada enquanto o form estava aberto). Sem esta segunda
      // checagem a viagem era gravada com preço 0 e o site mostrava "Consulte".
      if (this.tripForm.invalid) {
        this.tripForm.markAllAsTouched();
        this.error = 'Não foi possível calcular o preço em reais. Confira a cotação da moeda em "Cotações de câmbio" e tente novamente.';
        this.markSaving(false, false);
        this.cdr.markForCheck();
        return;
      }

      const value = this.tripForm.getRawValue();
      const {
        includedText,
        notIncludedText,
        mainImage,
        experienceImages,
        hotels,
        itineraryPdf,
        ogImage,
        ...baseValue
      } = value;

      const mainImageFile = mainImage instanceof File ? mainImage : null;
      const existingMainImage = mainImage instanceof File ? '' : String(mainImage || '');
      const ogImageFile = ogImage instanceof File ? ogImage : null;
      // Mantém a imagem publicada enquanto uma substituição está pendente.
      const existingOgImage = ogImageFile ? this.loadedOgImage : String(ogImage || '');

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
      // A home e a listagem hoje filtram por `menuIds` (sincronizado com os menus
      // do header). O `tripType` é mantido apenas como campo legado/compatibilidade
      // para viagens antigas sem `menuIds`; derivamos um valor coerente aqui.
      const derivedType = this.deriveLegacyTripType(menuIds);

      const tripData: Partial<Trip> = {
        ...baseValue,
        menuIds,
        tripType: derivedType,
        // null (e não undefined) para o "Sem tag" apagar a tag ao editar.
        tagId: baseValue.tagId ?? null,
        mainImage: existingMainImage,
        ogImage: existingOgImage,
        foreignPrice: baseValue.foreignCurrency ? (parseForeignAmount(baseValue.foreignPrice) ?? '') : '',
        // `null` e não `undefined`: o update usa merge, então undefined seria
        // removido do payload e a cotação antiga continuaria gravada no doc.
        foreignExchangeRate: baseValue.foreignCurrency ? (this.lastExchangeRate ?? null) : null,
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
        ? await firstValueFrom(this.tripService.updateTrip(this.tripId, tripData, true))
        : await firstValueFrom(this.tripService.createTrip(tripData, true));

      const tripIdToUse = saved?.id || this.tripId;
      // Se um upload falhar, a próxima tentativa atualiza a viagem já criada.
      if (tripIdToUse) {
        this.tripId = tripIdToUse;
        this.isEditMode = true;
      }

      const pendingExperienceFiles = galleryItems.filter(item => item instanceof File) as File[];
      const pendingHotelItems = hotelItems.filter(item => item.image instanceof File);

      const pdfFile = itineraryPdf instanceof File ? itineraryPdf : null;
      const hasUploads = mainImageFile || ogImageFile || pdfFile || pendingExperienceFiles.length > 0 || pendingHotelItems.length > 0;

      if (hasUploads && tripIdToUse) {
        const totalUploads = (mainImageFile ? 1 : 0) + (ogImageFile ? 1 : 0) + (pdfFile ? 1 : 0) + pendingExperienceFiles.length + pendingHotelItems.length;
        let done = 0;
        const updateStep = () => {
          done++;
          this.savingStep = `Enviando arquivos (${done}/${totalUploads})...`;
          this.cdr.markForCheck();
        };

        this.savingStep = `Enviando arquivos (0/${totalUploads})...`;
        const updates: Partial<Trip> = {};

        try {
          if (ogImageFile) {
            const uploaded = await firstValueFrom(
              this.uploadService.uploadToEntity(ogImageFile, 'viagens', tripIdToUse).pipe(timeout(60000))
            );
            updates.ogImage = uploaded.url;
            updateStep();
          }

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

          if (pdfFile) {
            this.savingStep = 'Enviando PDF do roteiro...';
            this.cdr.markForCheck();
            const uploaded = await firstValueFrom(this.uploadService.uploadTripPdf(pdfFile, tripIdToUse).pipe(timeout(120000)));
            updates.itineraryPdfUrl = uploaded.url;
            updates.itineraryPdfName = uploaded.filename;
            updateStep();
          }

          if (Object.keys(updates).length > 0) {
            this.savingStep = 'Finalizando...';
            await firstValueFrom(this.tripService.updateTrip(tripIdToUse, updates, true));
          }
        } catch (uploadErr: any) {
          this.error = `Viagem salva, mas não foi possível concluir os anexos: ${uploadErr?.message || 'erro desconhecido'}`;
          console.error('Upload error', uploadErr);
          this.saving = false;
          this.savingStep = '';
          this.markSaving(false, false);
          throw uploadErr;
        }
      }

      this.tripForm.markAsPristine();
      this.markSaving(false, true);
      this.router.navigate(['/admin/viagens']);
    } catch (err: any) {
      this.error ||= err?.message || 'Erro ao salvar viagem. Verifique permissão do Firestore.';
      this.markSaving(false, false);
      throw err;
    } finally {
      this.saving = false;
      this.savingStep = '';
      this.cdr.markForCheck();
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
        this.exchangeRateText = `Cadastre a cotação do ${currency} em "Cotações de câmbio", no menu lateral.`;
        this.lastExchangeRate = undefined;
        this.cdr.markForCheck();
        return;
      }

      const brlValue = foreignAmount * rate;
      this.lastExchangeRate = rate;
      priceControl?.setValue(Number(brlValue.toFixed(2)), { emitEvent: false });
      this.exchangeRateText = `Câmbio usado: 1 ${currency} = R$ ${rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      // App é zoneless: sem isto o preço calculado só repinta no próximo evento.
      this.cdr.markForCheck();
    };

    if (waitForResult) {
      const rate = await firstValueFrom(this.exchangeRateService.getCurrencyRate(currency));
      applyRate(rate.value);
      return;
    }

    this.exchangeRateService.getCurrencyRate(currency).subscribe(rate => applyRate(rate.value));
  }

  /**
   * Descobre a moeda de uma viagem antiga gravada sem `foreignCurrency`. Só
   * infere quando o próprio valor traz o símbolo/código (ex.: "US$ 4.990,00");
   * para um número puro devolve '' — não dá para adivinhar, e chutar dólar
   * recalcularia o preço em reais em cima de uma cotação que não é a daquela viagem.
   */
  private detectCurrency(value?: number | string): ForeignCurrencyCode | '' {
    if (!value) {
      return '';
    }

    return detectCurrencyCode(value);
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
