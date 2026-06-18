import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiteContentService } from '../../core/services/site-content.service';
import { SiteContactContent } from '../../core/models/site-content.model';
import { SeoService } from '../../core/services/seo.service';
import { safeScrollToTop } from '../../core/utils/browser';

@Component({
  selector: 'app-contato',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="contato">
      <section class="contato__hero">
        <h1>Fale com a Unitur</h1>
        <p>Estamos prontos para ajudar você a planejar sua próxima viagem ou peregrinação.</p>
      </section>

      <section class="contato__grid" *ngIf="contact as c">
        <a *ngIf="c.whatsapp" class="contato__card" [href]="'https://wa.me/' + onlyDigits(c.whatsapp)" target="_blank" rel="noopener">
          <h2>WhatsApp</h2>
          <p>{{ c.whatsapp }}</p>
        </a>
        <a *ngIf="c.phone" class="contato__card" [href]="'tel:' + onlyDigits(c.phone)">
          <h2>Telefone</h2>
          <p>{{ c.phone }}</p>
        </a>
        <a *ngIf="c.email" class="contato__card" [href]="'mailto:' + c.email">
          <h2>E-mail</h2>
          <p>{{ c.email }}</p>
        </a>
        <div *ngIf="c.address || c.city" class="contato__card">
          <h2>Endereço</h2>
          <p>{{ c.address }}<span *ngIf="c.city">, {{ c.city }}</span><span *ngIf="c.cep"> — CEP {{ c.cep }}</span></p>
        </div>
      </section>
    </main>
  `,
  styles: [`
    .contato { max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
    .contato__hero { text-align: center; margin-bottom: 3rem; }
    .contato__hero h1 { font-size: 2.25rem; color: #0a3d62; margin: 0 0 0.75rem; }
    .contato__hero p { color: #555; max-width: 600px; margin: 0 auto; }
    .contato__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; }
    .contato__card { display: block; padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 12px; text-decoration: none; color: inherit; transition: box-shadow .2s; }
    .contato__card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.08); }
    .contato__card h2 { font-size: 1.1rem; color: #0a3d62; margin: 0 0 0.5rem; }
    .contato__card p { margin: 0; color: #444; }
  `]
})
export class ContatoComponent implements OnInit {
  contact: SiteContactContent | null = null;

  constructor(
    private siteContentService: SiteContentService,
    private seo: SeoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    safeScrollToTop();
    this.seo.setMeta({
      title: 'Contato | Unitur Agência de Viagens',
      description: 'Entre em contato com a Unitur por telefone, WhatsApp ou e-mail. Tire suas dúvidas e planeje sua próxima viagem ou peregrinação.',
      canonicalPath: '/contato/',
      type: 'website'
    });

    this.siteContentService.contact$.subscribe(c => {
      this.contact = c;
      this.cdr.markForCheck();
    });
    this.siteContentService.loadContact().subscribe();
  }

  onlyDigits(value: string): string {
    return (value || '').replace(/\D/g, '');
  }
}
