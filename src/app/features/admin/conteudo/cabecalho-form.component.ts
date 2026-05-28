import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { HeaderLink, SiteHeaderContent } from '../../../core/models/site-content.model';
import { SiteContentService } from '../../../core/services/site-content.service';

@Component({
  selector: 'app-cabecalho-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule],
  templateUrl: './cabecalho-form.component.html',
  styleUrl: './cabecalho-form.component.scss'
})
export class CabecalhoFormComponent implements OnInit {
  links: HeaderLink[] = [];
  loading = true;
  saving = false;
  saved = false;
  error = '';

  constructor(
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit() {
    this.siteContentService.loadHeader().pipe(timeout(12000)).subscribe({
      next: content => {
        this.ngZone.run(() => {
          this.links = content.links.map(link => ({ ...link }));
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          // fallback: usa o snapshot do subject (cache local)
          const fallback = this.siteContentService.getCurrentHeaderLinks();
          if (fallback.length && !this.links.length) {
            this.links = fallback.map(link => ({ ...link }));
          }
          this.error = err?.message || 'Não foi possível carregar o cabeçalho.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onDrop(event: CdkDragDrop<HeaderLink[]>) {
    moveItemInArray(this.links, event.previousIndex, event.currentIndex);
    this.links = this.links.map((link, index) => ({ ...link, order: index }));
  }

  toggleVisible(link: HeaderLink) {
    link.visible = !link.visible;
  }

  /** Atualiza o label e, simultaneamente, recalcula a rota a partir do novo nome. */
  onLabelChange(link: HeaderLink, value: string) {
    link.label = value;
    link.route = this.buildRoute(value, link.route);
  }

  /** Permite ao usuário sobrescrever a rota manualmente. */
  onRouteChange(link: HeaderLink, value: string) {
    link.route = this.sanitizeRoute(value);
  }

  /** Gera rota canonical mantendo o prefixo existente quando possível. */
  private buildRoute(label: string, currentRoute: string): string {
    const slug = this.slugify(label);
    if (!slug) return currentRoute;

    const trimmed = (currentRoute || '').replace(/^\/+/, '').replace(/\/+$/, '');
    const parts = trimmed ? trimmed.split('/') : [];

    if (parts.length > 1) {
      // Substitui apenas o último segmento, preservando o prefixo (ex: /viagens/...)
      parts[parts.length - 1] = slug;
      return '/' + parts.join('/');
    }

    return '/' + slug;
  }

  private sanitizeRoute(value: string): string {
    return this.siteContentService.sanitizeRoute(value || '');
  }

  private slugify(value: string): string {
    return this.siteContentService.sanitizeRoute(value).replace(/^\//, '');
  }

  async save() {
    if (this.saving) return;
    this.saving = true;
    this.error = '';
    this.saved = false;
    this.cdr.detectChanges();
    try {
      const content: SiteHeaderContent = {
        links: this.links.map((link, index) => ({ ...link, order: index }))
      };
      await firstValueFrom(this.siteContentService.saveHeader(content));
      this.ngZone.run(() => {
        this.saved = true;
        this.saving = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.saved = false;
          this.cdr.detectChanges();
        }, 2500);
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.error = err?.message || 'Falha ao salvar.';
        this.saving = false;
        this.cdr.detectChanges();
      });
    }
  }

  back() {
    this.router.navigate(['/admin/conteudo']);
  }
}
