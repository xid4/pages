#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const CleanCSS = require("clean-css");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src", "p");
const OUT = path.join(ROOT, "docs", "p", "index.html");

// pdf.js é carregado da CDN em runtime; mantido externo (não é bundlado).
const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.mjs";

async function bundle() {
  const result = await esbuild.build({
    entryPoints: [path.join(SRC, "main.ts")],
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    minify: true,
    legalComments: "none",
    external: [PDFJS_CDN],
    write: false,
  });
  return result.outputFiles[0].text.trim();
}

function minifyCss() {
  const css = fs.readFileSync(path.join(SRC, "styles.css"), "utf8");
  const out = new CleanCSS({ level: 2 }).minify(css);
  if (out.errors.length) throw new Error(out.errors.join("\n"));
  return out.styles;
}

async function main() {
  const template = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  const [js, css] = [await bundle(), minifyCss()];

  const html = template
    .replace("/* __STYLES__ */", () => css)
    .replace("/* __BUNDLE__ */", () => js);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html, "utf8");
  console.log(`  ✔ src/p → ${path.relative(ROOT, OUT)} (js ${js.length}b, css ${css.length}b)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
