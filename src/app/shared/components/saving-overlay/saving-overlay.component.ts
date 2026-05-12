import { CommonModule } from '@angular/common';
import { Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'app-saving-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (show) {
      <div class="saving-overlay" role="alertdialog" aria-live="assertive" aria-busy="true">
        <div class="saving-overlay__card">
          <div class="saving-overlay__spinner" aria-hidden="true">
            <svg viewBox="0 0 50 50">
              <circle class="saving-overlay__spinner-track" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
              <circle class="saving-overlay__spinner-arc" cx="25" cy="25" r="20" fill="none" stroke-width="4" stroke-linecap="round"></circle>
            </svg>
          </div>
          <h3 class="saving-overlay__title">{{ title }}</h3>
          <p class="saving-overlay__message">{{ message }}</p>
        </div>
      </div>
    }
  `,
  styleUrl: './saving-overlay.component.scss'
})
export class SavingOverlayComponent {
  @Input() show = false;
  @Input() title = 'Salvando...';
  @Input() message = 'Aguarde enquanto processamos suas alterações.';

  @HostBinding('attr.data-active') get active() { return this.show ? '' : null; }
}
