import { Injectable, RendererFactory2, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface SeoMeta {
  /** Título da aba/SERP. O nome da agência é acrescentado automaticamente (ver `pageTitle`). */
  title: string;
  description?: string;
  /** Imagem para Open Graph / Twitter (URL absoluta ou relativa ao siteUrl). */
  image?: string;
  /**
   * Caminho canônico (ex.: "/blog/slug/"). Vira URL absoluta com o siteUrl.
   * Sem ele (página de erro), a página fica sem canonical.
   */
  canonicalPath?: string;
  type?: 'website' | 'article' | 'product';
  /** Marca a página como não-indexável (ex.: 404). */
  noindex?: boolean;
}

const SITE_NAME = 'Unitur Agência de Viagens e Turismo';
const TITLE_SUFFIX = ' - Unitur Agência de Viagens e Turismo';
/** Usado quando o título com o sufixo completo passaria do que o Google exibe. */
const SHORT_TITLE_SUFFIX = ' | Unitur';
/** O Google corta títulos por volta de 60–65 caracteres. */
const MAX_TITLE_LENGTH = 65;

/**
 * Título final da página: o título dela + o nome da agência.
 *
 * Com o sufixo completo, o nome de uma viagem ou de um post costuma passar do
 * limite e o Google corta justamente o fim — então, quando não cabe, entra o
 * sufixo curto. Títulos que já citam a Unitur ficam como estão.
 */
export function pageTitle(title: string): string {
  const clean = (title || '').replace(/\s+/g, ' ').trim();
  if (/unitur/i.test(clean)) return clean;
  const full = clean + TITLE_SUFFIX;
  return full.length <= MAX_TITLE_LENGTH ? full : clean + SHORT_TITLE_SUFFIX;
}
const DEFAULT_IMAGE = '/logo.jpeg';

/**
 * Serviço central de SEO. Gerencia `<title>`, meta tags (description, Open
 * Graph, Twitter), `<link rel="canonical">` e blocos JSON-LD.
 *
 * Usa `Title`/`Meta` do Angular e manipula `<head>` via `DOCUMENT` +
 * `Renderer2` (nunca o `document` global), então funciona igual no servidor
 * e no navegador. Como as páginas públicas são renderizadas no servidor (SSR),
 * estas tags já saem no HTML que o Google recebe; no navegador o mesmo código
 * atualiza as tags a cada navegação.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  private readonly siteUrl = (environment.siteUrl || '').replace(/\/$/, '');

  /**
   * Aplica todas as meta tags de uma página de uma vez. Chame antes de
   * `setJsonLd`: começa removendo os blocos JSON-LD da página anterior, para os
   * dados de uma viagem ou post não ficarem no `<head>` de outra página.
   */
  setMeta(data: SeoMeta): void {
    this.clearJsonLd();

    const fullTitle = pageTitle(data.title);
    const description = (data.description || '').trim();
    // Página de erro (sem caminho canônico) não aponta para lugar nenhum: antes
    // caía na home, e um 404 "canônico para a home" confunde o buscador.
    const url = data.canonicalPath && !data.noindex ? this.absoluteUrl(data.canonicalPath) : '';
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

  /** Remove todos os blocos JSON-LD inseridos por `setJsonLd`. */
  private clearJsonLd(): void {
    this.doc.querySelectorAll('script[type="application/ld+json"][id^="ld-"]').forEach(script => {
      this.renderer.removeChild(script.parentNode, script);
    });
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
    if (!url) {
      if (link) this.renderer.removeChild(link.parentNode, link);
      return;
    }
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
