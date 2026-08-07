const PDFJS_VERSION = "6.1.200";
const BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

export const PDFJS_WORKER = `${BASE}/pdf.worker.mjs`;

export * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.mjs";
export type {
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
  Annotation,
} from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.mjs";
