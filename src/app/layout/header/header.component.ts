import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderLink } from '../../core/models/site-content.model';
import { SiteContentService } from '../../core/services/site-content.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  menuOpen = false;
  links: HeaderLink[] = [];

  constructor(
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.siteContentService.header$.subscribe(content => {
      this.links = content.links.filter(link => link.visible);
      this.cdr.markForCheck();
    });
    this.siteContentService.loadHeader().subscribe();
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
}
