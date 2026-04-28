import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-depoimentos-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Depoimentos</h1>
        <button class="btn-primary">
          <span>➕</span> Novo Depoimento
        </button>
      </div>
      <div class="empty-state">
        <span class="empty-icon">💬</span>
        <h3>Nenhum depoimento cadastrado</h3>
        <p>Adicione feedback de clientes satisfeitos</p>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .page-header h1 { font-size: 2rem; color: #1a1a2e; margin: 0; }
    .btn-primary { padding: 0.75rem 1.5rem; background: #ff812c; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }
    .btn-primary:hover { background: #e67424; }
    .empty-state { text-align: center; padding: 4rem 2rem; background: white; border-radius: 12px; }
    .empty-icon { font-size: 4rem; display: block; margin-bottom: 1rem; }
    .empty-state h3 { color: #1a1a2e; margin-bottom: 0.5rem; }
    .empty-state p { color: #6C757D; }
  `]
})
export class DepoimentosListComponent {}
