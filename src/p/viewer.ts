import { pdfjs, PDFJS_WORKER, type PDFDocumentProxy } from "./pdfjs";
import type { Config } from "./config";
import {
  renderTextLayer,
  renderAnnotationLinks,
  linkifyTextLayer,
  addWatermark,
  type RenderContext,
} from "./render-layers";

pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

const DEFAULT_SCALE = 1.25;

export interface ViewerState {
  page: number;
  total: number;
  ready: boolean;
  canPrev: boolean;
  canNext: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export interface ViewerHooks {
  onState: (state: ViewerState) => void;
  onStatus?: (title: string | null) => void;
  afterRender?: () => void;
}

export class PdfViewer {
  private doc: PDFDocumentProxy | null = null;
  private scale: number;
  private current = 1;
  private generation = 0;
  private wrappers: HTMLElement[] = [];
  readonly usesNumericZoom: boolean;
  private readonly needsTextLayer: boolean;

  constructor(
    private readonly container: HTMLElement,
    private readonly pagesElement: HTMLElement,
    private readonly config: Config,
    private readonly hooks: ViewerHooks,
  ) {
    this.usesNumericZoom = typeof config.zoom === "number" && Number.isFinite(config.zoom);
    this.needsTextLayer = config.select || config.search || config.links;
    this.scale = this.usesNumericZoom ? this.clampScale(config.zoom as number) : DEFAULT_SCALE;
    container.addEventListener("scroll", () => this.trackCurrentPage(), { passive: true });
  }

  get document(): PDFDocumentProxy | null {
    return this.doc;
  }

  get currentPage(): number {
    return this.current;
  }

  private clampScale(value: number): number {
    return Math.min(Math.max(value, this.config.minzoom), this.config.maxzoom);
  }

  syncState(): void {
    this.emit();
  }

  async load(url: string): Promise<void> {
    const task = pdfjs.getDocument({
      url,
      password: this.config.password || undefined,
      withCredentials: this.config.credentials,
      disableAutoFetch: !this.config.autofetch,
      disableStream: !this.config.stream,
    });
    this.doc = await task.promise;
    this.current = Math.min(this.config.page, this.doc.numPages);
    this.emit();
  }

  private renderContext(): RenderContext {
    return {
      config: this.config,
      scale: this.scale,
      doc: this.doc as PDFDocumentProxy,
      goToPage: (pageNumber) => this.goToPage(pageNumber),
    };
  }

  async renderAll(): Promise<void> {
    if (!this.doc) return;
    const generation = ++this.generation;
    this.pagesElement.replaceChildren();
    this.wrappers = [];
    this.hooks.onStatus?.("Renderizando PDF…");

    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = this.renderContext();

    for (let pageNumber = 1; pageNumber <= this.doc.numPages; pageNumber++) {
      if (generation !== this.generation) return;

      const page = await this.doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.scale, rotation: this.config.rotate });
      const wrapper = document.createElement("div");
      wrapper.className = "page-wrap";
      wrapper.dataset.page = String(pageNumber);

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      wrapper.appendChild(canvas);
      this.pagesElement.appendChild(wrapper);
      this.wrappers.push(wrapper);

      if (context) {
        await page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        }).promise;
      }

      if (generation !== this.generation) return;
      const textLayerDiv = this.needsTextLayer
        ? await renderTextLayer(page, viewport, wrapper, ctx)
        : null;
      if (this.config.links) {
        await renderAnnotationLinks(page, viewport, wrapper, ctx);
        linkifyTextLayer(textLayerDiv);
      }
      addWatermark(wrapper, this.config);
    }

    this.hooks.onStatus?.(null);
    this.trackCurrentPage();
    this.hooks.afterRender?.();
  }

  goToPage(pageNumber: number): void {
    const target = this.wrappers[pageNumber - 1];
    if (!target) return;
    this.current = pageNumber;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    this.emit();
  }

  next(): void {
    this.goToPage(Math.min(this.wrappers.length, this.current + 1));
  }

  previous(): void {
    this.goToPage(Math.max(1, this.current - 1));
  }

  private trackCurrentPage(): void {
    if (!this.wrappers.length) return;
    const containerTop = this.container.getBoundingClientRect().top;
    let bestPage = 1;
    let bestDistance = Number.POSITIVE_INFINITY;

    this.wrappers.forEach((wrapper, index) => {
      const distance = Math.abs(wrapper.getBoundingClientRect().top - containerTop - 12);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = index + 1;
      }
    });

    this.current = bestPage;
    this.emit();
  }

  async zoomIn(): Promise<void> {
    this.scale = this.clampScale(Number((this.scale + this.config.zoomstep).toFixed(2)));
    await this.renderAll();
    this.goToPage(this.current);
  }

  async zoomOut(): Promise<void> {
    this.scale = this.clampScale(Number((this.scale - this.config.zoomstep).toFixed(2)));
    await this.renderAll();
    this.goToPage(this.current);
  }

  fitToWidth(): void {
    if (!this.doc) return;
    void this.doc.getPage(this.current).then((page) => {
      const unscaled = page.getViewport({ scale: 1, rotation: this.config.rotate });
      const availableWidth = Math.max(this.container.clientWidth - 32, 200);
      this.scale = this.clampScale(availableWidth / unscaled.width);
      void this.renderAll().then(() => this.goToPage(this.current));
    });
  }

  private emit(): void {
    const total = this.doc?.numPages ?? 0;
    this.hooks.onState({
      page: this.current,
      total,
      ready: !!this.doc,
      canPrev: !!this.doc && this.current > 1,
      canNext: !!this.doc && this.current < total,
      canZoomIn: !!this.doc && this.scale < this.config.maxzoom,
      canZoomOut: !!this.doc && this.scale > this.config.minzoom,
    });
  }
}
