// Sklapa laboratoriju koncepata u JEDAN samostalan HTML (docs/redesign/concept-lab.html).
// Pokretanje: node docs/redesign/lab/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const FONTS = [
  'Inter:wght@400;500;600;700;800',
  'Inter+Tight:wght@400;500;600;700;800',
  'JetBrains+Mono:wght@400;500;700',
  'Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..700',
  'DM+Sans:wght@400;500;600;700;800',
  'Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800',
  'IBM+Plex+Sans:wght@400;500;600;700',
  'IBM+Plex+Mono:wght@400;500;600',
  'Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600',
  'Public+Sans:wght@400;500;600;700;800',
  'Archivo:wdth,wght@62..125,400..800',
  'Figtree:wght@400;500;600;700;800',
  'Geist:wght@400;500;600;700',
  'Geist+Mono:wght@400;500;600'
].map((f) => 'family=' + f).join('&');
const before = {};
const dir = path.join(here, 'before');
for (const f of fs.readdirSync(dir)) before[f.replace(/\.webp$/, '')] = 'data:image/webp;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const concepts = fs.readdirSync(path.join(here, 'src/concepts')).filter((f) => f.endsWith('.js')).sort().map((f) => read('src/concepts/' + f)).join('\n');
const js = [
  'const BEFORE=' + JSON.stringify(before) + ';',
  read('src/data.js'), read('src/lib.js'), concepts,
  read('src/audit.js'), read('src/matrix.js'), read('src/shell.js')
].join('\n');
const html = `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SUB-20 Concept Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${FONTS}&display=swap" rel="stylesheet">
<style>${read('src/shell.css')}</style></head>
<body><div id="app"></div><script>${js}</script></body></html>`;
const frag = `<title>SUB-20 Concept Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${FONTS}&display=swap" rel="stylesheet">
<style>${read('src/shell.css')}</style>
<div id="app"></div><script>${js}</script>`;
fs.writeFileSync(path.join(here, '..', 'concept-lab.artifact.html'), frag);
const out = path.join(here, '..', 'concept-lab.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
