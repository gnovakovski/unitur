import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SiteContentService } from '../../../core/services/site-content.service';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
}

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

  menuItems: MenuItem[] = [
    { label: 'Viagens', route: '/admin/viagens', icon: 'trip' },
    { label: 'Posts',    route: '/admin/posts',    icon: 'post' },
    { label: 'Categorias', route: '/admin/categorias', icon: 'tag' },
    { label: 'Depoimentos', route: '/admin/depoimentos', icon: 'quote' },
    { label: 'Conteúdo do site', route: '/admin/conteudo', icon: 'content' }
  ];

  constructor(
    private authService: AuthService,
    private siteContentService: SiteContentService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
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
