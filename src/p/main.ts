import { buildConfig } from "./config";
import { resolvePdfSource } from "./pdf-source";
import { PdfViewer, type ViewerState } from "./viewer";
import { SearchController } from "./search";

// v1.0.1 — log de inicialização desativado (paridade com a versão legacy).

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado.`);
  return node as T;
}

const status = el("status");
const statusTitle = el("statusTitle");
const statusDetail = el("statusDetail");
const appElement = el("app");
const toolbar = el("toolbar");
const viewerContainer = el("viewerContainer");
const pagesElement = el("pages");
const pageInfo = el("pageInfo");
const prevButton = el<HTMLButtonElement>("prev");
const nextButton = el<HTMLButtonElement>("next");
const zoomOutButton = el<HTMLButtonElement>("zoomOut");
const zoomInButton = el<HTMLButtonElement>("zoomIn");
const fitButton = el<HTMLButtonElement>("fit");
const searchToggleButton = el<HTMLButtonElement>("searchToggle");
const downloadButton = el<HTMLButtonElement>("download");
const fullscreenButton = el<HTMLButtonElement>("fullscreen");

const config = buildConfig(new URLSearchParams(location.search));
// console.info(config);

const search = new SearchController({
  bar: el("searchBar"),
  input: el<HTMLInputElement>("searchInput"),
  count: el("searchCount"),
  prev: el<HTMLButtonElement>("searchPrev"),
  next: el<HTMLButtonElement>("searchNext"),
  close: el<HTMLButtonElement>("searchClose"),
});
search.attach();

function showStatus(title: string, detail = ""): void {
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
  status.hidden = false;
}

function hideStatus(): void {
  status.hidden = true;
}

function renderToolbar(state: ViewerState): void {
  pageInfo.textContent = `Página ${state.page} de ${state.total}`;
  prevButton.disabled = !state.canPrev;
  nextButton.disabled = !state.canNext;
  zoomOutButton.disabled = !state.canZoomOut;
  zoomInButton.disabled = !state.canZoomIn;
  fitButton.disabled = !state.ready;
  downloadButton.disabled = !state.ready;
}

const viewer = new PdfViewer(viewerContainer, pagesElement, config, {
  onState: renderToolbar,
  onStatus: (title) => (title ? showStatus(title) : hideStatus()),
  afterRender: () => {
    if (config.search) search.refresh();
  },
});

function applyConfig(): void {
  if (config.theme === "light") document.documentElement.classList.add("theme-light");
  if (config.title) document.title = config.title;

  if (!config.toolbar) {
    toolbar.hidden = true;
    appElement.classList.add("no-toolbar");
  }

  prevButton.hidden = !config.nav;
  nextButton.hidden = !config.nav;

  zoomOutButton.hidden = !config.zoomctrl;
  zoomInButton.hidden = !config.zoomctrl;
  fitButton.hidden = !config.zoomctrl;

  searchToggleButton.hidden = !config.search;
  downloadButton.hidden = !config.download;
  fullscreenButton.hidden = !config.fullscreen;

  // Impressão bloqueada por padrão; libera removendo a classe.
  if (!config.print) document.documentElement.classList.add("print-blocked");
}

// ---------------------------------------------------------------------------
// Download (usa os bytes já carregados; evita novo fetch/CORS).
// ---------------------------------------------------------------------------

async function downloadPdf(): Promise<void> {
  const doc = viewer.document;
  if (!doc) return;
  try {
    const data = await doc.getData();
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "documento.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error("Falha no download:", error);
  }
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen?.();
  } else {
    void viewerContainer.requestFullscreen?.();
  }
}

// ---------------------------------------------------------------------------
// Eventos.
// ---------------------------------------------------------------------------

prevButton.addEventListener("click", () => viewer.previous());
nextButton.addEventListener("click", () => viewer.next());
zoomOutButton.addEventListener("click", () => void viewer.zoomOut());
zoomInButton.addEventListener("click", () => void viewer.zoomIn());
fitButton.addEventListener("click", () => viewer.fitToWidth());

downloadButton.addEventListener("click", () => void downloadPdf());
fullscreenButton.addEventListener("click", toggleFullscreen);
searchToggleButton.addEventListener("click", () => search.toggle());

// Bloqueios de interface — aplicados conforme a configuração (modo restrito por
// padrão). São barreiras de conveniência, não proteção absoluta.
if (!config.contextmenu) {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

document.addEventListener(
  "keydown",
  (event) => {
    const key = event.key.toLowerCase();

    // Atalho de busca (quando habilitada).
    if (config.search && (event.ctrlKey || event.metaKey) && key === "f") {
      event.preventDefault();
      search.open();
      return;
    }

    if (config.hotkeys) return; // atalhos liberados

    const blocked: string[] = [];
    if (!config.print) blocked.push("p");
    if (!config.download) blocked.push("s");
    blocked.push("u"); // ver código-fonte
    if ((event.ctrlKey || event.metaKey) && blocked.includes(key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true,
);

if (!config.print) {
  window.addEventListener("beforeprint", (event) => {
    event.preventDefault();
    alert("A impressão deste documento está desabilitada.");
  });
}

// ---------------------------------------------------------------------------
// Inicialização.
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  applyConfig();
  viewer.syncState();

  let pdfUrl = config.u;
  try {
    pdfUrl = resolvePdfSource(config.u);
    showStatus("Carregando PDF…");
    await viewer.load(pdfUrl);
    await viewer.renderAll();

    if (!viewer.usesNumericZoom && config.fit === "width") {
      viewer.fitToWidth();
    } else {
      viewer.goToPage(viewer.currentPage);
    }
  } catch (error) {
    console.error(error);
    showStatus("Abrir o arquivo");
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.target = "_blank";
    link.rel = "noopener";
    const openButton = document.createElement("button");
    openButton.id = "open-button";
    openButton.tabIndex = 1;
    openButton.textContent = "Abrir";
    link.appendChild(openButton);
    statusDetail.replaceChildren(link);
  }
}

void start();
