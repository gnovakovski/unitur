import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { UploadService } from '../../../core/services/upload.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { ForeignCurrencyCode, formatForeignCurrency, getCurrencyCode } from '../../../core/utils/currency-format';
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
  private lastExchangeRate: number | undefined;

  protected fieldLabels: Record<string, string> = {
    title: 'Nome da viagem',
    tripType: 'Tipo',
    country: 'País',
    period: 'Período',
    startDate: 'Data de embarque',
    duration: 'Duração',
    availableSpots: 'Vagas',
    price: 'Preço',
    foreignCurrency: 'Moeda estrangeira',
    foreignPrice: 'Valor convertido',
    status: 'Status',
    spiritualGuide: 'Guia espiritual',
    coordinator: 'Coordenador',
    showAvailableSpots: 'Exibir vagas',
    mainImage: 'Imagem principal',
    shortDescription: 'Chamada curta',
    description: 'Descrição completa',
    experienceImages: 'Galeria da experiência',
    hotels: 'Hotéis',
    itinerary: 'Roteiro',
    paymentMethodsText: 'Formas de pagamento',
    includedText: 'Incluso',
    notIncludedText: 'Não incluso',
    cancellationPolicy: 'Política de cancelamento'
  };

  protected getMainForm(): FormGroup { return this.tripForm; }
  protected async triggerSave(): Promise<void> { await this.saveTrip(); }

  constructor(
    private fb: FormBuilder,
    private tripService: TripService,
    private uploadService: UploadService,
    private exchangeRateService: ExchangeRateService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    super();
    this.tripForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      tripType: ['peregrinacao', [Validators.required]],
      country: ['', [Validators.required]],
      period: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      duration: [1, [Validators.required, Validators.min(1)]],
      availableSpots: [0, [Validators.required, Validators.min(0)]],
      price: ['', [Validators.required, Validators.min(1)]],
      foreignCurrency: [''],
      foreignPrice: [{ value: '', disabled: true }],
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
      paymentMethodsText: [''],
      includedText: [''],
      notIncludedText: [''],
      cancellationPolicy: ['']
    });
  }

  get canSaveTrip(): boolean {
    return this.tripForm.valid;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.tripId = Number(id);
      this.loadTrip(this.tripId);
    }

    this.tripForm.get('price')?.valueChanges.subscribe(() => this.updateConvertedPrice());
    this.tripForm.get('foreignCurrency')?.valueChanges.subscribe(() => this.updateConvertedPrice());
  }

  loadTrip(id: number) {
    this.tripService.getTrip(id).subscribe({
      next: trip => {
        this.tripForm.patchValue({
          title: trip.title,
          tripType: trip.tripType || 'regular',
          country: trip.country || trip.destination,
          period: trip.period || '',
          startDate: this.formatDateInput(trip.startDate),
          duration: trip.duration,
          availableSpots: trip.availableSpots,
          price: trip.price,
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
          paymentMethodsText: (trip.paymentMethods || []).join('\n'),
          includedText: (trip.included || []).join('\n'),
          notIncludedText: (trip.notIncluded || []).join('\n'),
          cancellationPolicy: trip.cancellationPolicy || ''
        });
        this.tripForm.markAsPristine();
        this.lastExchangeRate = trip.foreignExchangeRate;
        this.updateConvertedPrice();
      },
      error: err => {
        this.error = err?.message || 'Erro ao carregar viagem.';
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
        paymentMethodsText,
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

      const tripData: Partial<Trip> = {
        ...baseValue,
        mainImage: existingMainImage,
        foreignPrice: baseValue.foreignCurrency ? baseValue.foreignPrice : '',
        foreignExchangeRate: baseValue.foreignCurrency ? this.lastExchangeRate : undefined,
        destination: value.country,
        categoryId: 0,
        startDate,
        endDate: startDate,
        featured: value.tripType === 'curadoria',
        experienceImages: existingExperienceUrls,
        gallery: existingExperienceUrls,
        hotels: existingHotelsResolved,
        paymentMethods: this.parseLines(paymentMethodsText),
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.tripForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  private parseLines(value: string): string[] {
    return String(value || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private async updateConvertedPrice(waitForResult = false): Promise<void> {
    const price = Number(this.tripForm.get('price')?.value || 0);
    const currency = this.tripForm.get('foreignCurrency')?.value as ForeignCurrencyCode | '';
    const foreignPriceControl = this.tripForm.get('foreignPrice');

    if (!currency || !price || Number.isNaN(price)) {
      foreignPriceControl?.setValue('', { emitEvent: false });
      this.exchangeRateText = '';
      this.lastExchangeRate = undefined;
      return;
    }

    const applyRate = (rate: number | null) => {
      if (!rate) {
        foreignPriceControl?.setValue('', { emitEvent: false });
        this.exchangeRateText = 'Não foi possível carregar o câmbio.';
        this.lastExchangeRate = undefined;
        return;
      }

      const convertedValue = price / rate;
      this.lastExchangeRate = rate;
      foreignPriceControl?.setValue(formatForeignCurrency(convertedValue, currency), { emitEvent: false });
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
