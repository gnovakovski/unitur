import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';
import { WhatsappFloatComponent } from './shared/components/whatsapp-float/whatsapp-float.component';
import { FirebaseService } from './core/services/firebase.service';
import { inject as injectVercelAnalytics } from '@vercel/analytics';

/** Link de conversa com um número (wa.me/5551...), não o compartilhamento do blog (wa.me/?text=). */
const WHATSAPP_CONTACT_LINK = /^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?\d/i;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastHostComponent, WhatsappFloatComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'angular-app';
  isAdminRoute = false;
  private readonly document = inject(DOCUMENT);

  constructor(private router: Router, private firebase: FirebaseService) {
    injectVercelAnalytics();
    this.updateRouteVisibility(this.router.url);
    this.trackWhatsappClicks();

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

  /**
   * O container do GTM (GTM-T9B5J39) foi montado para o WordPress antigo: o
   * evento `whatsapp_click` do GA4, a conversão do Google Ads e o "Lead" do Meta
   * Pixel disparam no evento `JoinChat`, que vinha do plugin Join.chat. O site
   * novo não tem o plugin, então essas conversões pararam de ser registradas.
   * Aqui, todo clique em link de conversa do WhatsApp publica o mesmo evento no
   * dataLayer — sem precisar mexer no GTM.
   */
  private trackWhatsappClicks() {
    const win = this.document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    if (!win) return;

    this.document.addEventListener('click', event => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || !WHATSAPP_CONTACT_LINK.test(anchor.href)) return;
      if (this.isAdminRoute) return;

      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push({ event: 'JoinChat' });
    }, true);
  }
}
