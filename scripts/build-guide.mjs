import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const templatePath = resolve('guide.template.html');
const outPath = resolve('public/guide.html');
const template = readFileSync(templatePath, 'utf8');

const placeholders = [...template.matchAll(/\{\{IMG:([^}]+)\}\}/g)].map((m) => m[1]);
const unique = [...new Set(placeholders)];
const missing = unique.filter((name) => !existsSync(resolve('public/screenshots', name)));
if (missing.length) {
  throw new Error(`Missing screenshots: ${missing.join(', ')}`);
}

let html = template;
for (const name of unique) {
  const file = resolve('public/screenshots', name);
  const base64 = readFileSync(file).toString('base64');
  html = html.split(`{{IMG:${name}}}`).join(`data:image/png;base64,${base64}`);
}

if (/\{\{IMG:/.test(html)) {
  throw new Error('Unresolved image placeholder remains.');
}

writeFileSync(outPath, html, 'utf8');
const kb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`guide written: ${outPath} (${kb} KB, ${unique.length} embedded screenshots)`);
