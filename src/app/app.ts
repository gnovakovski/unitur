import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'angular-app';
  isAdminRoute = false;

  constructor(private router: Router) {
    this.updateRouteVisibility(this.router.url);

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateRouteVisibility(event.urlAfterRedirects);
      }
    });
  }

  private updateRouteVisibility(url: string) {
    this.isAdminRoute = url.startsWith('/admin') || url.startsWith('/administrador');
  }
}
