import { Directive, HostListener, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { CanComponentDeactivate } from '../../../core/guards/unsaved-changes.guard';
import { UnsavedAction } from './unsaved-changes-modal.component';

/**
 * Base reutilizável para qualquer componente admin que tenha um form com
 * cadastro/edição. Implementa:
 *  - detecção de mudanças (via FormGroup.dirty + comparação opcional)
 *  - modal de "alterações não salvas" antes de sair (canDeactivate)
 *  - aviso nativo do browser ao fechar a aba (beforeunload)
 *
 * Cada subclasse deve:
 *  - expor o FormGroup via `protected getMainForm()`
 *  - expor um dicionário `protected fieldLabels: Record<string, string>` para
 *    transformar nomes técnicos de campos em labels amigáveis
 *  - sinalizar quando o save começou/terminou via `markSaving(true|false)` —
 *    isso evita disparar o modal logo após o submit válido.
 *  - chamar `triggerSave()` quando o modal pedir "Salvar agora".
 */
@Directive()
export abstract class UnsavedFormBase implements CanComponentDeactivate, OnDestroy {
  /** Flag que o template lê para abrir o modal. */
  unsavedModalOpen = false;
  changedFields: string[] = [];

  protected isSaving = false;
  protected savedSuccessfully = false;
  protected destroyed$ = new Subject<void>();

  /** Resolve() do canDeactivate pendente, esperando o usuário decidir. */
  private pendingDecision: ((value: boolean) => void) | null = null;

  protected abstract getMainForm(): FormGroup;
  protected abstract fieldLabels: Record<string, string>;

  /** Chamada pelo botão "Salvar agora" do modal. Default = clica o submit do form. */
  protected abstract triggerSave(): void | Promise<void>;

  // ---------- Hooks de subclasse ----------
  protected markSaving(saving: boolean, success = false) {
    this.isSaving = saving;
    if (!saving && success) {
      this.savedSuccessfully = true;
    }
  }

  // ---------- canDeactivate (router) ----------
  canDeactivate(): boolean | Observable<boolean> | Promise<boolean> {
    if (!this.hasUnsavedChanges()) return true;

    this.changedFields = this.computeChangedFields();
    this.unsavedModalOpen = true;

    return new Promise<boolean>(resolve => {
      this.pendingDecision = resolve;
    });
  }

  // ---------- Resposta do modal ----------
  async onUnsavedResolved(action: UnsavedAction) {
    if (action === 'cancel') {
      this.unsavedModalOpen = false;
      this.resolvePending(false);
      return;
    }

    if (action === 'discard') {
      this.unsavedModalOpen = false;
      // Marca como pristine para o canDeactivate não disparar de novo
      this.getMainForm().markAsPristine();
      this.savedSuccessfully = true; // libera beforeunload
      this.resolvePending(true);
      return;
    }

    if (action === 'save') {
      this.unsavedModalOpen = false;
      try {
        await this.triggerSave();
        // Após save bem-sucedido, libera saída. Subclasses já marcam isSaving=false
        // e savedSuccessfully via markSaving().
        this.getMainForm().markAsPristine();
        this.resolvePending(true);
      } catch {
        // Save falhou — bloqueia saída
        this.resolvePending(false);
      }
    }
  }

  // ---------- beforeunload (fechar aba/navegar fora) ----------
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      // Mensagem é ignorada por browsers modernos, mas é necessário setar algo.
      event.returnValue = '';
    }
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  // ---------- Helpers ----------
  protected hasUnsavedChanges(): boolean {
    if (this.isSaving || this.savedSuccessfully) return false;
    const form = this.getMainForm();
    return !!form && form.dirty;
  }

  /** Público para uso no template (modal). */
  canSubmit(): boolean {
    return this.getMainForm().valid;
  }

  protected computeChangedFields(): string[] {
    const form = this.getMainForm();
    if (!form) return [];
    const labels: string[] = [];
    Object.keys(form.controls).forEach(name => {
      const control = form.get(name);
      if (control && control.dirty) {
        labels.push(this.fieldLabels[name] || name);
      }
    });
    return labels;
  }

  private resolvePending(value: boolean) {
    if (this.pendingDecision) {
      this.pendingDecision(value);
      this.pendingDecision = null;
    }
  }
}
