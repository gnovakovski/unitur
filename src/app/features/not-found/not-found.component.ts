import { Component, OnInit, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="notfound">
      <div class="notfound__box">
        <p class="notfound__code">404</p>
        <h1 class="notfound__title">Página não encontrada</h1>
        <p class="notfound__text">
          A página que você procura não existe ou foi movida. Que tal conhecer
          nossas viagens?
        </p>
        <div class="notfound__actions">
          <a routerLink="/" class="notfound__btn notfound__btn--primary">Ir para a Home</a>
          <a routerLink="/viagens" class="notfound__btn">Ver viagens</a>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .notfound { display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 4rem 1.5rem; }
    .notfound__box { text-align: center; max-width: 520px; }
    .notfound__code { font-size: 5rem; font-weight: 800; color: #0a3d62; margin: 0; line-height: 1; }
    .notfound__title { font-size: 1.75rem; margin: 0.5rem 0 1rem; color: #1b1b1b; }
    .notfound__text { color: #555; margin-bottom: 2rem; }
    .notfound__actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .notfound__btn { padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; border: 1px solid #0a3d62; color: #0a3d62; font-weight: 600; }
    .notfound__btn--primary { background: #0a3d62; color: #fff; }
  `]
})
export class NotFoundComponent implements OnInit {
  // No SSR, define o status HTTP 404 real (no browser o token é null).
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  constructor(private seo: SeoService) {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
  }

  ngOnInit(): void {
    this.seo.setMeta({
      title: 'Página não encontrada',
      description: 'A página que você procura não existe ou foi movida.',
      noindex: true
    });
  }
}
