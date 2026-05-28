import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ChangeDiff {
  label: string;
  before: string;
  after: string;
}

@Component({
  selector: 'app-confirm-save-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (show) {
      <div class="cs-overlay" (click)="cancel.emit()" role="dialog" aria-modal="true" aria-labelledby="cs-title">
        <div class="cs-card" (click)="$event.stopPropagation()">
          <div class="cs-header">
            <div class="cs-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <h2 id="cs-title" class="cs-title">Confirmar alterações</h2>
              <p class="cs-subtitle">Revise abaixo as mudanças antes de salvar.</p>
            </div>
          </div>

          @if (changes.length === 0) {
            <p class="cs-empty">Nenhuma alteração detectada.</p>
          } @else {
            <ul class="cs-list">
              @for (change of changes; track change.label) {
                <li class="cs-item">
                  <span class="cs-item__label">{{ change.label }}</span>
                  <div class="cs-item__diff">
                    <div class="cs-item__before">
                      <span class="cs-item__tag">Antes</span>
                      <span class="cs-item__text">{{ change.before || '—' }}</span>
                    </div>
                    <div class="cs-item__arrow">→</div>
                    <div class="cs-item__after">
                      <span class="cs-item__tag cs-item__tag--after">Depois</span>
                      <span class="cs-item__text">{{ change.after || '—' }}</span>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }

          <div class="cs-actions">
            <button type="button" class="cs-btn cs-btn--ghost" (click)="cancel.emit()" [disabled]="saving">
              Cancelar
            </button>
            <button type="button" class="cs-btn cs-btn--primary" (click)="confirm.emit()" [disabled]="saving || changes.length === 0">
              {{ saving ? 'Salvando...' : 'Confirmar e salvar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './confirm-save-modal.component.scss'
})
export class ConfirmSaveModalComponent {
  @Input() show = false;
  @Input() saving = false;
  @Input() changes: ChangeDiff[] = [];

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
