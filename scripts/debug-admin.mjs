import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-IQ' });
const page = await context.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#child-id');

const btn = page.getByRole('button', { name: /لوحة المشرف والبيانات/ }).first();
console.log('admin button count', await btn.count());
console.log('admin disabled', await btn.isDisabled());
await btn.click();
await page.waitForTimeout(1000);
const txt = await page.locator('body').innerText();
console.log('has calibration text:', txt.includes('ضبط حجم الرموز'));
console.log('has drawer close:', txt.includes('إغلاق'));
await page.screenshot({ path: 'public/screenshots/admin-calibration-debug.png', fullPage: false });
console.log(txt.slice(0, 2000));
await browser.close();
