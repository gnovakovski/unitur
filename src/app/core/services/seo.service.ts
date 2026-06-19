import { Injectable, RendererFactory2, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface SeoMeta {
  /** Título da aba/SERP. O sufixo " - Unitur ..." é adicionado automaticamente. */
  title: string;
  description?: string;
  /** Imagem para Open Graph / Twitter (URL absoluta ou relativa ao siteUrl). */
  image?: string;
  /** Caminho canônico (ex.: "/blog/slug/"). Vira URL absoluta com o siteUrl. */
  canonicalPath?: string;
  type?: 'website' | 'article' | 'product';
  /** Marca a página como não-indexável (ex.: 404). */
  noindex?: boolean;
}

const SITE_NAME = 'Unitur Agência de Viagens e Turismo';
const TITLE_SUFFIX = ' - Unitur Agência de Viagens e Turismo';
const DEFAULT_IMAGE = '/logo.jpeg';

/**
 * Serviço central de SEO. Gerencia `<title>`, meta tags (description, Open
 * Graph, Twitter), `<link rel="canonical">` e blocos JSON-LD.
 *
 * Usa `Title`/`Meta` do Angular e manipula `<head>` via `DOCUMENT` +
 * `Renderer2` (nunca o `document` global). As meta tags são aplicadas no
 * cliente após o app carregar (o site roda como SPA, sem SSR).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  private readonly siteUrl = (environment.siteUrl || '').replace(/\/$/, '');

  /** Aplica todas as meta tags de uma página de uma vez. */
  setMeta(data: SeoMeta): void {
    const fullTitle = data.title.includes('Unitur') ? data.title : `${data.title}${TITLE_SUFFIX}`;
    const description = (data.description || '').trim();
    const url = this.absoluteUrl(data.canonicalPath);
    const image = this.absoluteUrl(data.image || DEFAULT_IMAGE);
    const type = data.type || 'website';

    this.title.setTitle(fullTitle);
    this.upsertName('description', description);
    this.upsertName('robots', data.noindex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    this.upsertProperty('og:title', fullTitle);
    this.upsertProperty('og:description', description);
    this.upsertProperty('og:type', type === 'product' ? 'product' : type);
    this.upsertProperty('og:url', url);
    this.upsertProperty('og:image', image);
    this.upsertProperty('og:locale', 'pt_BR');
    this.upsertProperty('og:site_name', SITE_NAME);

    // Twitter
    this.upsertName('twitter:card', 'summary_large_image');
    this.upsertName('twitter:title', fullTitle);
    this.upsertName('twitter:description', description);
    this.upsertName('twitter:image', image);

    this.setCanonical(url);
  }

  /**
   * Insere/atualiza um bloco JSON-LD identificado por `key` (remove o anterior
   * com a mesma key antes de inserir, evitando acúmulo ao navegar).
   */
  setJsonLd(key: string, schema: Record<string, unknown> | Record<string, unknown>[]): void {
    const id = `ld-${key}`;
    const existing = this.doc.getElementById(id);
    if (existing) {
      this.renderer.removeChild(existing.parentNode, existing);
    }

    const script = this.renderer.createElement('script');
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', id);
    this.renderer.setProperty(script, 'textContent', JSON.stringify(schema));
    this.renderer.appendChild(this.doc.head, script);
  }

  /** Schema global da agência (Organization/TravelAgency). */
  organizationSchema(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: SITE_NAME,
      url: this.siteUrl + '/',
      logo: this.absoluteUrl(DEFAULT_IMAGE),
      sameAs: ['https://www.facebook.com/agenciaunitur/', 'https://www.instagram.com/agenciaunitur/']
    };
  }

  /** Schema BreadcrumbList a partir de pares [nome, caminho]. */
  breadcrumbSchema(items: Array<{ name: string; path: string }>): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: this.absoluteUrl(item.path)
      }))
    };
  }

  /** Converte um caminho relativo em URL absoluta com o domínio do site. */
  absoluteUrl(pathOrUrl?: string): string {
    const value = (pathOrUrl || '').trim();
    if (!value) return this.siteUrl + '/';
    if (/^https?:\/\//i.test(value)) return value;
    return this.siteUrl + (value.startsWith('/') ? value : '/' + value);
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.renderer.createElement('link');
      this.renderer.setAttribute(link, 'rel', 'canonical');
      this.renderer.appendChild(this.doc.head, link);
    }
    this.renderer.setAttribute(link, 'href', url);
  }

  private upsertName(name: string, content: string): void {
    if (content) {
      this.meta.updateTag({ name, content });
    } else {
      this.meta.removeTag(`name='${name}'`);
    }
  }

  private upsertProperty(property: string, content: string): void {
    if (content) {
      this.meta.updateTag({ property, content });
    } else {
      this.meta.removeTag(`property='${property}'`);
    }
  }
}
