import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'public/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ar-IQ',
});
const page = await context.newPage();

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#child-id', { timeout: 15000 });

// Clean Step 1 (mobile viewport)
await page.screenshot({ path: `${OUT}/step1-registration.png`, fullPage: false });

// Admin drawer: calibration
await page.getByRole('button', { name: /لوحة المشرف والبيانات/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/admin-calibration.png`, fullPage: false });
await page.getByRole('button', { name: 'إغلاق' }).click();
await page.waitForTimeout(300);

// Fill fixed school/examiner data.
await page.locator('summary').filter({ hasText: 'بيانات المدرسة والفاحص الثابتة' }).click();
await page.getByPlaceholder('مدرسة...').fill('مدرسة بابل الابتدائية');
await page.locator('.field').filter({ hasText: 'قطاع المدرسة' }).locator('select').selectOption('حكومي حضري');
await page.getByPlaceholder('NURSE-01').fill('NURSE-01');
await page.getByPlaceholder('مركز صحي...').fill('مركز بابل الصحي');

// Student identity.
await page.locator('#child-id').fill('BAB-2025-001');
await page.locator('button').filter({ hasText: /^الأول/ }).first().click();
const registration = page.locator('section').filter({ hasText: 'تسجيل سريع' });
await registration.getByRole('button', { name: 'ذكر', exact: true }).click();
await registration.getByRole('button', { name: 'لا', exact: true }).click();
await registration.getByRole('button', { name: 'موجودة وموقعة', exact: true }).click();
await page.waitForTimeout(250);

// WHO pre-screen expanded.
const mainPreScreen = page.locator('.prescreen-row').first();
await mainPreScreen.getByRole('button', { name: 'نعم', exact: true }).click();
await page.waitForTimeout(350);
await page.evaluate(() => {
  const row = document.querySelector('.prescreen-row');
  if (!row) return;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY - 90);
});
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/step1-prescreen.png`, fullPage: false });
await mainPreScreen.getByRole('button', { name: /لا \(سليم\)/ }).click();
await page.waitForTimeout(250);

// Paper station (paper-first sequence): start timer and record both eyes.
await page.getByRole('button', { name: /بدء المؤقت/ }).first().click();
await page.waitForTimeout(350);
const paperOd = page.locator('.field').filter({ hasText: 'العين اليمنى · OD' }).locator('select');
const paperOs = page.locator('.field').filter({ hasText: 'العين اليسرى · OS' }).locator('select');
await paperOd.selectOption('6/6');
await paperOs.selectOption('6/6');
await page.waitForTimeout(300);
await page.getByText('فحص الورقي المقارن (6m)').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/step1-paper.png`, fullPage: false });

// Continue to Step 2.
await page.getByRole('button', { name: /متابعة إلى فحص البصر/ }).click();
await page.waitForSelector('.who-eyes-step2', { timeout: 15000 });
await page.waitForTimeout(700);
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/step2-acuity.png`, fullPage: false });

// Complete HOTV for both eyes by matching the displayed letter twice per level.
let safety = 0;
while (safety++ < 48) {
  const done = await page.getByText('اكتمل فحص العينين').count();
  if (done) break;
  const letterEl = page.locator('.hotv-letter');
  if ((await letterEl.count()) === 0) {
    await page.waitForTimeout(200);
    continue;
  }
  let letter = '';
  try {
    letter = (await letterEl.first().innerText()).trim();
  } catch {
    await page.waitForTimeout(200);
    continue;
  }
  if (!letter) {
    await page.waitForTimeout(200);
    continue;
  }
  const answer = page.locator('footer button').filter({ hasText: new RegExp(`^${letter}$`) }).first();
  if (await answer.count()) {
    await answer.click();
    await page.waitForTimeout(300);
  } else {
    await page.waitForTimeout(200);
  }
}

await page.waitForTimeout(800);
if (!(await page.getByText('اكتمل فحص العينين').count())) {
  throw new Error('Acuity did not complete');
}
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/step2-completed.png`, fullPage: false });

await page.getByRole('button', { name: /الانتقال إلى فحص العين/ }).first().click();
await page.waitForTimeout(5000);
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/step3-biometry.png`, fullPage: false });

