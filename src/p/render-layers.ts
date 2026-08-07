import { pdfjs, type PDFDocumentProxy, type PDFPageProxy, type PageViewport } from "./pdfjs";
import type { Config } from "./config";

export interface RenderContext {
  config: Config;
  scale: number;
  doc: PDFDocumentProxy;
  goToPage: (pageNumber: number) => void;
}

// Detecta URLs no texto (com ou sem esquema). Exige "/" após o domínio nos
// casos sem http(s):// para reduzir falsos positivos.
const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>()"']+|(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,}\/[^\s<>()"']+/gi;

function externalLink(href: string, title?: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer nofollow";
  link.title = title ?? href;
  return link;
}

// ---------------------------------------------------------------------------
// Camada de texto (seleção / busca).
// ---------------------------------------------------------------------------

export async function renderTextLayer(
  page: PDFPageProxy,
  viewport: PageViewport,
  wrapper: HTMLElement,
  ctx: RenderContext,
): Promise<HTMLElement | null> {
  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "textLayer";
  if (!ctx.config.select) textLayerDiv.classList.add("no-select");
  textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
  textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
  wrapper.style.setProperty("--scale-factor", String(ctx.scale));
  wrapper.style.setProperty("--total-scale-factor", String(ctx.scale));
  wrapper.appendChild(textLayerDiv);

  try {
    const textLayer = new pdfjs.TextLayer({
      textContentSource: await page.getTextContent(),
      container: textLayerDiv,
      viewport,
    });
    await textLayer.render();
  } catch (error) {
    console.warn("Falha ao renderizar a camada de texto:", error);
  }
  return textLayerDiv;
}

// ---------------------------------------------------------------------------
// Links.
// ---------------------------------------------------------------------------

async function goToDestination(dest: unknown, ctx: RenderContext): Promise<void> {
  try {
    let explicit = dest;
    if (typeof explicit === "string") explicit = await ctx.doc.getDestination(explicit);
    if (!Array.isArray(explicit) || !explicit.length) return;
    const pageIndex = await ctx.doc.getPageIndex(explicit[0]);
    ctx.goToPage(pageIndex + 1);
  } catch (error) {
    console.warn("Falha ao navegar para o destino do link:", error);
  }
}

// Camada única de links (posicionada sobre a página). Reúne tanto as
// anotações reais quanto as URLs detectadas no texto.
function ensureAnnotationLayer(viewport: PageViewport, wrapper: HTMLElement): HTMLElement {
  let layer = wrapper.querySelector<HTMLElement>(".annotationLayer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "annotationLayer";
    layer.style.width = `${Math.floor(viewport.width)}px`;
    layer.style.height = `${Math.floor(viewport.height)}px`;
    wrapper.appendChild(layer);
  }
  return layer;
}

// (1) Links que são anotações reais do PDF (subtype "Link").
export async function renderAnnotationLinks(
  page: PDFPageProxy,
  viewport: PageViewport,
  wrapper: HTMLElement,
  ctx: RenderContext,
): Promise<void> {
  let annotations;
  try {
    annotations = await page.getAnnotations();
  } catch (error) {
    console.warn("Falha ao obter anotações:", error);
    return;
  }

  const layer = ensureAnnotationLayer(viewport, wrapper);
  for (const annotation of annotations) {
    if (annotation.subtype !== "Link") continue;
    if (!annotation.url && !annotation.dest) continue;

    // `convertToViewportRectangle` não existe nesta build do pdf.js; converte-se
    // os dois cantos com `convertToViewportPoint` e normaliza para o box.
    const [x1, y1] = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]);
    const [x2, y2] = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3]);

    const link = annotation.url ? externalLink(annotation.url) : document.createElement("a");
    if (!annotation.url) {
      link.href = "#";
      const dest = annotation.dest;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void goToDestination(dest, ctx);
      });
    }
    link.style.left = `${Math.min(x1, x2)}px`;
    link.style.top = `${Math.min(y1, y2)}px`;
    link.style.width = `${Math.abs(x2 - x1)}px`;
    link.style.height = `${Math.abs(y2 - y1)}px`;
    layer.appendChild(link);
  }
}

// (2) URLs que aparecem apenas como TEXTO no PDF (sem anotação). Envolve o
// trecho da URL numa âncora INLINE dentro do próprio span da camada de texto,
// herdando posição/transform/escala do span — alinhamento perfeito em qualquer
// zoom, sem medir coordenadas.
export function linkifyTextLayer(textLayerDiv: HTMLElement | null): void {
  if (!textLayerDiv) return;

  textLayerDiv.querySelectorAll("span").forEach((span) => {
    // Apenas spans "simples" (um único nó de texto).
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || span.childNodes.length !== 1) return;

    const text = node.nodeValue ?? "";
    URL_PATTERN.lastIndex = 0;
    if (!URL_PATTERN.test(text)) return;

    URL_PATTERN.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let from = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_PATTERN.exec(text)) !== null) {
      // Remove pontuação final que raramente faz parte da URL.
      const raw = match[0].replace(/[.,;:!?)\]}'"]+$/, "");
      if (!raw) continue;
      const start = match.index;
      const end = start + raw.length;

      if (start > from) fragment.appendChild(document.createTextNode(text.slice(from, start)));

      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const link = externalLink(href, raw);
      link.className = "pdf-link";
      link.textContent = text.slice(start, end);
      fragment.appendChild(link);

      from = end;
      URL_PATTERN.lastIndex = end; // reposiciona após a pontuação eventualmente removida
      // console.info(`Link detectado no texto: ${href}`);
    }
    if (from < text.length) fragment.appendChild(document.createTextNode(text.slice(from)));

    span.replaceChildren(fragment);
  });
}

// ---------------------------------------------------------------------------
// Marca d'água.
// ---------------------------------------------------------------------------

export function addWatermark(wrapper: HTMLElement, config: Config): void {
  if (!config.watermark) return;
  const overlay = document.createElement("div");
  overlay.className = "watermark";
  const label = document.createElement("span");
  label.textContent = config.watermark;
  overlay.appendChild(label);
  wrapper.appendChild(overlay);
}
