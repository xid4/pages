# paginas

Site estático (GitHub Pages) publicado a partir da pasta `docs/`

Os arquivos `.html` na raiz do repositório (e subpastas como `p/` e `v/`) são o **código-fonte legível**. O build gera uma cópia ofuscada/minificada desses arquivos dentro de `docs/`, que é o que efetivamente fica público no GitHub Pages.

## Versões do visualizador de PDF

Existem duas implementações do visualizador, mantidas lado a lado para comparação de desempenho:

- **`p/`** — versão **moderna**. O código-fonte real vive em `src/p/` como módulos **TypeScript** (ver "Fonte moderna" abaixo) e é compilado/inlinado para `p/index.html`. Usa renderização preguiçosa por página (`IntersectionObserver`), cancelamento de render em zoom/reload e tipos.
- **`legacy/p/index.html`** — versão **vanilla** original (JS inline, renderiza todas as páginas de uma vez). Serve como baseline de comparação.

Ambas passam pelo mesmo pipeline de ofuscação e são publicadas em `docs/`.

## Fonte moderna (`src/p/`)

É um port TypeScript **fiel** de `legacy/p/index.html` (mesmas features: config via parâmetro `p`, tema, camada de texto, busca, links, download, fullscreen, watermark, rotação, senha, permissões):

- `src/p/main.ts` — bootstrap: wiring do DOM, `applyConfig`, eventos, bloqueios e inicialização.
- `src/p/viewer.ts` — motor de renderização (`PdfViewer`): páginas, navegação, zoom, fit, camadas.
- `src/p/config.ts` — parâmetro `p` (JSON direto/invertido/Base64), `DEFAULTS`, `buildConfig` e o tipo `Config`.
- `src/p/pdf-source.ts` — resolução da URL do PDF (direta / invertida / Base64), funções puras.
- `src/p/render-layers.ts` — camada de texto, links (anotações + URLs no texto) e marca d'água.
- `src/p/search.ts` — `SearchController` (busca, destaque e navegação de ocorrências).
- `src/p/decode.ts` — utilidades de desofuscação (reverse / Base64) compartilhadas.
- `src/p/pdfjs.ts` + `pdfjs-cdn.d.ts` — fachada tipada do pdf.js carregado da CDN (mantido externo no bundle).
- `src/p/index.html` — template com os marcadores `/* __STYLES__ */` e `/* __BUNDLE__ */`.
- `src/p/styles.css` — estilos.

O `scripts/build-p.js` usa **esbuild** para empacotar `src/p/main.ts` (formato ESM, pdf.js externo), minifica o CSS e inlina ambos no template, gerando `p/index.html`. A pasta `src/` é ignorada pelo ofuscador.

> **Nunca edite `p/index.html` à mão** — ele é gerado a partir de `src/p/`. Edite os fontes TypeScript e rode o build.

## Pré-requisitos

- Node.js 18+ e npm

## Instalação

```bash
npm install
```

## Build

```bash
npm run build
```

Isso executa, em ordem, `scripts/build-p.js` (compila `src/p/` → `p/index.html`) e depois `scripts/legacy-obfuscate-html.js`, que:

1. Percorre o repositório procurando todos os arquivos `.html` (ignorando `node_modules`, `.git`, `docs`, `build`, `src`, `scripts`, `.idea`, `.ai-jail`);
2. Ofusca o JavaScript de cada `<script>` inline com [`javascript-obfuscator`](https://github.com/javascript-obfuscator/javascript-obfuscator) (control-flow flattening, dead code injection, string array com criptografia RC4, nomes de identificadores em hexadecimal, self-defending). Scripts externos (`<script src="...">`) são mantidos como estão;
3. Minifica o CSS de cada `<style>` inline com `clean-css`;
4. Minifica o HTML resultante (remove comentários e espaços em branco) com `html-minifier-terser`;
5. Grava o resultado em `docs/`, preservando a mesma estrutura de pastas do arquivo original (ex.: `p/index.html` → `docs/p/index.html`).

## Fluxo de trabalho

1. Edite os arquivos-fonte: para o visualizador moderno, os módulos em `src/p/`; para as demais páginas, o HTML na raiz (`index.html`, `legacy/p/index.html`, `v/index.html`, etc.). **Nunca edite direto dentro de `docs/`** (gerado pelo ofuscador) **nem `p/index.html`** (gerado a partir de `src/p/`).
2. Rode `npm run build`.
3. Confira o resultado em `docs/`.
4. Faça commit das mudanças nos arquivos-fonte **e** no conteúdo gerado em `docs/` (é o que o GitHub Pages publica).

## Ajustando o nível de ofuscação

As opções passadas ao `javascript-obfuscator` ficam em `OBFUSCATOR_OPTIONS`, no topo de `scripts/legacy-obfuscate-html.js`. Para uma ofuscação ainda mais agressiva (à custa de possíveis efeitos colaterais, como travar o DevTools), é possível habilitar `debugProtection` e `disableConsoleOutput` — atualmente desativados para não quebrar a depuração/console do navegador.
