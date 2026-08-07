# paginas

Site estático (GitHub Pages) publicado a partir da pasta `build/`

Os arquivos `.html` na raiz do repositório (e subpastas como `p/` e `v/`) são o **código-fonte legível**. O build gera uma cópia ofuscada/minificada desses arquivos dentro de `build/`, que é o que efetivamente fica público no GitHub Pages.

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

Isso executa `scripts/obfuscate-html.js`, que:

1. Percorre o repositório procurando todos os arquivos `.html` (ignorando `node_modules`, `.git`, `docs`, `.idea`);
2. Ofusca o JavaScript de cada `<script>` inline com [`javascript-obfuscator`](https://github.com/javascript-obfuscator/javascript-obfuscator) (control-flow flattening, dead code injection, string array com criptografia RC4, nomes de identificadores em hexadecimal, self-defending). Scripts externos (`<script src="...">`) são mantidos como estão;
3. Minifica o CSS de cada `<style>` inline com `clean-css`;
4. Minifica o HTML resultante (remove comentários e espaços em branco) com `html-minifier-terser`;
5. Grava o resultado em `build/`, preservando a mesma estrutura de pastas do arquivo original (ex.: `p/index.html` → `build/p/index.html`).

## Fluxo de trabalho

1. Edite o HTML/CSS/JS normalmente nos arquivos-fonte (`index.html`, `p.html`, `p/index.html`, `v/index.html`, etc.) — **nunca edite direto dentro de `build/`**, pois esse conteúdo é gerado e será sobrescrito no próximo build.
2. Rode `npm run build`.
3. Confira o resultado em `build/`.
4. Faça commit das mudanças nos arquivos-fonte **e** no conteúdo gerado em `build/` (é o que o GitHub Pages publica).

## Ajustando o nível de ofuscação

As opções passadas ao `javascript-obfuscator` ficam em `OBFUSCATOR_OPTIONS`, no topo de `scripts/obfuscate-html.js`. Para uma ofuscação ainda mais agressiva (à custa de possíveis efeitos colaterais, como travar o DevTools), é possível habilitar `debugProtection` e `disableConsoleOutput` — atualmente desativados para não quebrar a depuração/console do navegador.
