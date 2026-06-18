import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CurrencyEntry, ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-moeda',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './moeda.component.html',
  styleUrl: './moeda.component.scss'
})
export class MoedaComponent implements OnInit {
  currencies: CurrencyEntry[] = [];
  loading = true;
  saving = false;
  updatedAt: Date | null = null;

  // ---------- Modal de cadastro/edição ----------
  modalOpen = false;
  /** índice da moeda em edição; null = cadastro de nova. */
  editingIndex: number | null = null;
  currencyForm: FormGroup;
  modalError = '';

  constructor(
    private exchangeRateService: ExchangeRateService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {
    this.currencyForm = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(6)]],
      name: ['', [Validators.required]],
      symbol: [''],
      rate: ['']
    });
  }

  ngOnInit() {
    this.exchangeRateService.loadRates().subscribe(rates => {
      this.currencies = rates.currencies.map(c => ({ ...c }));
      this.updatedAt = rates.updatedAt || null;
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  // ---------- Abrir/fechar modal ----------
  openCreate() {
    this.editingIndex = null;
    this.modalError = '';
    this.currencyForm.reset({ code: '', name: '', symbol: '', rate: '' });
    this.modalOpen = true;
  }

  openEdit(index: number) {
    const c = this.currencies[index];
    if (!c) return;
    this.editingIndex = index;
    this.modalError = '';
    this.currencyForm.reset({
      code: c.code || '',
      name: c.name || '',
      symbol: c.symbol || '',
      rate: c.rate ?? ''
    });
    this.modalOpen = true;
  }

  closeModal() {
    if (this.saving) return;
    this.modalOpen = false;
    this.editingIndex = null;
    this.modalError = '';
  }

  // ---------- Salvar (cadastro ou edição) ----------
  async submitCurrency() {
    if (this.saving) return;

    if (this.currencyForm.invalid) {
      this.currencyForm.markAllAsTouched();
      this.modalError = 'Preencha código e nome da moeda.';
      return;
    }

    const entry: CurrencyEntry = {
      code: String(this.currencyForm.value.code || '').toUpperCase().trim(),
      name: String(this.currencyForm.value.name || '').trim(),
      symbol: String(this.currencyForm.value.symbol || '').trim() || undefined,
      rate: this.parseRate(this.currencyForm.value.rate)
    };

    // Código único (ignora a própria moeda ao editar).
    const duplicate = this.currencies.some((c, i) => i !== this.editingIndex && c.code.toUpperCase() === entry.code);
    if (duplicate) {
      this.modalError = `Já existe uma moeda com o código ${entry.code}.`;
      return;
    }

    const next = [...this.currencies];
    if (this.editingIndex === null) {
      next.push(entry);
    } else {
      next[this.editingIndex] = entry;
    }

    await this.persist(next, this.editingIndex === null ? 'Moeda cadastrada com sucesso.' : 'Moeda atualizada com sucesso.');
  }

  async removeCurrency(index: number) {
    if (this.saving) return;
    const c = this.currencies[index];
    if (!c) return;
    if (!confirm(`Excluir a moeda ${c.code}?`)) return;
    const next = this.currencies.filter((_, i) => i !== index);
    await this.persist(next, 'Moeda excluída com sucesso.');
  }

  /** Persiste a lista completa no Firebase e atualiza o estado/feedback. */
  private async persist(next: CurrencyEntry[], successMsg: string) {
    this.saving = true;
    this.cdr.detectChanges();
    try {
      const saved = await firstValueFrom(this.exchangeRateService.saveRates(next));
      this.currencies = saved.currencies.map(c => ({ ...c }));
      this.updatedAt = saved.updatedAt || new Date();
      this.toast.success(successMsg);
      this.modalOpen = false;
      this.editingIndex = null;
    } catch (err: any) {
      this.toast.error(err?.message || 'Erro ao salvar cotações.');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  formatRate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) return '—';
    return rate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private parseRate(value: string | number | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
}
