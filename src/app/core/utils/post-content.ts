import { SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const EMBED_TOKEN_PATTERN = /(?:<p>\s*)?\[\[unitur-embed-(\d+)\]\](?:\s*<\/p>)?/g;

/**
 * Prepara o HTML do post para exibição no site.
 *
 * O sanitizer do Angular remove todo <iframe>, o que apagava os vídeos do YouTube
 * dos posts. Aqui os vídeos de hosts confiáveis são separados antes da sanitização
 * (e remontados por nós, só com a URL validada) e o restante segue o fluxo normal.
 */
export function renderPostHtml(content: string, sanitizer: DomSanitizer): SafeHtml {
  const { html, embeds } = extractVideoEmbeds(normalizePostHtml(content));
  const sanitized = sanitizer.sanitize(SecurityContext.HTML, html) || '';
  const withEmbeds = sanitized.replace(EMBED_TOKEN_PATTERN, (_match, index: string) => embeds[Number(index)] || '');
  return sanitizer.bypassSecurityTrustHtml(withEmbeds);
}

/** Mantém quebras de parágrafo de conteúdos antigos salvos como texto puro. */
export function normalizePostHtml(content: string): string {
  const value = String(content || '').trim();
  if (!value) return '';
  if (/<[a-z][\s\S]*>/i.test(value)) return value;

  return value
    .split(/\r?\n\r?\n/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

/** Troca iframes de vídeo permitidos por marcadores e descarta os demais. */
export function extractVideoEmbeds(html: string): { html: string; embeds: string[] } {
  const embeds: string[] = [];
  const output = html.replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi, (_match, attributes: string) => {
    const src = decodeEntities(/\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] || '');
    const title = decodeEntities(/\btitle\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1] || '');
    const embedUrl = safeVideoEmbedUrl(src);
    if (!embedUrl) return '';

    embeds.push(
      `<div class="video-embed"><iframe src="${embedUrl}" title="${escapeHtml(title || 'Vídeo')}" loading="lazy" ` +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
      'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'
    );
    return `<p>[[unitur-embed-${embeds.length - 1}]]</p>`;
  });

  return { html: output, embeds };
}

/** URL de embed normalizada para YouTube/Vimeo, ou null para qualquer outro endereço. */
export function safeVideoEmbedUrl(src: string): string | null {
  let url: URL;
  try {
    url = new URL(src.trim(), 'https://www.unitur.com.br');
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = /^\/embed\/([\w-]{6,20})\/?$/.exec(url.pathname)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === 'player.vimeo.com') {
    const id = /^\/video\/(\d{4,12})\/?$/.exec(url.pathname)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
