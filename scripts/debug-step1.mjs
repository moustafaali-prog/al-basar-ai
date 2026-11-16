import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-IQ' });
const page = await context.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#child-id');

await page.locator('#child-id').fill('BAB-2025-001');
const gradeBtn = page.locator('button').filter({ hasText: /^الأول/ }).first();
await gradeBtn.click();
await page.waitForTimeout(500);

const timerBtn = page.getByRole('button', { name: /بدء المؤقت/ }).first();
console.log('timer count', await timerBtn.count());
console.log('timer disabled', await timerBtn.isDisabled().catch(e => 'err ' + e.message));
await timerBtn.click();
await page.waitForTimeout(700);
const selects = page.locator('select');
console.log('select count', await selects.count());
console.log('select0 disabled after click', await selects.nth(0).isDisabled().catch(e => 'err ' + e.message));
console.log('body snippet', (await page.locator('body').innerText()).slice(0, 1500));

await browser.close();
