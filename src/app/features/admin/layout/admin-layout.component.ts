import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { SiteContentService } from '../../../core/services/site-content.service';
import { AdminModule, MENU_MODULES } from '../../../core/models/modules.config';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnInit {
  sidebarOpen = true;
  currentUser: any;

  /** Itens do menu visíveis para o usuário logado (filtrados por permissão). */
  menuItems: AdminModule[] = [];

  constructor(
    private authService: AuthService,
    private permissionService: PermissionService,
    private siteContentService: SiteContentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      // Recalcula o menu sempre que a sessão muda (login, troca de permissões).
      this.menuItems = MENU_MODULES.filter(m => this.permissionService.can(m.key));
      this.cdr.markForCheck();
    });
    this.siteContentService.migrateDefaultsIfMissing();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout() {
    if (confirm('Tem certeza que deseja sair?')) {
      this.authService.logout();
    }
  }

  goToSite() {
    window.open('/', '_blank');
  }

  get userInitial(): string {
    const name = this.currentUser?.name || this.currentUser?.email || '';
    return name.charAt(0).toUpperCase() || 'U';
  }
}
