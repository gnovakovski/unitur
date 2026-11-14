import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsletterService, NewsletterSubscriber } from '../../../core/services/newsletter.service';

@Component({
  selector: 'app-newsletter-list',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './newsletter-list.component.html',
  styleUrl: './newsletter-list.component.scss'
})
export class NewsletterListComponent implements OnInit {
  subscribers: NewsletterSubscriber[] = [];
  loading = false;
  error = '';
  private readonly newsletter = inject(NewsletterService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      this.subscribers = await this.newsletter.getSubscribers();
    } catch {
      this.error = 'Não foi possível carregar os inscritos. Tente novamente.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  exportCsv(): void {
    const cell = (value: string) => `"${value.replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const rows = [['Nome', 'E-mail', 'Data de cadastro'], ...this.subscribers.map(s => [
      s.name, s.email, s.createdAt?.toLocaleString('pt-BR') || ''
    ])];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'unitur-newsletter.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
