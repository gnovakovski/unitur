import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { SiteContentService } from '../../../core/services/site-content.service';
import { normalizeWhatsAppNumber } from '../../../core/models/site-content.model';
import { buildWhatsappLink } from '../../../core/utils/whatsapp-message';

/**
 * Botão flutuante de WhatsApp exibido no canto inferior direito de todas as
 * páginas públicas. Usa o mesmo número de contato do site (o do botão
 * "Reservar agora" dentro das viagens), resolvido via `SiteContentService`.
 */
@Component({
  selector: 'app-whatsapp-float',
  standalone: true,
  templateUrl: './whatsapp-float.component.html',
  styleUrl: './whatsapp-float.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhatsappFloatComponent implements OnInit {
  private readonly siteContentService = inject(SiteContentService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Mensagem genérica (sem viagem específica) já preenchida no WhatsApp. */
  private readonly message = 'Olá! Gostaria de mais informações sobre as viagens da Unitur.';

  private whatsappNumber = '';

  get whatsappLink(): string {
    return buildWhatsappLink(this.whatsappNumber, this.message);
  }

  ngOnInit() {
    this.siteContentService.contact$.subscribe(contact => {
      this.whatsappNumber = normalizeWhatsAppNumber(contact?.whatsapp);
      this.cdr.markForCheck();
    });
    this.siteContentService.loadContact().subscribe();
  }
}
