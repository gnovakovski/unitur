import { ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { ImageLibraryService, LibraryImage, normalizeLibrarySearch } from '../../../core/services/image-library.service';

type LibraryFilter = 'all' | 'trip' | 'hotel';

/** Quantas fotos entram na tela por vez (as demais vêm no "Mostrar mais"). */
const PAGE_SIZE = 48;

/**
 * Janela do banco de imagens: mostra as fotos já enviadas em qualquer viagem
 * para serem reaproveitadas, sem importar o arquivo de novo.
 *
 * Quem abre decide o que fazer com as escolhidas (`confirmed`): a galeria
 * adiciona as fotos, a lista de hotéis adiciona foto + nome do hotel, e a
 * imagem principal troca a foto.
 */
@Component({
  selector: 'app-image-library-modal',
  standalone: true,
  templateUrl: './image-library-modal.component.html',
  styleUrl: './image-library-modal.component.scss'
})
export class ImageLibraryModalComponent implements OnInit {
  /** 'hotels' abre já filtrando as fotos de hotel e mostra o nome de cada um. */
  @Input() mode: 'images' | 'hotels' = 'images';
  /** false = escolhe uma foto só (imagem principal). */
  @Input() multiple = true;
  /** Limite de fotos que ainda cabem no campo (undefined = sem limite). */
  @Input() maxSelectable?: number;
  /** Fotos que já estão no campo: aparecem marcadas e não podem ser escolhidas de novo. */
  @Input() excluded: string[] = [];
  @Input() title = 'Banco de imagens';

  @Output() confirmed = new EventEmitter<LibraryImage[]>();
  @Output() cancelled = new EventEmitter<void>();

  loading = true;
  error = '';
  images: LibraryImage[] = [];
  filter: LibraryFilter = 'all';
  search = '';
  visibleCount = PAGE_SIZE;
  /** Selecionadas, na ordem em que foram clicadas (é a ordem em que entram no campo). */
  selected: LibraryImage[] = [];

  private excludedSet = new Set<string>();

  constructor(
    private library: ImageLibraryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.excludedSet = new Set(this.excluded || []);
    this.filter = this.mode === 'hotels' ? 'hotel' : 'trip';
    this.load();
  }

  load(forceReload = false): void {
    this.loading = true;
    this.error = '';
    this.library.getImages(forceReload).subscribe({
      next: images => {
        this.images = images;
        this.loading = false;
        // Sem nenhuma foto no filtro inicial (ex.: ainda não há hotéis), mostra todas.
        if (this.filtered.length === 0 && this.images.length > 0) {
          this.filter = 'all';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = 'Não foi possível carregar o banco de imagens. Verifique a conexão e tente de novo.';
        this.cdr.markForCheck();
      }
    });
  }

  /** Fotos que passam no filtro e na busca. */
  get filtered(): LibraryImage[] {
    const words = normalizeLibrarySearch(this.search).split(' ').filter(Boolean);
    return this.images.filter(image => {
      if (this.filter === 'hotel' && !image.kinds.includes('hotel')) return false;
      if (this.filter === 'trip' && !image.kinds.some(kind => kind !== 'hotel')) return false;
      return words.every(word => image.searchText.includes(word));
    });
  }

  get visible(): LibraryImage[] {
    return this.filtered.slice(0, this.visibleCount);
  }

  get hasMore(): boolean {
    return this.filtered.length > this.visibleCount;
  }

  count(filter: LibraryFilter): number {
    if (filter === 'hotel') return this.images.filter(image => image.kinds.includes('hotel')).length;
    if (filter === 'trip') return this.images.filter(image => image.kinds.some(kind => kind !== 'hotel')).length;
    return this.images.length;
  }

  setFilter(filter: LibraryFilter): void {
    this.filter = filter;
    this.visibleCount = PAGE_SIZE;
  }

  onSearch(value: string): void {
    this.search = value;
    this.visibleCount = PAGE_SIZE;
  }

  showMore(): void {
    this.visibleCount += PAGE_SIZE;
  }

  isExcluded(image: LibraryImage): boolean {
    return this.excludedSet.has(image.url);
  }

  isSelected(image: LibraryImage): boolean {
    return this.selected.some(item => item.url === image.url);
  }

  /** Posição da foto na seleção (1, 2, 3...), mostrada no canto do card. */
  selectionOrder(image: LibraryImage): number {
    return this.selected.findIndex(item => item.url === image.url) + 1;
  }

  /** true quando o limite do campo já foi atingido e a foto não está selecionada. */
  isBlocked(image: LibraryImage): boolean {
    return this.multiple && this.limitReached && !this.isSelected(image);
  }

  get limitReached(): boolean {
    return this.maxSelectable !== undefined && this.selected.length >= this.maxSelectable;
  }

  toggle(image: LibraryImage): void {
    if (this.isExcluded(image)) return;

    if (this.isSelected(image)) {
      this.selected = this.selected.filter(item => item.url !== image.url);
      return;
    }
    if (!this.multiple) {
      this.selected = [image];
      return;
    }
    if (this.limitReached) return;
    this.selected = [...this.selected, image];
  }

  /** Legenda do card: nome do hotel (na aba de hotéis) ou a viagem em que a foto está. */
  caption(image: LibraryImage): string {
    if (this.filter === 'hotel' && image.hotelName) return image.hotelName;
    return image.trips[0] || image.hotelName || 'Sem viagem';
  }

  /** Segunda linha do card: onde mais a foto aparece. */
  usage(image: LibraryImage): string {
    // Aba de hotéis: a legenda é o hotel, então aqui vão as viagens.
    if (this.filter === 'hotel' && image.hotelName) {
      if (image.trips.length === 0) return '';
      return image.trips.length === 1 ? image.trips[0] : `${image.trips.length} viagens`;
    }
    // Demais abas: a legenda é a 1ª viagem; aqui, quantas outras usam a foto.
    const others = image.trips.length - 1;
    if (others > 0) return others === 1 ? '+ 1 viagem' : `+ ${others} viagens`;
    return image.hotelName ? `Hotel: ${image.hotelName}` : '';
  }

  tooltip(image: LibraryImage): string {
    const lines = image.trips.length ? [`Usada em: ${image.trips.join(' · ')}`] : [];
    if (image.hotelName) lines.unshift(`Hotel: ${image.hotelName}`);
    return lines.join('\n');
  }

  get confirmLabel(): string {
    if (!this.multiple) return 'Usar esta foto';
    const total = this.selected.length;
    if (total === 0) return 'Adicionar';
    return total === 1 ? 'Adicionar 1 foto' : `Adicionar ${total} fotos`;
  }

  confirm(): void {
    if (this.selected.length === 0) return;
    this.confirmed.emit(this.selected);
  }

  cancel(): void {
    this.cancelled.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }
}
