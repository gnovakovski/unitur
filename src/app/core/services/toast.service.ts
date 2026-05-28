import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<ToastMessage[]>([]);

  success(text: string, durationMs = 3500) { this.push('success', text, durationMs); }
  error(text: string, durationMs = 4500) { this.push('error', text, durationMs); }
  info(text: string, durationMs = 3000) { this.push('info', text, durationMs); }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(kind: ToastKind, text: string, durationMs: number) {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
