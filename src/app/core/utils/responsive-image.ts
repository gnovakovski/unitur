/**
 * Utilitários para imagens salvas em várias larguras (atributo `srcset`), como
 * os banners da home. Ver UploadService.uploadResponsiveImage.
 */

interface SrcsetCandidate {
  url: string;
  width: number;
}

function parseSrcset(srcset: string | null | undefined): SrcsetCandidate[] {
  return String(srcset || '')
    .split(/,\s+/)
    .map(part => part.trim().split(/\s+/))
    .filter(([url, descriptor]) => !!url && /^\d+w$/.test(descriptor || ''))
    .map(([url, descriptor]) => ({ url, width: parseInt(descriptor, 10) }));
}

/**
 * Devolve o srcset só se ele for da imagem atual (contém `currentUrl`). Se a
 * arte foi trocada por um fluxo que não atualizou as versões, a lista antiga é
 * ignorada e o site usa só a `currentUrl`, nunca uma arte antiga.
 */
export function srcsetForImage(srcset: string | null | undefined, currentUrl: string | null | undefined): string {
  const url = String(currentUrl || '').trim();
  if (!url) return '';
  const candidates = parseSrcset(srcset);
  return candidates.some(candidate => candidate.url === url) ? candidates.map(c => `${c.url} ${c.width}w`).join(', ') : '';
}

/** URL da menor versão do srcset (ou '' se não houver). */
export function smallestSrcsetUrl(srcset: string | null | undefined): string {
  const candidates = parseSrcset(srcset);
  if (candidates.length === 0) return '';
  return candidates.reduce((smallest, candidate) => (candidate.width < smallest.width ? candidate : smallest)).url;
}
