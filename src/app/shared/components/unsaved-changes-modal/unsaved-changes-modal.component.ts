import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type UnsavedAction = 'save' | 'discard' | 'cancel';

@Component({
  selector: 'app-unsaved-changes-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (show) {
      <div class="uc-overlay" (click)="emit('cancel')" role="dialog" aria-modal="true" aria-labelledby="uc-title">
        <div class="uc-card" (click)="$event.stopPropagation()">
          <div class="uc-header">
            <div class="uc-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 id="uc-title" class="uc-title">Alterações não salvas</h2>
              <p class="uc-subtitle">Você fez modificações que ainda não foram salvas.</p>
            </div>
          </div>

          @if (changedFields.length > 0) {
            <div class="uc-changes">
              <span class="uc-changes__label">Campos modificados:</span>
              <ul class="uc-changes__list">
                @for (field of visibleFields(); track field) {
                  <li>{{ field }}</li>
                }
                @if (changedFields.length > maxVisible) {
                  <li class="uc-changes__more">+ {{ changedFields.length - maxVisible }} outros</li>
                }
              </ul>
            </div>
          }

          <p class="uc-question">O que deseja fazer?</p>

          <div class="uc-actions">
            <button type="button" class="uc-btn uc-btn--ghost" (click)="emit('cancel')">
              Continuar editando
            </button>
            <button type="button" class="uc-btn uc-btn--danger" (click)="emit('discard')">
              Descartar alterações
            </button>
            <button
              type="button"
              class="uc-btn uc-btn--primary"
              (click)="emit('save')"
              [disabled]="!canSave"
              [title]="canSave ? '' : 'Há campos inválidos no formulário'">
              Salvar agora
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './unsaved-changes-modal.component.scss'
})
export class UnsavedChangesModalComponent {
  @Input() show = false;
  @Input() canSave = false;
  @Input() changedFields: string[] = [];
  @Input() maxVisible = 6;

  @Output() resolved = new EventEmitter<UnsavedAction>();

  emit(action: UnsavedAction) {
    this.resolved.emit(action);
  }

  visibleFields(): string[] {
    return this.changedFields.slice(0, this.maxVisible);
  }
}
