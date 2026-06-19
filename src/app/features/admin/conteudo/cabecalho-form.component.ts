import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { HeaderLink, SiteHeaderContent } from '../../../core/models/site-content.model';
import { SiteContentService } from '../../../core/services/site-content.service';
import { ToastService } from '../../../core/services/toast.service';

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
    private router: Router,
    private toast: ToastService
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

  /** Adiciona um novo menu vazio ao final da lista. */
  addLink() {
    const id = this.siteContentService.generateMenuId('menu', this.links.map(l => l.id));
    this.links = [
      ...this.links,
      {
        id,
        label: 'Novo menu',
        route: this.siteContentService.ensureMenuRoute('/viagens/novo-menu'),
        order: this.links.length,
        visible: true
      }
    ];
  }

  /** Remove um menu. As viagens que apontavam para ele simplesmente deixam de listá-lo. */
  removeLink(link: HeaderLink) {
    if (!confirm(`Excluir o menu "${link.label}"? As viagens vinculadas a ele deixarão de aparecer neste menu.`)) {
      return;
    }
    this.links = this.links
      .filter(l => l.id !== link.id)
      .map((l, index) => ({ ...l, order: index }));
  }

  /** Atualiza o label e, simultaneamente, recalcula a rota a partir do novo nome. */
  onLabelChange(link: HeaderLink, value: string) {
    link.label = value;
    link.route = this.siteContentService.ensureMenuRoute(value);
  }

  /** Permite ao usuário sobrescrever a rota manualmente — sempre sob /viagens/. */
  onRouteChange(link: HeaderLink, value: string) {
    link.route = this.siteContentService.ensureMenuRoute(value);
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
        this.toast.success('Cabeçalho salvo com sucesso.');
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
        this.toast.error(this.error);
        this.cdr.detectChanges();
      });
    }
  }

  back() {
    this.router.navigate(['/admin/conteudo']);
  }
}
