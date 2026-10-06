import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Inject,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => RichTextEditorComponent),
    multi: true
  }]
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit {
  @Input() entityId: number | string = 'draft';
  @Input() invalid = false;
  @Output() busyChange = new EventEmitter<boolean>();

  @ViewChild('editor') private editorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') private fileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('galleryInput') private galleryInputRef?: ElementRef<HTMLInputElement>;

  value = '';
  disabled = false;
  sourceMode = false;
  uploading = false;
  /** Progresso do envio da galeria, ex.: "2/5". */
  galleryProgress = '';
  uploadError = '';
  mediaUrls: string[] = [];

  private viewReady = false;
  private savedRange: Range | null = null;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderValue();
  }

  writeValue(value: string | null): void {
    this.value = value || '';
    this.refreshMediaLibrary();
    this.renderValue();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  onEditorInput(): void {
    const html = this.editorRef?.nativeElement.innerHTML || '';
    this.commit(html === '<br>' ? '' : html);
    this.rememberSelection();
  }

  onSourceInput(event: Event): void {
    this.commit((event.target as HTMLTextAreaElement).value);
  }

  toggleSourceMode(): void {
    if (this.sourceMode) {
      this.sourceMode = false;
      queueMicrotask(() => this.renderValue());
    } else {
      this.value = this.editorRef?.nativeElement.innerHTML || this.value;
      this.sourceMode = true;
    }
    this.onTouched();
  }

  formatBlock(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.execute('formatBlock', select.value);
    select.value = 'p';
  }

  execute(command: string, value?: string): void {
    if (this.disabled) return;
    this.restoreSelection();
    this.document.execCommand(command, false, value);
    this.editorRef?.nativeElement.focus();
    this.onEditorInput();
  }

  preserveSelection(event: MouseEvent): void {
    event.preventDefault();
    this.rememberSelection();
  }

  rememberSelection(): void {
    const selection = this.document.getSelection();
    const editor = this.editorRef?.nativeElement;
    if (!selection?.rangeCount || !editor) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      this.savedRange = range.cloneRange();
    }
  }

  markTouched(): void {
    this.rememberSelection();
    this.onTouched();
  }

  insertLink(): void {
    if (this.disabled) return;
    this.rememberSelection();
    const view = this.document.defaultView;
    const rawUrl = view?.prompt('Cole o endereço do link (https://...):', 'https://')?.trim();
    if (!rawUrl) return;
    const url = this.normalizeUrl(rawUrl);
    if (!url) {
      this.uploadError = 'Endereço de link inválido.';
      return;
    }

    this.restoreSelection();
    const selection = this.document.getSelection();
    if (selection && !selection.isCollapsed) {
      this.document.execCommand('createLink', false, url);
      const anchor = selection.anchorNode?.parentElement?.closest('a');
      anchor?.setAttribute('target', '_blank');
      anchor?.setAttribute('rel', 'noopener noreferrer');
    } else {
      const label = view?.prompt('Texto que será exibido:', rawUrl)?.trim() || rawUrl;
      this.insertHtml(`<a href="${this.escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(label)}</a>`);
    }
    this.onEditorInput();
  }

  insertImageFromUrl(): void {
    if (this.disabled) return;
    this.rememberSelection();
    const view = this.document.defaultView;
    const rawUrl = view?.prompt('Cole a URL pública da imagem:', 'https://')?.trim();
    if (!rawUrl) return;
    const url = this.normalizeUrl(rawUrl, true);
    if (!url) {
      this.uploadError = 'URL de imagem inválida.';
      return;
    }
    const alt = view?.prompt('Texto alternativo da imagem (importante para acessibilidade e SEO):', '')?.trim() || '';
    this.insertImage(url, alt);
  }

  chooseImage(): void {
    if (this.disabled || this.uploading) return;
    this.rememberSelection();
    this.fileInputRef?.nativeElement.click();
  }

  async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const validation = this.uploadService.validateImage(file);
    if (!validation.valid) {
      this.uploadError = validation.error || 'Imagem inválida.';
      return;
    }

    this.uploading = true;
    this.busyChange.emit(true);
    this.uploadError = '';
    this.cdr.markForCheck();
    try {
      const uploaded = await firstValueFrom(
        this.uploadService.uploadToEntity(file, 'posts', this.entityId)
      );
      const defaultAlt = this.altFromFileName(file);
      const alt = this.document.defaultView?.prompt(
        'Texto alternativo da imagem (importante para acessibilidade e SEO):',
        defaultAlt
      )?.trim() || defaultAlt;
      this.insertImage(uploaded.url, alt);
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'Não foi possível enviar a imagem.';
    } finally {
      this.uploading = false;
      this.busyChange.emit(false);
      this.cdr.markForCheck();
    }
  }

  chooseGallery(): void {
    if (this.disabled || this.uploading) return;
    this.rememberSelection();
    this.galleryInputRef?.nativeElement.click();
  }

  /**
   * Envia várias imagens e insere uma galeria (.post-gallery) na posição do
   * cursor. Com o cursor dentro de uma galeria existente, as fotos são
   * acrescentadas a ela. No site, a galeria vira uma grade com lightbox.
   */
  async uploadGallery(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;

    const valid = files.filter(file => this.uploadService.validateImage(file).valid);
    const failed = files.filter(file => !valid.includes(file)).map(file => file.name);
    if (!valid.length) {
      this.uploadError = 'Nenhuma imagem válida selecionada. Use JPG, PNG ou WebP de até 5MB.';
      return;
    }

    this.uploading = true;
    this.busyChange.emit(true);
    this.uploadError = '';
    const figures: string[] = [];
    try {
      for (const [index, file] of valid.entries()) {
        this.galleryProgress = `${index + 1}/${valid.length}`;
        this.cdr.markForCheck();
        try {
          const uploaded = await firstValueFrom(this.uploadService.uploadToEntity(file, 'posts', this.entityId));
          figures.push(`<figure><img src="${this.escapeAttribute(uploaded.url)}" alt="${this.escapeAttribute(this.altFromFileName(file))}"></figure>`);
        } catch {
          failed.push(file.name);
        }
      }

      if (figures.length) {
        this.insertGallery(figures.join(''));
      }
      if (failed.length) {
        this.uploadError = `Não foi possível adicionar à galeria: ${failed.join(', ')}. Use JPG, PNG ou WebP de até 5MB.`;
      }
    } finally {
      this.uploading = false;
      this.galleryProgress = '';
      this.busyChange.emit(false);
      this.cdr.markForCheck();
    }
  }

  insertExistingImage(url: string): void {
    this.rememberSelection();
    const alt = this.document.defaultView?.prompt('Texto alternativo da imagem:', '')?.trim() || '';
    this.insertImage(url, alt);
  }

  handlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') || '';
    const normalized = html ? this.cleanPastedHtml(html) : this.plainTextToHtml(text);
    this.insertHtml(normalized);
  }

  private insertImage(url: string, alt: string): void {
    this.insertHtml(
      `<figure><img src="${this.escapeAttribute(url)}" alt="${this.escapeAttribute(alt)}"><figcaption>${this.escapeHtml(alt)}</figcaption></figure><p><br></p>`
    );
  }

  private insertGallery(figuresHtml: string): void {
    const gallery = this.galleryAtSelection();
    if (gallery) {
      gallery.insertAdjacentHTML('beforeend', figuresHtml);
      this.onEditorInput();
      return;
    }
    this.insertHtml(`<div class="post-gallery">${figuresHtml}</div><p><br></p>`);
  }

  private galleryAtSelection(): HTMLElement | null {
    const node = this.savedRange?.commonAncestorContainer;
    const element = node instanceof Element ? node : node?.parentElement;
    const gallery = element?.closest<HTMLElement>('.post-gallery') ?? null;
    return gallery && this.editorRef?.nativeElement.contains(gallery) ? gallery : null;
  }

  private altFromFileName(file: File): string {
    return file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  }

  private insertHtml(html: string): void {
    this.restoreSelection();
    this.document.execCommand('insertHTML', false, html);
    this.editorRef?.nativeElement.focus();
    this.onEditorInput();
  }

  private restoreSelection(): void {
    const editor = this.editorRef?.nativeElement;
    if (!editor) return;
    editor.focus();
    const selection = this.document.getSelection();
    selection?.removeAllRanges();
    if (this.savedRange) {
      selection?.addRange(this.savedRange);
      return;
    }
    const range = this.document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.addRange(range);
  }

  private renderValue(): void {
    if (!this.viewReady || this.sourceMode || !this.editorRef) return;
    if (this.editorRef.nativeElement.innerHTML !== this.value) {
      this.editorRef.nativeElement.innerHTML = this.value;
    }
  }

  private commit(value: string): void {
    this.value = value;
    this.refreshMediaLibrary();
    this.onChange(value);
    this.onTouched();
  }

  private refreshMediaLibrary(): void {
    const template = this.document.createElement('template');
    template.innerHTML = this.value;
    this.mediaUrls = [...new Set(
      Array.from(template.content.querySelectorAll('img'))
        .map(image => image.getAttribute('src') || '')
        .filter(Boolean)
    )];
  }

  private cleanPastedHtml(html: string): string {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, 'text/html');
    const allowed = new Set([
      'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U',
      'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR', 'HR', 'IMG', 'FIGURE',
      'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'
    ]);

    const elements = Array.from(parsed.body.querySelectorAll('*'));
    for (const element of elements) {
      if (!allowed.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        const keep = (element.tagName === 'A' && ['href', 'target', 'rel'].includes(attribute.name))
          || (element.tagName === 'IMG' && ['src', 'alt'].includes(attribute.name));
        if (!keep) element.removeAttribute(attribute.name);
      }

      if (element.tagName === 'A') {
        const safeUrl = this.normalizeUrl(element.getAttribute('href') || '');
        if (!safeUrl) {
          element.removeAttribute('href');
        } else {
          element.setAttribute('href', safeUrl);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }

      if (element.tagName === 'IMG') {
        const safeUrl = this.normalizeUrl(element.getAttribute('src') || '', true);
        if (!safeUrl) {
          element.remove();
        } else {
          element.setAttribute('src', safeUrl);
        }
      }
    }

    return parsed.body.innerHTML;
  }

  private plainTextToHtml(text: string): string {
    return text
      .split(/\r?\n\r?\n/)
      .map(paragraph => `<p>${this.escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
  }

  private normalizeUrl(value: string, image = false): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!image && /^(mailto:|tel:|#)/i.test(trimmed)) return trimmed;
    try {
      const parsed = new URL(trimmed, this.document.baseURI);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
      return null;
    }
  }

  private escapeHtml(value: string): string {
    const node = this.document.createElement('div');
    node.textContent = value;
    return node.innerHTML;
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }
}
