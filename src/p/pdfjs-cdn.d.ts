declare module "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.mjs" {
  export interface PageViewport {
    width: number;
    height: number;
    convertToViewportPoint(x: number, y: number): number[];
  }

  export interface RenderParameters {
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewport;
    transform?: number[] | null;
  }

  export interface RenderTask {
    promise: Promise<void>;
    cancel(): void;
  }

  // Conteúdo de texto opaco — repassado direto ao `TextLayer`.
  export interface TextContent {
    items: unknown[];
    styles: Record<string, unknown>;
  }

  export interface Annotation {
    subtype?: string;
    url?: string;
    dest?: unknown;
    rect: number[];
  }

  export interface PDFPageProxy {
    getViewport(params: { scale: number; rotation?: number }): PageViewport;
    render(params: RenderParameters): RenderTask;
    getTextContent(): Promise<TextContent>;
    getAnnotations(): Promise<Annotation[]>;
    cleanup(): void;
  }

  export interface PDFDocumentProxy {
    readonly numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    getDestination(id: string): Promise<unknown[] | null>;
    getPageIndex(ref: unknown): Promise<number>;
    getData(): Promise<Uint8Array>;
    destroy(): Promise<void>;
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export interface DocumentInitParameters {
    url: string;
    password?: string | undefined;
    withCredentials?: boolean;
    disableAutoFetch?: boolean;
    disableStream?: boolean;
  }

  export function getDocument(params: DocumentInitParameters): PDFDocumentLoadingTask;

  export interface TextLayerParameters {
    textContentSource: TextContent;
    container: HTMLElement;
    viewport: PageViewport;
  }

  export class TextLayer {
    constructor(params: TextLayerParameters);
    render(): Promise<void>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };
}
