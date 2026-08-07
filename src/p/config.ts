import { reverseString, decodeBase64 } from "./decode";

export type Theme = "dark" | "light";
export type Fit = "width" | "none";
export type Rotation = 0 | 90 | 180 | 270;

export interface Config {
  u: string; // fonte do PDF (URL direta/invertida/Base64…)
  password: string; // senha do PDF protegido
  credentials: boolean; // enviar cookies (withCredentials)
  autofetch: boolean; // pré-carregar documento inteiro
  stream: boolean; // carregamento progressivo
  page: number; // página inicial
  rotate: Rotation; // rotação inicial
  zoom: number | string | null; // número (escala) ou palavra-chave; null => usa `fit`
  fit: Fit;
  minzoom: number;
  maxzoom: number;
  zoomstep: number;
  toolbar: boolean; // exibe a barra de ferramentas
  nav: boolean; // botões ◀ ▶
  zoomctrl: boolean; // botões − + ↔
  // Permissões — todas FALSE por padrão (modo restrito).
  download: boolean;
  print: boolean;
  contextmenu: boolean;
  hotkeys: boolean;
  select: boolean; // seleção/cópia de texto
  search: boolean; // caixa de busca
  links: boolean; // hyperlinks do PDF clicáveis
  fullscreen: boolean; // botão de tela cheia
  // Interface.
  theme: Theme;
  watermark: string; // texto de marca d'água
  title: string; // sobrescreve o <title>
}

type RawConfig = Record<string, unknown>;

const DEFAULTS = {
  u: "",
  password: "",
  credentials: false,
  autofetch: true,
  stream: true,
  page: 1,
  rotate: 0,
  zoom: null as number | string | null,
  fit: "width",
  minzoom: 0.5,
  maxzoom: 3,
  zoomstep: 0.25,
  toolbar: true,
  nav: true,
  zoomctrl: true,
  download: false,
  print: false,
  contextmenu: false,
  hotkeys: false,
  select: false,
  search: true,
  links: true,
  fullscreen: true,
  theme: "dark",
  watermark: "",
  title: "",
};

function tryParseObject(candidate: string | null): RawConfig | null {
  if (candidate == null) return null;
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as RawConfig;
    }
  } catch {
    /* ignora candidato inválido */
  }
  return null;
}

/**
 * Resolve o parâmetro `p` (JSON, possivelmente invertido/Base64). Sem `p` ou
 * ilegível => configuração vazia => modo mais restrito.
 */
function resolveConfig(raw: string): RawConfig {
  if (!raw) return {};

  const reversed = reverseString(raw);
  const fromBase64 = decodeBase64(raw);
  const candidates: Array<{ description: string; value: string | null }> = [
    { description: "JSON direto", value: raw },
    { description: "JSON invertido", value: reversed },
    { description: "Base64 + JSON", value: fromBase64 },
    { description: "invertido + Base64 + JSON", value: reversed ? decodeBase64(reversed) : null },
    { description: "Base64 + invertido + JSON", value: fromBase64 != null ? reverseString(fromBase64) : null },
  ];

  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate.value);
    if (parsed) {
      // console.info(`Configuração identificada por: ${candidate.description}`);
      return parsed;
    }
  }

  console.warn("Parâmetro 'p' presente mas ilegível — aplicando modo restrito.");
  return {};
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(normalized)) return false;
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(number) ? number : fallback;
}

export function buildConfig(params: URLSearchParams): Config {
  const raw = (params.get("p") ?? "").trim();
  const parsed = resolveConfig(raw);
  const merged = { ...DEFAULTS, ...parsed } as RawConfig;

  const rotateValue = toNumber(merged.rotate, 0);
  const rotate: Rotation = ([0, 90, 180, 270] as number[]).includes(rotateValue)
    ? (rotateValue as Rotation)
    : 0;

  return {
    // `u` pode vir dentro do JSON ou, por compatibilidade, no parâmetro solto `?u=`.
    u: (String(merged.u ?? "") || params.get("u") || "").trim(),
    password: typeof merged.password === "string" ? merged.password : "",
    credentials: toBool(merged.credentials, false),
    autofetch: toBool(merged.autofetch, true),
    stream: toBool(merged.stream, true),
    page: Math.max(1, Math.floor(toNumber(merged.page, 1))),
    rotate,
    zoom: (merged.zoom as number | string | null) ?? null,
    fit: merged.fit === "none" ? "none" : "width",
    minzoom: toNumber(merged.minzoom, 0.5),
    maxzoom: toNumber(merged.maxzoom, 3),
    zoomstep: toNumber(merged.zoomstep, 0.25),
    toolbar: toBool(merged.toolbar, true),
    nav: toBool(merged.nav, true),
    zoomctrl: toBool(merged.zoomctrl, true),
    download: toBool(merged.download, false),
    print: toBool(merged.print, false),
    contextmenu: toBool(merged.contextmenu, false),
    hotkeys: toBool(merged.hotkeys, false),
    select: toBool(merged.select, false),
    search: toBool(merged.search, true),
    links: toBool(merged.links, true),
    fullscreen: toBool(merged.fullscreen, true),
    theme: merged.theme === "light" ? "light" : "dark",
    watermark: typeof merged.watermark === "string" ? merged.watermark : "",
    title: typeof merged.title === "string" ? merged.title : "",
  };
}
