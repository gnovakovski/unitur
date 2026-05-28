import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.kind }}" (click)="toastService.dismiss(toast.id)">
          <span class="toast__icon">
            @switch (toast.kind) {
              @case ('success') { ✓ }
              @case ('error') { ✕ }
              @case ('info') { i }
            }
          </span>
          <span class="toast__text">{{ toast.text }}</span>
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.component.scss'
})
export class ToastHostComponent {
  toastService = inject(ToastService);
}
