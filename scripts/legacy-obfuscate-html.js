#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const JavaScriptObfuscator = require("javascript-obfuscator");
const CleanCSS = require("clean-css");
const { minify: minifyHtml } = require("html-minifier-terser");

const BASE = path.resolve(__dirname, "../");
const ROOT = path.join(BASE, "legacy");
const OUT_DIR = path.join(BASE, "docs/legacy");
const IGNORE_DIRS = new Set([
    "node_modules", ".git", "docs", "build", ".idea", ".ai-jail", "scripts", "src"
]);

const OBFUSCATOR_OPTIONS = {
  compact: true,
  simplify: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  numbersToExpressions: true,
  stringArray: true,
  stringArrayEncoding: ["rc4"],
  stringArrayThreshold: 1,
  rotateStringArray: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  transformObjectKeys: true,
  selfDefending: true,
  unicodeEscapeSequence: false,
};

function findHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

function obfuscateInlineScripts($) {
  $("script").each((_, el) => {
    const node = $(el);
    if (node.attr("src")) return; // external script, nothing to obfuscate here
    const code = node.text();
    if (!code || !code.trim()) return;
    try {
      const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS).getObfuscatedCode();
      node.text(result);
    } catch (err) {
      console.warn(`  ! failed to obfuscate inline <script>: ${err.message}`);
    }
  });
}

function minifyInlineStyles($) {
  $("style").each((_, el) => {
    const node = $(el);
    const css = node.text();
    if (!css || !css.trim()) return;
    const result = new CleanCSS({ level: 2 }).minify(css);
    if (!result.errors.length) {
      node.text(result.styles);
    }
  });
}

async function processFile(file) {
  const relative = path.relative(ROOT, file);
  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html, { decodeEntities: false });

  obfuscateInlineScripts($);
  minifyInlineStyles($);

  let output = $.html();

  output = await minifyHtml(output, {
    collapseWhitespace: true,
    conservativeCollapse: false,
    removeComments: true,
    removeAttributeQuotes: false,
    minifyJS: false, // already obfuscated above; avoid re-processing
    minifyCSS: false, // already minified above
  });

  const destination = path.join(OUT_DIR, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, output, "utf8");
  console.log(`  ✔ ${relative}`);
}

async function main() {
  const files = findHtmlFiles(ROOT);
  if (!files.length) {
    console.log("Nenhum arquivo .html encontrado.");
    return;
  }

  console.log(`Encontrados ${files.length} arquivo(s) .html. Gerando build ofuscado em ${path.relative(ROOT, OUT_DIR)}/ ...`);
  for (const file of files) {
    await processFile(file);
  }
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
