import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';
import { WhatsappFloatComponent } from './shared/components/whatsapp-float/whatsapp-float.component';
import { FirebaseService } from './core/services/firebase.service';
import { inject as injectVercelAnalytics } from '@vercel/analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastHostComponent, WhatsappFloatComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'angular-app';
  isAdminRoute = false;

  constructor(private router: Router, private firebase: FirebaseService) {
    injectVercelAnalytics();
    this.updateRouteVisibility(this.router.url);

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateRouteVisibility(event.urlAfterRedirects);
        this.firebase.logPageView(event.urlAfterRedirects);
      }
    });
  }

  private updateRouteVisibility(url: string) {
    this.isAdminRoute = url.startsWith('/admin') || url.startsWith('/administrador');
  }
}
