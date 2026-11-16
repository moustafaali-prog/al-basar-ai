import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(resolve('public/guide.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(600);

const checks = await page.evaluate(() => ({
  title: document.title,
  images: [...document.images].map((img) => ({ alt: img.alt, complete: img.complete, w: img.naturalWidth })),
  unresolved: document.body.innerHTML.includes('{{IMG:'),
  h1: document.querySelector('h1')?.textContent?.trim(),
  sections: [...document.querySelectorAll('section[id]')].map((s) => s.id),
  downloadLinks: [...document.querySelectorAll('#download a')].map((a) => a.getAttribute('href')),
}));
console.log(JSON.stringify(checks, null, 2));
console.log('errors:', errors);

await page.screenshot({ path: 'public/screenshots/guide-top.png', fullPage: false });
await page.locator('#step-1').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/screenshots/guide-step1.png', fullPage: false });
await page.locator('#scenario-4').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/screenshots/guide-scenarios.png', fullPage: false });
await page.locator('#download').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/screenshots/guide-download.png', fullPage: false });
await browser.close();