// Complete biometry: external eye gate, manual measurements, both confirmations.
await page.getByRole('button', { name: /نعم \(سليم\)/ }).first().click();
const advancedSummary = page.locator('summary').filter({ hasText: /تعديل يدوي للمختص/ }).first();
if (await advancedSummary.count()) await advancedSummary.click();
await page.waitForTimeout(300);
const confirms = page.locator('label.confirm-check input[type="checkbox"]');
for (let i = 0; i < await confirms.count(); i++) {
  await confirms.nth(i).check({ force: true }).catch(() => {});
}
await page.waitForTimeout(400);
await page.getByRole('button', { name: /عرض النتيجة والحفظ/ }).first().click();
await page.waitForTimeout(900);
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/step4-result.png`, fullPage: false });

// Scroll to the parent card / blackboard section.
const blackboard = page.locator('text=محاكاة السبورة').first();
if (await blackboard.count()) {
  await blackboard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/step4-blackboard.png`, fullPage: false });
}

// Save the record.
await page.getByRole('button', { name: /حفظ والانتقال للتلميذ التالي/ }).click();
await page.waitForTimeout(1200);
const savedCount = await page.evaluate(() => JSON.parse(localStorage.getItem('albasar_master_records_v3') || '[]').length);
if (savedCount !== 1) {
  await page.screenshot({ path: `${OUT}/debug-save-failed.png`, fullPage: false });
  throw new Error(`Record not saved. count=${savedCount}`);
}

// Admin records screenshot.
await page.getByRole('button', { name: /لوحة المشرف والبيانات/ }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'السجلات والإحصاء' }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/admin-records.png`, fullPage: false });

// Admin methodology screenshot.
await page.getByRole('button', { name: 'المنهجية والدليل' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/admin-methodology.png`, fullPage: false });

await browser.close();

// Second context: grade 5 Tumbling E screen.
const browser2 = await chromium.launch({ headless: true });
const context2 = await browser2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-IQ' });
const page2 = await context2.newPage();
await page2.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page2.evaluate(() => localStorage.clear());
await page2.reload({ waitUntil: 'networkidle' });
await page2.waitForSelector('#child-id');
await page2.locator('summary').filter({ hasText: 'بيانات المدرسة والفاحص الثابتة' }).click();
await page2.getByPlaceholder('مدرسة...').fill('مدرسة بابل الابتدائية');
await page2.locator('.field').filter({ hasText: 'قطاع المدرسة' }).locator('select').selectOption('حكومي حضري');
await page2.getByPlaceholder('NURSE-01').fill('NURSE-01');
await page2.locator('#child-id').fill('BAB-2025-002');
await page2.locator('button').filter({ hasText: /^الخامس/ }).first().click();
const reg2 = page2.locator('section').filter({ hasText: 'تسجيل سريع' });
await reg2.getByRole('button', { name: 'أنثى', exact: true }).click();
await reg2.getByRole('button', { name: 'لا', exact: true }).click();
await reg2.getByRole('button', { name: 'موجودة وموقعة', exact: true }).click();
await page2.getByRole('button', { name: /بدء المؤقت/ }).first().click();
await page2.waitForTimeout(250);
await page2.locator('.field').filter({ hasText: 'العين اليمنى · OD' }).locator('select').selectOption('6/12');
await page2.locator('.field').filter({ hasText: 'العين اليسرى · OS' }).locator('select').selectOption('6/9.5');
await page2.getByRole('button', { name: /متابعة إلى فحص البصر/ }).click();
await page2.waitForSelector('.who-eyes-step2');
await page2.waitForTimeout(800);
await page2.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
await page2.waitForTimeout(300);
await page2.screenshot({ path: `${OUT}/step2-tumbling-e.png`, fullPage: false });
await browser2.close();

console.log('screenshots captured; saved records =', savedCount);
