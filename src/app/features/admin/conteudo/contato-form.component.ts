import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { DEFAULT_CONTACT_CONTENT } from '../../../core/models/site-content.model';
import { SiteContentService } from '../../../core/services/site-content.service';

@Component({
  selector: 'app-contato-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contato-form.component.html',
  styleUrl: './contato-form.component.scss'
})
export class ContatoFormComponent implements OnInit {
  form: FormGroup;
  loading = true;
  saving = false;
  saved = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.form = this.fb.group({
      phone: [''],
      whatsapp: [''],
      email: [''],
      instagram: [''],
      facebook: [''],
      linkedin: [''],
      address: [''],
      cep: [''],
      city: ['']
    });
  }

  ngOnInit() {
    this.siteContentService.loadContact().pipe(timeout(12000)).subscribe({
      next: contact => {
        this.ngZone.run(() => {
          this.form.patchValue({ ...DEFAULT_CONTACT_CONTENT, ...contact });
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          this.error = err?.message || 'Não foi possível carregar os dados.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  async save() {
    if (this.saving) return;
    this.saving = true;
    this.error = '';
    this.saved = false;
    this.cdr.detectChanges();
    try {
      await firstValueFrom(this.siteContentService.saveContact(this.form.getRawValue()));
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
