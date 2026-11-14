import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NewsletterService } from '../../../core/services/newsletter.service';

@Component({
  selector: 'app-newsletter-signup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './newsletter-signup.component.html',
  styleUrl: './newsletter-signup.component.scss'
})
export class NewsletterSignupComponent {
  name = '';
  email = '';
  consent = false;
  saving = false;
  success = false;
  error = '';
  private readonly newsletter = inject(NewsletterService);
  private readonly cdr = inject(ChangeDetectorRef);

  async subscribe(form: NgForm): Promise<void> {
    if (this.saving) return;
    if (form.invalid || !this.name.trim() || !this.consent) {
      form.control.markAllAsTouched();
      this.error = 'Preencha seu nome, um e-mail válido e autorize o recebimento.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.success = false;
    try {
      await this.newsletter.subscribe(this.name, this.email);
      this.success = true;
      form.resetForm({ name: '', email: '', consent: false });
    } catch {
      this.error = 'Não foi possível cadastrar agora. Confira seus dados e tente novamente.';
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
