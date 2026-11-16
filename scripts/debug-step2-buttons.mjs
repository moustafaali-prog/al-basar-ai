import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-IQ' });
const page = await context.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#child-id');
await page.locator('#child-id').fill('BAB-2025-001');
await page.locator('button').filter({ hasText: /^الأول/ }).first().click();
await page.waitForTimeout(300);
const paperStart = page.getByRole('button', { name: /بدء المؤقت/ }).first();
await paperStart.click();
await page.waitForTimeout(300);
const selects = page.locator('select');
await selects.nth(0).selectOption('6/6');
await selects.nth(1).selectOption('6/6');
await page.getByRole('button', { name: /متابعة إلى فحص البصر/ }).click();
await page.waitForSelector('.who-eyes-step2');
await page.waitForTimeout(800);

const buttons = page.locator('footer button');
console.log('button count', await buttons.count());
for (let i = 0; i < await buttons.count(); i++) {
  const b = buttons.nth(i);
  console.log(i, JSON.stringify(await b.innerText()), await b.evaluate(el => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor, fontSize: s.fontSize, visibility: s.visibility, opacity: s.opacity };
  }));
}
await browser.close();
