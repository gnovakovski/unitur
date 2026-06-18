import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import {
  DEFAULT_ABOUT_CONTENT,
  HomeAboutContent,
  AboutPageContent,
  SiteAboutContent
} from '../../../core/models/about-content.model';
import { AboutContentService } from '../../../core/services/about-content.service';
import { UploadService } from '../../../core/services/upload.service';
import { ToastService } from '../../../core/services/toast.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-sobre-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUploadComponent],
  templateUrl: './sobre-form.component.html',
  styleUrl: './sobre-form.component.scss'
})
export class SobreFormComponent implements OnInit {
  home: HomeAboutContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.home));
  about: AboutPageContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.about));

  homeImageValue: string | File | null = '';
  aboutImageValue: string | File | null = '';

  loading = false;
  saving = false;
  savingStep = '';
  feedback = '';
  error = '';

  constructor(
    private aboutContentService: AboutContentService,
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loading = true;
    this.cdr.detectChanges();

    this.aboutContentService.load().pipe(timeout(12000)).subscribe({
      next: content => {
        this.ngZone.run(() => {
          this.home = JSON.parse(JSON.stringify(content.home));
          this.about = JSON.parse(JSON.stringify(content.about));
          this.homeImageValue = this.home.imageUrl || '';
          this.aboutImageValue = this.about.storyImageUrl || '';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          this.aboutContentService.content$.subscribe(cached => {
            this.home = JSON.parse(JSON.stringify(cached.home));
            this.about = JSON.parse(JSON.stringify(cached.about));
            this.homeImageValue = this.home.imageUrl || '';
            this.aboutImageValue = this.about.storyImageUrl || '';
          }).unsubscribe();
          this.error = err?.message || 'Erro ao carregar o conteúdo. Usando dados em cache.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onHomeImageChange(value: string | File | null) {
    this.homeImageValue = value;
  }

  onAboutImageChange(value: string | File | null) {
    this.aboutImageValue = value;
  }

  addParagraph(target: 'home' | 'about') {
    if (target === 'home') {
      this.home.paragraphs = [...this.home.paragraphs, ''];
    } else {
      this.about.storyParagraphs = [...this.about.storyParagraphs, ''];
    }
  }

  removeParagraph(target: 'home' | 'about', index: number) {
    if (target === 'home') {
      this.home.paragraphs = this.home.paragraphs.filter((_, i) => i !== index);
    } else {
      this.about.storyParagraphs = this.about.storyParagraphs.filter((_, i) => i !== index);
    }
  }

  updateParagraph(target: 'home' | 'about', index: number, value: string) {
    if (target === 'home') {
      const next = [...this.home.paragraphs];
      next[index] = value;
      this.home.paragraphs = next;
    } else {
      const next = [...this.about.storyParagraphs];
      next[index] = value;
      this.about.storyParagraphs = next;
    }
  }

  addStat(target: 'home' | 'about' = 'home') {
    if (target === 'home') {
      this.home.stats = [...this.home.stats, { number: '', label: '' }];
    } else {
      this.about.stats = [...this.about.stats, { number: '', label: '' }];
    }
  }

  removeStat(index: number, target: 'home' | 'about' = 'home') {
    if (target === 'home') {
      this.home.stats = this.home.stats.filter((_, i) => i !== index);
    } else {
      this.about.stats = this.about.stats.filter((_, i) => i !== index);
    }
  }

  updateStat(index: number, field: 'number' | 'label', value: string, target: 'home' | 'about' = 'home') {
    if (target === 'home') {
      const next = [...this.home.stats];
      if (!next[index]) return;
      next[index] = { ...next[index], [field]: value };
      this.home.stats = next;
    } else {
      const next = [...this.about.stats];
      if (!next[index]) return;
      next[index] = { ...next[index], [field]: value };
      this.about.stats = next;
    }
  }

  addMissionCard() {
    this.about.missionCards = [...this.about.missionCards, { icon: '', title: '', description: '' }];
  }

  removeMissionCard(index: number) {
    this.about.missionCards = this.about.missionCards.filter((_, i) => i !== index);
  }

  updateMissionCard(index: number, field: 'icon' | 'title' | 'description', value: string) {
    const next = [...this.about.missionCards];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: value };
    this.about.missionCards = next;
  }

  addTimelineItem() {
    this.about.timeline = [...this.about.timeline, { year: '', event: '', description: '' }];
  }

  removeTimelineItem(index: number) {
    this.about.timeline = this.about.timeline.filter((_, i) => i !== index);
  }

  updateTimelineItem(index: number, field: 'year' | 'event' | 'description', value: string) {
    const next = [...this.about.timeline];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: value };
    this.about.timeline = next;
  }

  addValue() {
    this.about.values = [...this.about.values, { icon: '', title: '', description: '' }];
  }

  removeValue(index: number) {
    this.about.values = this.about.values.filter((_, i) => i !== index);
  }

  updateValue(index: number, field: 'icon' | 'title' | 'description', value: string) {
    const next = [...this.about.values];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: value };
    this.about.values = next;
  }

  async save() {
    if (this.saving) return;
    this.saving = true;
    this.feedback = '';
    this.error = '';
    this.savingStep = '';
    this.cdr.detectChanges();
    try {
      let homeImageUrl = this.home.imageUrl;
      let aboutImageUrl = this.about.storyImageUrl;

      if (this.homeImageValue instanceof File) {
        this.ngZone.run(() => { this.savingStep = 'Enviando imagem da home...'; this.cdr.detectChanges(); });
        const uploaded = await firstValueFrom(
          this.uploadService.uploadToEntity(this.homeImageValue, 'uploads', 'about-home').pipe(timeout(60000))
        );
        homeImageUrl = uploaded.url;
      } else if (typeof this.homeImageValue === 'string') {
        homeImageUrl = this.homeImageValue;
      } else if (this.homeImageValue === null) {
        homeImageUrl = '';
      }

      if (this.aboutImageValue instanceof File) {
        this.ngZone.run(() => { this.savingStep = 'Enviando imagem da história...'; this.cdr.detectChanges(); });
        const uploaded = await firstValueFrom(
          this.uploadService.uploadToEntity(this.aboutImageValue, 'uploads', 'about-story').pipe(timeout(60000))
        );
        aboutImageUrl = uploaded.url;
      } else if (typeof this.aboutImageValue === 'string') {
        aboutImageUrl = this.aboutImageValue;
      } else if (this.aboutImageValue === null) {
        aboutImageUrl = '';
      }

      this.ngZone.run(() => { this.savingStep = 'Salvando conteúdo...'; this.cdr.detectChanges(); });

      const payload: SiteAboutContent = {
        home: {
          ...this.home,
          imageUrl: homeImageUrl,
          paragraphs: this.home.paragraphs.map(p => (p || '').trim()).filter(Boolean),
          stats: this.home.stats.filter(stat => (stat.number || '').trim() || (stat.label || '').trim())
        },
        about: {
          ...this.about,
          storyImageUrl: aboutImageUrl,
          missionCards: this.about.missionCards.filter(card => (card.title || '').trim() || (card.description || '').trim()),
          stats: this.about.stats.filter(stat => (stat.number || '').trim() || (stat.label || '').trim()),
          storyParagraphs: this.about.storyParagraphs.map(p => (p || '').trim()).filter(Boolean),
          timeline: this.about.timeline.filter(item => (item.year || '').trim() || (item.event || '').trim()),
          values: this.about.values.filter(value => (value.title || '').trim() || (value.description || '').trim())
        }
      };
      await firstValueFrom(this.aboutContentService.save(payload));
      this.home.imageUrl = homeImageUrl;
      this.about.storyImageUrl = aboutImageUrl;
      this.homeImageValue = homeImageUrl;
      this.aboutImageValue = aboutImageUrl;
      this.ngZone.run(() => {
        this.feedback = 'Conteúdo institucional salvo com sucesso. As alterações já estão no site.';
        this.saving = false;
        this.savingStep = '';
        this.toast.success('Conteúdo institucional salvo com sucesso.');
        this.cdr.detectChanges();
        setTimeout(() => {
          this.feedback = '';
          this.cdr.detectChanges();
        }, 2500);
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.error = err?.message || 'Erro ao salvar conteúdo.';
        this.saving = false;
        this.savingStep = '';
        this.toast.error(this.error);
        this.cdr.detectChanges();
      });
    }
  }

  trackByIndex(index: number) {
    return index;
  }
}
