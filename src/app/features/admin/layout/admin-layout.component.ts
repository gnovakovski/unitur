import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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

  menuItems = [
    { 
      label: 'Posts', 
      route: '/admin/posts' 
    },
    { 
      label: 'Viagens', 
      route: '/admin/viagens' 
    },
    { 
      label: 'Categorias', 
      route: '/admin/categorias' 
    },
    { 
      label: 'Banners', 
      route: '/admin/banners' 
    },
    { 
      label: 'Depoimentos', 
      route: '/admin/depoimentos' 
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
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
}
