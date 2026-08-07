# Visualizador de PDF (pdf.js) — Parâmetros

Documentação dos parâmetros de configuração do visualizador baseado em
[`pdfjs-dist`](https://github.com/mozilla/pdf.js). O visualizador é um
**HTML estático** (`p/index.html`) que carrega o pdf.js via CDN e lê as opções
a partir da **query string** da URL.

```
/p/index.html?u=<fonte-do-pdf>&<opção>=<valor>&<opção>=<valor>...
```

> **Legenda de estado**
> - ✅ **Implementado** — já funciona no `p/index.html` atual.
> - 🔧 **Proposto** — não existe hoje; documentado como extensão possível.
>
> Tipos booleanos aceitam: `1`/`0`, `true`/`false`, `yes`/`no`, `on`/`off`.
> Valores são *case-insensitive*. Parâmetros desconhecidos são ignorados.

---

## 1. Fonte do documento

### `u` — Fonte do PDF ✅ *(obrigatório)*

URL do arquivo PDF a ser exibido. O valor é resolvido tentando, **nesta ordem**,
os seguintes formatos até encontrar uma URL `http://` ou `https://` válida:

| Ordem | Formato                       | Descrição                                          |
|-------|-------------------------------|----------------------------------------------------|
| 1     | URL direta                    | `https://exemplo.com/arquivo.pdf`                  |
| 2     | String invertida              | A URL escrita de trás para frente                  |
| 3     | Base64                        | Base64 tradicional **ou** URL-safe (`-` `_`)       |
| 4     | String invertida + Base64     | Inverte e então decodifica Base64                  |
| 5     | Base64 + invertida            | Decodifica Base64 e então inverte                  |

- Apenas os protocolos `http:` e `https:` são aceitos (validação em `validatePdfUrl`).
- Base64 aceita tanto o formato padrão quanto o *URL-safe*, com *padding* opcional.

**Exemplos**

```
?u=https://exemplo.com/doc.pdf
?u=fdp.cod/moc.olpmexe//:sptth                # invertida
?u=aHR0cHM6Ly9leGVtcGxvLmNvbS9kb2MucGRm      # Base64
```

### `password` — Senha do PDF 🔧

Senha para abrir PDFs protegidos. Repassada ao `getDocument({ password })` do
pdf.js. **Cuidado:** fica visível na URL — prefira solicitar via prompt.

```
?u=...&password=segredo
```

### `credentials` — Enviar cookies/credenciais 🔧

Controla `withCredentials` no carregamento (hoje fixo em `false`). Útil para PDFs
atrás de autenticação por cookie **no mesmo domínio (CORS permitindo)**.

```
?credentials=1      # withCredentials: true
```

---

## 2. Navegação e página inicial

| Parâmetro | Estado | Tipo    | Padrão | Descrição |
|-----------|--------|---------|--------|-----------|
| `page`    | 🔧     | inteiro | `1`    | Página exibida ao abrir. |
| `nav`     | 🔧     | boolean | `1`    | Mostra/oculta os botões ◀ ▶ de navegação. |
| `pagemode`| 🔧     | enum    | `continuous` | `continuous` (rolagem contínua, atual) ou `single` (uma página por vez). |
| `spread`  | 🔧     | enum    | `none` | Modo de páginas lado a lado: `none`, `odd`, `even`. |

```
?u=...&page=5&pagemode=single
```

> O visualizador atual sempre renderiza **todas as páginas em rolagem contínua**
> e detecta a página corrente pelo scroll (`updateCurrentPageFromScroll`).

---

## 3. Zoom e ajuste

| Parâmetro  | Estado | Tipo         | Padrão   | Descrição |
|------------|--------|--------------|----------|-----------|
| `zoom`     | 🔧     | número/enum  | `auto`   | Escala inicial. Número (`1.25`), porcentagem (`150`) ou palavra-chave `auto` / `page-width` / `page-fit` / `page-actual`. |
| `fit`      | 🔧     | enum         | `width`  | Ajuste inicial: `width` (ajustar à largura, comportamento atual do botão ↔), `page`, `none`. |
| `minzoom`  | 🔧     | número       | `0.5`    | Zoom mínimo permitido. |
| `maxzoom`  | 🔧     | número       | `3`      | Zoom máximo permitido. |
| `zoomstep` | 🔧     | número       | `0.25`   | Incremento dos botões `+` / `−`. |
| `zoomctrl` | 🔧     | boolean      | `1`      | Mostra/oculta os botões de zoom `+` `−` `↔`. |

Valores atuais (fixos no código): `scale` inicial `1.25`, limites `0.5`–`3`,
passo `0.25`, e ajuste à largura acionado no carregamento (`fitToWidth`).

```
?u=...&zoom=page-width&minzoom=0.75&maxzoom=4&zoomstep=0.1
```

---

## 4. Busca e seleção de texto

### `search` (alias `find`) — Caixa de busca no texto 🔧

Habilita um campo de busca com destaque de ocorrências e navegação
anterior/próxima. Requer a **camada de texto** (`text layer`) do pdf.js, que não é
renderizada hoje (apenas o `canvas`).

```
?u=...&search=1                 # habilita a busca
?u=...&search=1&q=contrato      # já abre buscando por "contrato"
```

| Sub-parâmetro | Tipo    | Descrição |
|---------------|---------|-----------|
| `q`           | texto   | Termo pré-preenchido / busca automática ao abrir. |
| `matchcase`   | boolean | Diferenciar maiúsculas/minúsculas. |
| `wholeword`   | boolean | Somente palavra inteira. |
| `highlightall`| boolean | Destacar todas as ocorrências de uma vez. |

### `select` — Permitir seleção/cópia de texto 🔧

| Valor | Efeito |
|-------|--------|
| `0` (padrão atual de fato) | Sem camada de texto: **não** é possível selecionar/copiar. |
| `1`   | Renderiza a *text layer* sobreposta ao canvas, permitindo selecionar e copiar. |

> Hoje o texto **não é selecionável** porque só o `canvas` é desenhado. Habilitar
> `select` ou `search` exige adicionar a *text layer* do pdf.js.

---

### `links` — Hyperlinks clicáveis ✅

| Valor        | Efeito |
|--------------|--------|
| `1`          | Torna os links do PDF clicáveis. |
| `0` (padrão) | Links não são clicáveis (modo restrito). |

Cobre **dois casos**:

1. **Anotações de link reais** do PDF (subtype `Link`): URLs externas abrem em
   nova aba (`rel="noopener noreferrer nofollow"`); links internos (ex.: sumário)
   rolam para a página de destino.
2. **URLs que aparecem apenas como texto** (sem anotação): são detectadas na
   camada de texto e sobrepostas por âncoras clicáveis (*linkify*).

> Como o *linkify* depende da camada de texto, ligar `links` a renderiza
> automaticamente (mesmo com `select`/`search` desligados). A detecção reconhece
> `http(s)://…`, `www.…` e domínios com caminho (`dominio.com/rota`); URLs
> quebradas em várias linhas podem não ser detectadas.

```
?u=...&links=1
# via JSON: {"u":"...","links":true}
```

---

## 5. Download, impressão e proteções

O visualizador atual adota postura **anti-download/anti-impressão** por padrão
(barreiras de conveniência, **não** proteção real):

- `oncontextmenu="return false"` desabilita o menu de contexto (botão direito).
- `@media print { html, body { display: none } }` esconde tudo na impressão.
- `beforeprint` exibe alerta e cancela a impressão.
- `keydown` bloqueia `Ctrl/Cmd + P`, `Ctrl/Cmd + S`, `Ctrl/Cmd + U`.

Parâmetros propostos para tornar isso configurável:

| Parâmetro     | Estado | Tipo    | Padrão | Descrição |
|---------------|--------|---------|--------|-----------|
| `download`    | 🔧     | boolean | `0`    | Exibe botão de **download** e libera o salvamento do arquivo. |
| `print`       | 🔧     | boolean | `0`    | Libera a **impressão** (remove o bloqueio de `beforeprint`/`@media print`). |
| `contextmenu` | 🔧     | boolean | `0`    | Reabilita o menu de contexto do botão direito. |
| `hotkeys`     | 🔧     | boolean | `0`    | Libera atalhos `Ctrl+P/S/U` (hoje bloqueados). |
| `save`        | 🔧     | boolean | `0`    | Alias/companheiro de `download`; permite salvar. |

```
?u=...&download=1&print=1&contextmenu=1
```

> ⚠️ **Importante:** desabilitar download/impressão **não** protege o conteúdo. O
> PDF ainda trafega para o navegador e pode ser obtido. Trate esses parâmetros
> como conveniência de UX, não como DRM.

---

## 6. Tela cheia (fullscreen)

### `fullscreen` — Botão de tela cheia 🔧

| Valor          | Efeito |
|----------------|--------|
| `1`            | Adiciona um botão ⛶ que aciona a Fullscreen API (`requestFullscreen`). |
| `auto`         | Entra em tela cheia automaticamente ao carregar (sujeito a exigir gesto do usuário no navegador). |
| `0` (padrão)   | Sem botão de tela cheia. |

```
?u=...&fullscreen=1
```

### `presentation` — Modo apresentação 🔧

Modo de tela cheia página-a-página (semelhante ao *presentation mode* do pdf.js),
com navegação por setas/clique. Implica `fullscreen`.

```
?u=...&presentation=1
```

---

## 7. Interface (toolbar, tema, idioma)

| Parâmetro   | Estado | Tipo    | Padrão      | Descrição |
|-------------|--------|---------|-------------|-----------|
| `toolbar`   | 🔧     | boolean | `1`         | Mostra/oculta a barra de ferramentas superior inteira. |
| `theme`     | 🔧     | enum    | `dark`      | `dark` (atual, via `color-scheme: dark`), `light` ou `auto`. |
| `lang`      | 🔧     | enum    | `pt-BR`     | Idioma da UI (rótulos/`aria-label`). |
| `title`     | 🔧     | texto   | do PDF      | Sobrescreve o `<title>` da aba/janela. |
| `sidebar`   | 🔧     | boolean | `0`         | Exibe painel lateral. |
| `thumbnails`| 🔧     | boolean | `0`         | Miniaturas das páginas na sidebar. |
| `outline`   | 🔧     | boolean | `0`         | Marcadores/sumário (bookmarks) do PDF na sidebar. |
| `rotate`    | 🔧     | inteiro | `0`         | Rotação inicial em graus: `0`, `90`, `180`, `270`. |
| `rotatectrl`| 🔧     | boolean | `0`         | Botões de rotação ⟳ ⟲. |
| `watermark` | 🔧     | texto   | —           | Texto de marca d’água sobreposto às páginas. |

```
?u=...&theme=light&toolbar=1&sidebar=1&thumbnails=1&rotate=90
```

---

## 8. Carregamento e desempenho

Opções repassadas ao `pdfjsLib.getDocument(...)`. Valores atuais entre parênteses.

| Parâmetro    | Estado | Tipo    | Padrão   | Descrição |
|--------------|--------|---------|----------|-----------|
| `autofetch`  | 🔧     | boolean | `1`      | `disableAutoFetch` invertido — pré-carrega o documento inteiro (atual: ligado). |
| `stream`     | 🔧     | boolean | `1`      | `disableStream` invertido — carregamento progressivo (atual: ligado). |
| `dpr`        | 🔧     | número  | `≤2`     | Limite de *device pixel ratio* na renderização (atual: `min(devicePixelRatio, 2)`). |
| `worker`     | 🔧     | boolean | `1`      | Usa Web Worker do pdf.js (recomendado ligado). |

```
?u=...&autofetch=0&stream=1&dpr=2
```

---

## 9. Tabela-resumo de todos os parâmetros

| Parâmetro     | Estado | Categoria        | Padrão          |
|---------------|--------|------------------|-----------------|
| `u`           | ✅     | Fonte            | — (obrigatório) |
| `password`    | 🔧     | Fonte            | —               |
| `credentials` | 🔧     | Fonte            | `0`             |
| `page`        | 🔧     | Navegação        | `1`             |
| `nav`         | 🔧     | Navegação        | `1`             |
| `pagemode`    | 🔧     | Navegação        | `continuous`    |
| `spread`      | 🔧     | Navegação        | `none`          |
| `zoom`        | 🔧     | Zoom             | `auto`          |
| `fit`         | 🔧     | Zoom             | `width`         |
| `minzoom`     | 🔧     | Zoom             | `0.5`           |
| `maxzoom`     | 🔧     | Zoom             | `3`             |
| `zoomstep`    | 🔧     | Zoom             | `0.25`          |
| `zoomctrl`    | 🔧     | Zoom             | `1`             |
| `search`/`find`| 🔧    | Texto            | `1`             |
| `q`           | 🔧     | Texto            | —               |
| `matchcase`   | 🔧     | Texto            | `0`             |
| `wholeword`   | 🔧     | Texto            | `0`             |
| `highlightall`| 🔧     | Texto            | `0`             |
| `select`      | 🔧     | Texto            | `0`             |
| `links`       | ✅     | Texto            | `1`             |
| `download`    | 🔧     | Proteções        | `0`             |
| `print`       | 🔧     | Proteções        | `0`             |
| `contextmenu` | 🔧     | Proteções        | `0`             |
| `hotkeys`     | 🔧     | Proteções        | `0`             |
| `fullscreen`  | 🔧     | Tela cheia       | `1`             |
| `presentation`| 🔧     | Tela cheia       | `0`             |
| `toolbar`     | 🔧     | Interface        | `1`             |
| `theme`       | 🔧     | Interface        | `dark`          |
| `lang`        | 🔧     | Interface        | `pt-BR`         |
| `title`       | 🔧     | Interface        | do PDF          |
| `sidebar`     | 🔧     | Interface        | `0`             |
| `thumbnails`  | 🔧     | Interface        | `0`             |
| `outline`     | 🔧     | Interface        | `0`             |
| `rotate`      | 🔧     | Interface        | `0`             |
| `rotatectrl`  | 🔧     | Interface        | `0`             |
| `watermark`   | 🔧     | Interface        | —               |
| `autofetch`   | 🔧     | Desempenho       | `1`             |
| `stream`      | 🔧     | Desempenho       | `1`             |
| `dpr`         | 🔧     | Desempenho       | `≤2`            |
| `worker`      | 🔧     | Desempenho       | `1`             |

---

## 10. Exemplos completos

**Visualização básica (estado atual):**
```
/p/index.html?u=https://exemplo.com/doc.pdf
```

**Leitura amigável — download, busca, seleção e tela cheia:**
```
/p/index.html?u=https://exemplo.com/doc.pdf&download=1&print=1&search=1&select=1&fullscreen=1&contextmenu=1
```

**Modo restrito (padrão de hoje, explícito):**
```
/p/index.html?u=https://exemplo.com/doc.pdf&download=0&print=0&contextmenu=0&hotkeys=0
```

**Abrir na página 3, ajustando à largura, tema claro, com sumário:**
```
/p/index.html?u=https://exemplo.com/doc.pdf&page=3&fit=width&theme=light&outline=1&search=1
```

---

## 11. Notas de implementação

Para transformar os itens 🔧 em ✅, os pontos de acoplamento no `p/index.html` são:

- **Leitura das opções:** usar o `URLSearchParams` já existente (`params`) e um
  *helper* de parse booleano (`1/0/true/false/yes/no/on/off`).
- **Busca / seleção (`search`, `select`):** renderizar a **text layer** do pdf.js
  (`page.getTextContent()` + `pdfjsLib.renderTextLayer`) sobre cada `.page-wrap`.
- **Download (`download`):** botão que faz `getData()`/`fetch` do PDF e dispara um
  `<a download>`.
- **Impressão / atalhos (`print`, `hotkeys`, `contextmenu`):** condicionar os
  bloqueios em `beforeprint`, no listener de `keydown` e no `oncontextmenu`.
- **Tela cheia (`fullscreen`):** `viewerContainer.requestFullscreen()`.
- **Zoom/navegação (`zoom`, `page`, `min/maxzoom`, `zoomstep`):** substituir as
  constantes fixas (`scale = 1.25`, limites `0.5`–`3`, passo `0.25`).
- **Carregamento (`autofetch`, `stream`, `credentials`, `password`):** mapear
  para as opções de `pdfjsLib.getDocument({...})`.
```

