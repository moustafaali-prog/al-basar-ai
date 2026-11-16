import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/pwa-icon.svg', 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:512px;height:512px}</style>${svg}`);
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.evaluate((s) => {
    const el = document.querySelector('svg');
    el.style.width = `${s}px`;
    el.style.height = `${s}px`;
  }, size);
  await page.screenshot({ path: `public/icon-${size}.png`, omitBackground: true });
}
await browser.close();
console.log('icons generated');
