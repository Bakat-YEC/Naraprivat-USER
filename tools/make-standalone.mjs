import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-standalone');
const ENTRY = path.join(DIST, 'index.standalone.html');
const LAYER = path.join(ROOT, 'tools', 'standalone', 'offline-layer.js');
const DBCONF = path.join(ROOT, 'server', 'data', 'db.json');
const OUT = path.join(ROOT, 'NARAPRIVAT-standalone.html');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function resolveAsset(p) {
  let clean = p;
  if (clean.startsWith('./')) clean = clean.slice(2);
  if (clean.startsWith('/')) clean = clean.slice(1);
  return path.join(DIST, clean);
}

let html = read(ENTRY);

// 1. Inline stylesheets
html = html.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g, (m, href) => {
  const abs = resolveAsset(href);
  const css = read(abs);
  return `\n<style>\n${css.replace(/<\/script/gi, '<\\/script')}\n</style>\n`;
});

// 2. Inline module scripts
html = html.replace(/<script[^>]*src="([^"]+\.js)"[^>]*>(<\/script>)?/g, (m, src) => {
  const abs = resolveAsset(src);
  const js = read(abs);
  return `\n<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
});

// 3. Inject offline layer (classic script) before the first module script
const layer = read(LAYER);
const db = read(DBCONF);
const dbJson = JSON.stringify(JSON.parse(db)).replace(/</g, '\\u003c');
const layerScript = layer.split('__EMBED_DB_PAYLOAD__').join(dbJson);
const offlineTag = `\n<script>\n${layerScript.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
html = html.replace(/<script type="module">/, offlineTag + '<script type="module">');

// 4. Fallback tip for offline usage
html = html.replace(
  '<title>',
  '<meta name="color-scheme" content="light" />\n    <title>'
);

fs.writeFileSync(OUT, html, 'utf8');
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log('OK ->', OUT, `(${kb} KB)`);