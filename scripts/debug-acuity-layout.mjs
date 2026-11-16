import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('summary').filter({ hasText: 'بيانات المدرسة والفاحص الثابتة' }).click();
await page.getByPlaceholder('مدرسة...').fill('مدرسة بابل الابتدائية');
await page.locator('.field').filter({ hasText: 'قطاع المدرسة' }).locator('select').selectOption('حكومي حضري');
await page.getByPlaceholder('NURSE-01').fill('NURSE-01');
await page.locator('#child-id').fill('BAB-2025-001');
await page.locator('button').filter({ hasText: /^الأول/ }).first().click();
const reg = page.locator('section').filter({ hasText: 'تسجيل سريع' });
await reg.getByRole('button', { name: 'ذكر', exact: true }).click();
await reg.getByRole('button', { name: 'لا', exact: true }).click();
await reg.getByRole('button', { name: 'موجودة وموقعة', exact: true }).click();
await page.getByRole('button', { name: /بدء المؤقت/ }).first().click();
await page.locator('.field').filter({ hasText: 'العين اليمنى · OD' }).locator('select').selectOption('6/6');
await page.locator('.field').filter({ hasText: 'العين اليسرى · OS' }).locator('select').selectOption('6/6');
await page.getByRole('button', { name: /متابعة إلى فحص البصر/ }).click();
await page.waitForSelector('.who-eyes-step2');
await page.waitForTimeout(500);
const boxes = await page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  };
  return {
    viewport: { h: innerHeight, scrollY },
    station: box('.who-eyes-step2'),
    stage: box('.optotype-stage'),
    footer: box('.who-eyes-step2 footer'),
    mobileBar: box('.mobile-step-actions'),
    bodyScrollHeight: document.documentElement.scrollHeight,
    footerButtons: [...document.querySelectorAll('.who-eyes-step2 footer button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { text: b.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom) };
    }),
  };
});
console.log(JSON.stringify(boxes, null, 2));
await browser.close();
