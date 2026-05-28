import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { DEFAULT_HOME_CONTENT, SiteHomeContent } from '../../../core/models/site-content.model';
import { SiteContentService } from '../../../core/services/site-content.service';
import { ToastService } from '../../../core/services/toast.service';
import { UnsavedFormBase } from '../../../shared/components/unsaved-changes-modal/unsaved-form.base';
import { UnsavedChangesModalComponent } from '../../../shared/components/unsaved-changes-modal/unsaved-changes-modal.component';
import { ChangeDiff, ConfirmSaveModalComponent } from '../../../shared/components/confirm-save-modal/confirm-save-modal.component';

@Component({
  selector: 'app-home-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, UnsavedChangesModalComponent, ConfirmSaveModalComponent],
  templateUrl: './home-form.component.html',
  styleUrl: './home-form.component.scss'
})
export class HomeFormComponent extends UnsavedFormBase implements OnInit {
  form: FormGroup;
  loading = true;
  saving = false;
  saved = false;
  error = '';

  /** Snapshot do conteúdo carregado — usado para calcular o diff antes de salvar. */
  private originalValues: Partial<SiteHomeContent> = {};

  confirmSaveOpen = false;
  pendingChanges: ChangeDiff[] = [];

  protected fieldLabels: Record<string, string> = {
    searchTitle: 'Buscador · Frase principal',
    peregrinacoesTitle: 'Peregrinações · Título',
    peregrinacoesSubtitle: 'Peregrinações · Subtítulo',
    regularesTitle: 'Viagens Regulares · Título',
    regularesSubtitle: 'Viagens Regulares · Subtítulo',
    worldTitle: 'Conheça o Mundo · Título',
    worldSubtitle: 'Conheça o Mundo · Subtítulo',
    curadoriaTitle: 'Curadoria · Título',
    curadoriaSubtitle: 'Curadoria · Subtítulo',
    blogTitle: 'Blog · Título',
    blogSubtitle: 'Blog · Subtítulo',
    testimonialsTitle: 'Depoimentos · Título',
    testimonialsSubtitle: 'Depoimentos · Subtítulo'
  };

  constructor(
    private fb: FormBuilder,
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router,
    private toast: ToastService
  ) {
    super();
    this.form = this.fb.group({
      searchTitle: [''],
      peregrinacoesTitle: [''],
      peregrinacoesSubtitle: [''],
      regularesTitle: [''],
      regularesSubtitle: [''],
      worldTitle: [''],
      worldSubtitle: [''],
      curadoriaTitle: [''],
      curadoriaSubtitle: [''],
      blogTitle: [''],
      blogSubtitle: [''],
      testimonialsTitle: [''],
      testimonialsSubtitle: ['']
    });
  }

  ngOnInit() {
    this.siteContentService.loadHome().pipe(timeout(12000)).subscribe({
      next: home => {
        this.ngZone.run(() => {
          const merged = { ...DEFAULT_HOME_CONTENT, ...home };
          this.form.patchValue(merged);
          this.originalValues = this.snapshotValues();
          this.form.markAsPristine();
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          this.error = err?.message || 'Não foi possível carregar o conteúdo da home.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  protected getMainForm(): FormGroup {
    return this.form;
  }

  protected triggerSave(): Promise<void> {
    return this.persist();
  }

  /** Botão "Salvar" — abre confirm modal com o diff. */
  requestSave() {
    if (this.saving) return;
    const changes = this.computeDiff();
    if (changes.length === 0) {
      this.toast.info('Nenhuma alteração para salvar.');
      return;
    }
    this.pendingChanges = changes;
    this.confirmSaveOpen = true;
  }

  onConfirmSaveCancel() {
    if (this.saving) return;
    this.confirmSaveOpen = false;
    this.pendingChanges = [];
  }

  async onConfirmSaveConfirm() {
    await this.persist();
  }

  /** Persiste de fato e trata feedback + redirect. */
  private async persist(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.error = '';
    this.saved = false;
    this.markSaving(true);
    this.cdr.detectChanges();

    try {
      await firstValueFrom(this.siteContentService.saveHome(this.form.getRawValue()));
      this.ngZone.run(() => {
        this.saving = false;
        this.confirmSaveOpen = false;
        this.pendingChanges = [];
        this.form.markAsPristine();
        this.markSaving(false, true);
        this.toast.success('Conteúdo da home salvo com sucesso.');
        this.router.navigate(['/admin/conteudo']);
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.error = err?.message || 'Falha ao salvar.';
        this.saving = false;
        this.markSaving(false, false);
        this.toast.error(this.error);
        this.cdr.detectChanges();
      });
      throw err;
    }
  }

  back() {
    this.router.navigate(['/admin/conteudo']);
  }

  // ---------- Override do unsaved modal para usar o diff completo ----------
  protected override computeChangedFields(): string[] {
    return this.computeDiff().map(c => c.label);
  }

  private computeDiff(): ChangeDiff[] {
    const current = this.snapshotValues();
    const diffs: ChangeDiff[] = [];
    (Object.keys(this.form.controls) as Array<keyof SiteHomeContent>).forEach(key => {
      const before = (this.originalValues[key] ?? '') as string;
      const after = (current[key] ?? '') as string;
      if ((before || '').trim() !== (after || '').trim()) {
        diffs.push({
          label: this.fieldLabels[key as string] || (key as string),
          before: String(before ?? ''),
          after: String(after ?? '')
        });
      }
    });
    return diffs;
  }

  private snapshotValues(): Partial<SiteHomeContent> {
    return this.form.getRawValue() as Partial<SiteHomeContent>;
  }
}
