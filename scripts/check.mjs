import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('extension/manifest.json', root)));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 necessário.');
const referenced = [
  manifest.background.service_worker, manifest.options_page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap(entry => entry.js)
];
for (const name of referenced) {
  if (!fs.existsSync(new URL('extension/' + name, root))) throw new Error('Arquivo ausente: ' + name);
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|mjs)$/.test(file)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
}
walk(fileURLToPath(new URL('extension/', root)));
const html = fs.readFileSync(new URL('extension/dashboard.html', root), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
  if (!fs.existsSync(new URL('extension/' + match[1], root))) throw new Error('Recurso ausente: ' + match[1]);
}
console.log('Manifest, recursos locais e sintaxe JavaScript verificados.');
