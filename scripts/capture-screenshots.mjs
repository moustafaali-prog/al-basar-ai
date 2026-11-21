import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('public/screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
mkdirSync(OUT, { recursive: true });

const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

async function openApp(browser, { clearStorage = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ar-IQ',
    permissions: ['camera'],
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  if (clearStorage) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
  }
  return { context, page };
}

async function capture(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`captured ${name}.png`);
}

async function continueLocally(page) {
  const skip = page.getByRole('button', { name: 'المتابعة محلياً بدون حساب' });
  await skip.waitFor({ state: 'visible', timeout: 15_000 });
  await skip.click();
  await page.waitForTimeout(250);
}

async function scrollTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollBy(0, -90);
  });
  await page.waitForTimeout(200);
}

async function fillSession(page, { childId, grade }) {
  const summary = page.locator('.session-bar__summary');
  if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
  await page.getByPlaceholder('مدرسة...').fill('مدرسة بابل الابتدائية');
  await page
    .locator('.session-bar__panel .field')
    .filter({ hasText: 'قطاع المدرسة' })
    .locator('select')
    .selectOption('حكومي حضري');
  await page.getByPlaceholder('NURSE-01').fill('NURSE-01');
  await page
    .locator('.session-bar__panel .field')
    .filter({ hasText: 'فاحص المحطة الورقية' })
    .locator('input')
    .fill('NURSE-01');
  await page.getByPlaceholder('مركز صحي...').fill('مركز بابل الصحي');
  await summary.click();
  await page.waitForTimeout(200);

  await page.locator('#child-id').fill(childId);
  await page.getByRole('button', { name: new RegExp(`^الصف ${grade}\\b`) }).first().click();
  await page.getByRole('button', { name: /ذكر/ }).first().click();
  await page.getByRole('button', { name: 'بدون نظارة UVA', exact: true }).click();
  await page.getByRole('button', { name: 'موجودة وموقعة', exact: false }).click();
}

async function completeHotv(page) {
  let safety = 0;
  while (safety++ < 80) {
    if (await page.getByText('اكتمل فحص العينين', { exact: true }).count()) return;
    const letterElement = page.locator('.hotv-letter').first();
    if ((await letterElement.count()) === 0) {
      await wait(100);
      continue;
    }
    const letter = (await letterElement.innerText()).trim();
    if (!letter) {
      await wait(100);
      continue;
    }
    const answer = page.locator('.acuity-response-btn').filter({ hasText: new RegExp(`^${letter}$`) }).first();
    if (await answer.count()) {
      await answer.click();
      await wait(180);
    } else {
      await wait(100);
    }
  }
  throw new Error('HOTV examination did not complete.');
}

async function captureMainFlow(browser) {
  const { context, page } = await openApp(browser);

  // The current authentication gate is also the real cloud-sync evidence.
  await page.getByRole('button', { name: 'المتابعة محلياً بدون حساب' }).waitFor({ state: 'visible' });
  await capture(page, 'cloud-login');
  await continueLocally(page);

  // Examiner calibration panel (the drawer label is role-aware).
  await page.getByRole('button', { name: 'أدوات الفاحص' }).click();
  await page.getByRole('button', { name: '📏 معايرة الشاشة' }).click();
  await page.waitForTimeout(250);
  await capture(page, 'admin-calibration');
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  await page.waitForTimeout(200);

  await fillSession(page, { childId: 'BAB-A4F-101', grade: 1 });
  await scrollTo(page, page.getByText('تسجيل سريع', { exact: true }).first());
  await capture(page, 'step1-registration');

  // Expanded WHO pre-screen questions.
  await page.getByRole('button', { name: 'تعديل الأسئلة الفردية', exact: true }).click();
  await scrollTo(page, page.locator('.prescreen-list'));
  await capture(page, 'step1-prescreen');

  // Fast healthy pre-screen fills consent, assent, and all negative answers.
  await page.getByRole('button', { name: /فحص قبلي سليم/ }).click();
  await page.waitForTimeout(200);

  // Paper station: the first acuity choice starts the timer automatically.
  const paperOd = page.locator('.paper-eye').filter({ hasText: 'العين اليمنى · OD' });
  const paperOs = page.locator('.paper-eye').filter({ hasText: 'العين اليسرى · OS' });
  await paperOd.getByRole('button', { name: '6/6', exact: true }).click();
  await paperOs.getByRole('button', { name: '6/6', exact: true }).click();
  await scrollTo(page, page.getByText('فحص الورقي المقارن (6m)', { exact: true }));
  await capture(page, 'step1-paper');

  await page.getByRole('button', { name: /متابعة إلى فحص البصر/ }).click();
  await page.locator('.acuity-start-card').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: 'ابدأ الآن', exact: true }).click();
  await page.locator('.hotv-letter').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(250);
  await capture(page, 'step2-acuity');

  // Capture the real 88 control in its active-station context.
  await scrollTo(page, page.locator('.acuity-88-btn'));
  await capture(page, 'step2-code88');

  await completeHotv(page);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, 'step2-completed');

  await page.getByRole('button', { name: /الانتقال إلى فحص العين/ }).click();
  await page.locator('.capture-stage').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, 'step3-biometry');

  // External findings: open the exact five-item list without selecting a finding.
  const externalToggle = page.getByRole('button', { name: 'إضافة ملاحظة للفحص الخارجي غير الطبيعي' });
  await scrollTo(page, externalToggle);
  await externalToggle.click();
  await page.waitForTimeout(200);
  await scrollTo(page, page.locator('.external-gate-chips'));
  await capture(page, 'step3-external');

  // Asthenopia: the exact five symptoms and their current score.
  const symptomsHeading = page.getByText('أعراض الإجهاد البصري', { exact: true });
  await scrollTo(page, symptomsHeading);
  await capture(page, 'step3-symptoms');

  // Complete the ocular station with the built-in measured normal preset and
  // the explicit healthy-external-eye confirmation.
  await page.locator('.clinical-preset').filter({ hasText: 'طبيعي مبدئياً' }).click();
  await page.locator('.external-gate-pass').click();
  await page.getByRole('button', { name: /المتابعة إلى التحليل السريري/ }).click();
  await page.locator('.result-stage').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, 'step4-result');

  await scrollTo(page, page.getByText('محاكاة ما يراه الطفل', { exact: true }));
  await capture(page, 'step4-blackboard');

  // Save the completed record to verify the full clinical path still commits.
  await page.getByRole('button', { name: /حفظ السجل والانتقال للتلميذ التالي/ }).click();
  await page.waitForTimeout(700);
  const savedCount = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('albasar_master_records_v3') || '[]').length,
  );
  if (savedCount !== 1) throw new Error(`Record was not saved. count=${savedCount}`);

  await context.close();
  return savedCount;
}

async function captureTumblingE(browser) {
  const { context, page } = await openApp(browser);
  await continueLocally(page);
  await fillSession(page, { childId: 'BAB-A4F-102', grade: 5 });
  await page.getByRole('button', { name: /أنثى/ }).first().click();
  await page.getByRole('button', { name: /متابعة إلى فحص البصر/ }).click();
  await page.locator('.acuity-start-card').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: 'ابدأ الآن', exact: true }).click();
  await page.locator('.optotype-stage').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(250);
  await capture(page, 'step2-tumbling-e');
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  const savedCount = await captureMainFlow(browser);
  await captureTumblingE(browser);
  console.log(`screenshots captured; saved records = ${savedCount}`);
} finally {
  await browser.close();
}
