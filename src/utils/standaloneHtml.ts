/**
 * Legacy documentation generator retained for backward compatibility only.
 * The standalone `AlBasar_Babylon_Production_v3.html` build artifact was removed
 * from the repository root; the maintained application is the React 19 app in `src/`.
 * The export is kept so any existing imports continue to resolve without breaking.
 */
export function getStandaloneHTMLContent(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>منظومة البصر | Al-Basar — تسجيل فحص البصر المدرسي</title>
<style>
  :root {
    --primary: #0e7490;
    --primary-dark: #12334d;
    --primary-light: #e7f4f7;
    --success: #167a64;
    --warning: #a65e0a;
    --danger: #b42318;
    --surface: #ffffff;
    --bg: #f3f6fa;
    --border: #d8e2ec;
    --text: #17263d;
    --text-muted: #5c6e82;
    --radius: 13px;
  }
  * { box-sizing: border-box; font-family: "Noto Sans Arabic", system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; }
  body { margin: 0; background: radial-gradient(ellipse at 92% -12%, rgba(14,116,144,.09), transparent 34rem), var(--bg); color: var(--text); line-height: 1.65; font-size: 14px; }
  button, input, select, textarea { font: inherit; }
  button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid rgba(8,145,178,.5); outline-offset: 2px; }
  header {
    background: linear-gradient(112deg, #102b46, #123c57 56%, #075c6d);
    color: #fff; padding: 16px clamp(12px, 3vw, 30px); display: flex; justify-content: space-between; align-items: center; gap: 12px;
    box-shadow: 0 10px 30px rgba(12,35,58,.16); position: sticky; top: 0; z-index: 100;
  }
  header h1 { margin: 0; font-size: 1.05rem; font-weight: 700; }
  header .sub { font-size: 0.72rem; opacity: 0.9; }
  .badge { background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; }
  
  .nav-bar {
    display: flex; overflow-x: auto; background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 8px clamp(8px, 2vw, 20px); gap: 6px; position: sticky; top: 65px; z-index: 90;
  }
  .nav-btn {
    padding: 10px 14px; border: 1px solid transparent; background: transparent; color: var(--text-muted);
    border-radius: var(--radius); font-weight: 700; font-size: 0.78rem; white-space: nowrap; cursor: pointer; min-height: 42px;
  }
  .nav-btn.active { background: var(--primary-light); color: var(--primary); border-color: #bbdefb; }
  
  .container { max-width: 1380px; margin: 20px auto; padding: 0 clamp(12px, 3vw, 28px) 60px; }
  .tab-pane { display: none; }
  .tab-pane.active { display: block; animation: fadeIn 0.2s ease-in; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }

  .card {
    background: rgba(255,255,255,.94); border: 1px solid var(--border); border-radius: 16px; padding: clamp(14px, 2vw, 24px);
    margin-bottom: 16px; box-shadow: 0 12px 30px rgba(15,35,63,.055);
  }
  .card-title {
    font-size: 0.95rem; font-weight: 700; color: var(--primary-dark); margin: 0 0 10px;
    border-bottom: 2px solid #eef2f6; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;
  }
  .alert-box {
    padding: 10px 14px; border-radius: var(--radius); font-size: 0.8rem; margin-bottom: 12px;
    display: flex; gap: 8px; align-items: flex-start;
  }
  .alert-warning { background: #fff4e5; border: 1px solid #ffe0b2; color: #b76e00; }
  .alert-info { background: #e8f4fd; border: 1px solid #b3e5fc; color: #0277bd; }

  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
  .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }

  .form-group { margin-bottom: 10px; }
  .form-group label { display: block; font-size: 0.76rem; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
  .form-control {
    width: 100%; min-height: 44px; padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 0.86rem;
    color: var(--text); background: #fff;
  }
  .form-control:focus { outline: none; border-color: var(--primary); }

  .btn {
    padding: 9px 14px; min-height: 42px; border-radius: 10px; font-weight: 700; font-size: 0.82rem; border: none;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-outline { background: #fff; border: 1px solid var(--border); color: var(--text); }
  .btn-success { background: var(--success); color: #fff; }
  .btn-danger { background: var(--danger); color: #fff; }

  .optotype-stage {
    background: #ffffff; border: 2px solid #37474f; border-radius: 10px; min-height: 240px;
    display: flex; align-items: center; justify-content: center; margin: 12px 0; position: relative;
  }
  .keypad {
    display: grid; grid-template-columns: repeat(3, 76px); gap: 10px; justify-content: center; margin: 10px auto; direction: ltr;
  }
  .keypad-btn {
    height: 54px; font-size: 1.4rem; font-weight: bold; background: var(--primary); color: #fff;
    border: none; border-radius: 8px; cursor: pointer;
  }
  .keypad-btn:active { transform: scale(0.95); }

  .kpi-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;
  }
  .kpi-card .val { font-size: 1.15rem; font-weight: 700; color: var(--primary-dark); }
  .kpi-card .lbl { font-size: 0.7rem; color: var(--text-muted); }

  table { width: 100%; border-collapse: collapse; font-size: 0.76rem; }
  th, td { border: 1px solid var(--border); padding: 6px 8px; text-align: center; }
  th { background: #eceff1; font-weight: 700; }
  .tag-ok { background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
  .tag-ref { background: #ffebee; color: #c62828; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
  canvas { max-width: 100%; border: 1px solid var(--border); border-radius: 12px; background: #000; }
  .app-toast { position: fixed; z-index: 300; inset-inline-start: 16px; bottom: 16px; width: min(420px, calc(100vw - 32px)); padding: 14px 16px; border: 1px solid #b9dce5; border-radius: 14px; background: #fff; color: #155e75; box-shadow: 0 18px 50px rgba(15,35,63,.18); font-weight: 700; }
  .app-toast.error { border-color: #f2b8b8; color: #9b2c2c; }
  .app-toast.success { border-color: #a7d9c1; color: #176044; }
  .confirm-backdrop { position: fixed; z-index: 310; inset: 0; display: none; place-items: center; padding: 16px; background: rgba(8,20,36,.56); backdrop-filter: blur(5px); }
  .confirm-backdrop.open { display: grid; }
  .confirm-dialog { width: min(440px, 100%); padding: 22px; border: 1px solid var(--border); border-radius: 18px; background: white; box-shadow: 0 24px 70px rgba(8,20,36,.28); }
  .confirm-dialog h2 { margin: 0 0 8px; color: var(--primary-dark); font-size: 1.1rem; }
  .confirm-dialog p { margin: 0 0 18px; color: var(--text-muted); }
  .confirm-actions { display:flex; justify-content:flex-end; gap:8px; }
  .confirm-actions button { min-height: 42px; }
  .scan-text-backdrop { position: fixed; z-index: 320; inset: 0; display: none; place-items: center; padding: 16px; background: rgba(8,20,36,.56); backdrop-filter: blur(5px); }
  .scan-text-backdrop.open { display: grid; }
  .scan-text-dialog { width: min(540px, 100%); padding: 22px; border: 1px solid var(--border); border-radius: 18px; background: white; box-shadow: 0 24px 70px rgba(8,20,36,.28); }
  @media (max-width: 700px) { header { position: relative; align-items: flex-start; flex-direction: column; } .nav-bar { position: sticky; top: 0; } .container { margin-top: 12px; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }
</style>
</head>
<body>
<div id="app-toast" class="app-toast" role="status" aria-live="polite" hidden></div>
<div id="confirm-backdrop" class="confirm-backdrop" aria-hidden="true">
  <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
    <h2 id="confirm-title"></h2><p id="confirm-message"></p>
    <div class="confirm-actions"><button class="btn btn-outline" id="confirm-cancel">إلغاء</button><button class="btn btn-danger" id="confirm-accept">تأكيد</button></div>
  </section>
</div>
<div id="scan-text-backdrop" class="scan-text-backdrop" aria-hidden="true">
  <section class="scan-text-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-text-title" aria-describedby="scan-text-help">
    <h2 id="scan-text-title">إدخال محتوى رمز QR</h2>
    <p id="scan-text-help">الصق النص أو JSON أو الرابط المقروء من الرمز، ثم راجع الحقول قبل حفظها.</p>
    <textarea id="scan-text-input" class="form-control" rows="4" aria-label="محتوى رمز QR" placeholder="الصق النص هنا"></textarea>
    <div class="confirm-actions" style="margin-top:14px;"><button class="btn btn-outline" id="scan-text-cancel">إلغاء</button><button class="btn btn-primary" id="scan-text-apply">إدخال البيانات</button></div>
  </section>
</div>

<header>
  <div>
    <h1>منظومة البصر | Al-Basar</h1>
    <div class="sub">تسجيل نتائج الفحص الأولي للبصر المدرسي وإدارة بيانات المشروع</div>
  </div>
  <div class="badge" id="calib-header-badge">مرجع العرض: 3.78 px/mm (قيمة أولية)</div>
</header>

<div class="nav-bar">
  <button class="nav-btn active" data-tab="tab-calib" onclick="switchTab('tab-calib', this)">1. المعايرة الفيزيائية</button>
  <button class="nav-btn" data-tab="tab-reg" onclick="switchTab('tab-reg', this)">2. بيانات التلميذ والمحطة الورقية (6m)</button>
  <button class="nav-btn" data-tab="tab-acuity" onclick="switchTab('tab-acuity', this)">3. الفرز التكيفي الرقمي (2m)</button>
  <button class="nav-btn" data-tab="tab-triage" onclick="switchTab('tab-triage', this)">4. الرؤية الرقمية لتناظر المنعكس القرني</button>
  <button class="nav-btn" data-tab="tab-sim" onclick="switchTab('tab-sim', this)">5. ملخص النتائج والسجل المحلي</button>
  <button class="nav-btn" data-tab="tab-sus" onclick="switchTab('tab-sus', this)">6. استبيان SUS للممرضين</button>
</div>

<div class="container">

  <!-- 1. ضبط حجم الرمز على الشاشة -->
  <div id="tab-calib" class="tab-pane active">
    <div class="card">
      <div class="card-title">
        <span>ضبط حجم الرموز على الشاشة</span>
        <span class="badge" style="background:#e8f5e9; color:#2e7d32;">مسافة الفحص: 2.0 متر</span>
      </div>

      <div class="alert-box alert-warning">
        <span>⚠️</span>
        <div><strong>تحقق من حجم العرض على الجهاز المستخدم:</strong> القيمة الافتراضية تقديرية. ضع المرجع المادي المحدد أمام الشاشة واضبط العرض حتى يطابق طوله الفعلي. أعد التحقق عند تغيير الجهاز أو إعدادات العرض.</div>
      </div>

      <div style="text-align: center; margin: 16px 0;">
        <div id="physical-box" style="height: 40px; width: 324px; background: var(--primary); border-radius: 6px; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 0.85rem;">
          البطاقة الوطنية / المصرفية (85.60 mm)
        </div>
      </div>

      <div class="grid-2" style="max-width: 600px; margin: 0 auto;">
        <div class="form-group">
          <label>طول المرجع المادي المستخدم:</label>
          <select id="sel-calib-ref" class="form-control" onchange="changeCalibRef(this.value)">
            <option value="85.60">بطاقة بالمقاس ID-1 (85.60 mm)</option>
            <option value="50.00">مسطرة هندسية مليمترية (50.00 mm)</option>
          </select>
        </div>
        <div class="form-group">
          <label>العرض بالبكسل على الشاشة (<span id="lbl-px-val">324</span> px = <span id="lbl-ppm-val">3.78</span> px/mm):</label>
          <input type="range" id="rng-px" class="form-control" min="150" max="600" value="324" oninput="adjustCalibration(this.value)">
        </div>
      </div>

      <div class="grid-4" style="margin-top: 14px;">
        <div class="kpi-card"><div class="val" id="disp-h-66">2.91 mm</div><div class="lbl">ارتفاع 6/6 (LogMAR 0.0)</div></div>
        <div class="kpi-card"><div class="val" id="disp-h-69">4.61 mm</div><div class="lbl">ارتفاع 6/9.5 (عتبة الفرز)</div></div>
        <div class="kpi-card"><div class="val" id="disp-h-618">9.20 mm</div><div class="lbl">ارتفاع 6/18 (ضعف متوسط)</div></div>
          <div class="kpi-card"><div class="val" id="disp-dpi">96 DPI</div><div class="lbl">مكافئ DPI الحسابي</div></div>
      </div>
    </div>
  </div>

  <!-- 2. محطة التسجيل والمحطة الورقية المعماة 6m -->
  <div id="tab-reg" class="tab-pane">
    <div class="card">
      <div class="card-title">
        <span>المحطة (1): تسجيل التلميذ والتوثيق الأخلاقي والسريري</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" id="btn-qr-open" style="font-size:0.75rem; background:#059669;" onclick="openStandaloneQRScanner()">إدخال بيانات رمز QR</button>
          <button class="btn btn-outline" id="btn-new-id" onclick="generateNextID()">كود جديد</button>
        </div>
      </div>

      <div class="grid-3">
        <div class="form-group">
          <label>معرف المشارك (Child_ID) *</label>
          <input type="text" id="std-id" class="form-control" placeholder="BAB-..." maxlength="64" autocomplete="off">
        </div>
        <div class="form-group">
          <label>رمز مسجل السجل (Examiner_ID) *</label>
          <input type="text" id="std-examiner" class="form-control" placeholder="NURSE-01">
        </div>
        <div class="form-group">
          <label>الموافقة الخطية لولي الأمر (Consent) *</label>
          <select id="std-consent" class="form-control" style="font-weight:bold; color:var(--primary-dark);">
            <option value="0" selected>0 - غير متوفرة (يُحظر إجراء الفحص)</option>
            <option value="1">1 - متوفرة وموقعة خطياً (صالح للفحص)</option>
          </select>
        </div>
        <div class="form-group">
          <label>المدرسة والقطاع</label>
          <input type="text" id="std-school" class="form-control" placeholder="اسم المدرسة">
        </div>
        <div class="form-group">
          <label>قطاع المدرسة</label>
          <select id="std-sector" class="form-control"><option value="">اختر القطاع</option><option value="حكومي حضري">حكومي حضري</option><option value="حكومي ريفي">حكومي ريفي</option><option value="أهلي">أهلي</option></select>
        </div>
        <div class="form-group">
          <label>الصف والعمر والجنس</label>
          <div style="display:flex; gap:6px;">
            <select id="std-grade" class="form-control"><option value="">اختر الصف</option><option value="1">الأول</option><option value="2">الثاني</option><option value="3">الثالث</option><option value="4">الرابع</option><option value="5">الخامس</option><option value="6">السادس</option></select>
            <input type="number" id="std-age" class="form-control" min="5" max="14" placeholder="العمر" style="max-width:70px;">
            <select id="std-gender" class="form-control"><option value="">الجنس</option><option value="ذكر">ذكر</option><option value="أنثى">أنثى</option></select>
          </div>
        </div>
        <div class="form-group">
          <label>ارتداء نظارة طبية</label>
          <select id="std-glasses" class="form-control"><option value="">اختر</option><option value="0">لا</option><option value="1">نعم</option></select>
        </div>
        <div class="form-group">
          <label>تسلسل المحطتين وفق قائمة التوزيع المعتمدة *</label>
          <select id="std-seq" class="form-control" onchange="updateStationIsolation()"><option value="">اختر التسلسل المخصص للمشارك</option><option value="ورقي (6m) ← رقمي (2m)">ورقي (6m) ثم رقمي (2m)</option><option value="رقمي (2m) ← ورقي (6m)">رقمي (2m) ثم ورقي (6m)</option></select>
        </div>
      </div>

      <div class="alert-box alert-info" style="margin-top:10px;">
        <span>ℹ️</span>
        <div><strong>ملاحظة منهجية:</strong> الفحصان يجريان على مسافتين مختلفتين؛ سجّل نتيجة كل طريقة منفصلة والتزم بالمسافة المحددة في بروتوكولها. هذا الفرق لا يحوّل قياس حدة البصر إلى قياس انكسار.</div>
      </div>

      <div id="paper-station-content">
      <hr style="border:0; border-top:1px solid var(--border); margin:12px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <strong id="paper-seq-title">المحطة (2): نتائج الفحص الورقي (لوحة سنيلين 6 أمتار):</strong>
        <div>
          <button class="btn btn-outline" id="btn-paper-clk" onclick="togglePaperTimer()">بدء مؤقت الورقي</button>
          <span class="badge" style="background:#e2e8f0; color:#334155;" id="lbl-paper-time">الزمن: 0.0 ثانية</span>
        </div>
      </div>

      <div class="form-group" style="max-width:420px; margin-top:10px;">
        <label for="paper-examiner-id">معرف فاحص المحطة الورقية (مستقل عن مسجل المشارك) *</label>
        <input type="text" id="paper-examiner-id" class="form-control" maxlength="64" autocomplete="off" placeholder="PAPER-EXAMINER-01">
      </div>

      <div class="grid-3" style="margin-top:10px;">
        <div class="form-group">
          <label>ورقي - العين اليمنى (Paper_OD)</label>
          <select id="p-od" class="form-control">
            <option value="">اختر نتيجة العين اليمنى</option>
            <option value="6/6">6/6 (LogMAR 0.00)</option><option value="6/7.5">6/7.5 (LogMAR 0.10)</option>
            <option value="6/9.5">6/9.5 (LogMAR 0.20)</option><option value="6/12">6/12 (LogMAR 0.30)</option>
            <option value="6/18">6/18 (LogMAR 0.50)</option><option value="6/24">6/24 (LogMAR 0.60)</option>
            <option value="6/36">6/36 (LogMAR 0.80)</option><option value="6/60">6/60 (LogMAR 1.00)</option>
          </select>
        </div>
        <div class="form-group">
          <label>ورقي - العين اليسرى (Paper_OS)</label>
          <select id="p-os" class="form-control">
            <option value="">اختر نتيجة العين اليسرى</option>
            <option value="6/6">6/6 (LogMAR 0.00)</option><option value="6/7.5">6/7.5 (LogMAR 0.10)</option>
            <option value="6/9.5">6/9.5 (LogMAR 0.20)</option><option value="6/12">6/12 (LogMAR 0.30)</option>
            <option value="6/18">6/18 (LogMAR 0.50)</option><option value="6/24">6/24 (LogMAR 0.60)</option>
            <option value="6/36">6/36 (LogMAR 0.80)</option><option value="6/60">6/60 (LogMAR 1.00)</option>
          </select>
        </div>
        <div class="form-group">
          <label>المركز الصحي المحال إليه (Referral PHCC)</label>
          <input type="text" id="std-phcc" class="form-control" placeholder="المركز الصحي">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:10px;">
        <button type="button" class="btn btn-primary" id="btn-paper-proceed" onclick="proceedFromPaperStation()">اعتماد المحطة والانتقال حسب التسلسل</button>
      </div>
      </div>
    </div>
  </div>

  <!-- 3. محطة الفرز البصري التكيفي الرقمي 2m -->
  <div id="tab-acuity" class="tab-pane">
    <div class="card">
      <div class="card-title">
        <span>المحطة 3: فحص اتجاه حرف E على الشاشة (2 متر)</span>
        <span class="badge" style="background:#e0f2fe; color:#0369a1;" id="lbl-smart-time">الزمن الرقمي: 0.0 ثانية</span>
      </div>

      <div class="form-group" style="max-width:420px; margin-bottom:10px;">
        <label for="smart-examiner-id">معرف فاحص المحطة الرقمية (مستقل عن الفاحص الورقي) *</label>
        <input type="text" id="smart-examiner-id" class="form-control" maxlength="64" autocomplete="off" placeholder="DIGITAL-EXAMINER-01">
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" id="btn-start-od" onclick="initAcuityPhase('OD')">فحص العين اليمنى (OD)</button>
          <button class="btn btn-outline" id="btn-start-os" onclick="initAcuityPhase('OS')">فحص العين اليسرى (OS)</button>
          <button class="btn btn-outline" style="color:#d97706;" onclick="launchTrainingDemo()">جلسة تهيئة وتدريب (Trial)</button>
        </div>
        <div style="font-size:0.8rem;">
          <span class="tag-ok" id="lbl-active-eye">العين: جاهز</span>
          <span class="tag-ok" id="lbl-active-level">المستوى: 6/24 (0.60)</span>
        </div>
      </div>

      <div class="optotype-stage">
        <svg id="svg-e" width="70" height="70" viewBox="0 0 5 5" style="transition: transform 0.1s linear;">
          <path d="M0,0 H5 V1 H1 V2 H4 V3 H1 V4 H5 V5 H0 Z" fill="#000000"/>
        </svg>
      </div>

      <div class="keypad">
        <div></div><button class="keypad-btn" onclick="submitAcuityTrial(270)">▲</button><div></div>
        <button class="keypad-btn" onclick="submitAcuityTrial(180)">◀</button>
        <div style="display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:bold; color:var(--text-muted);">الاتجاه</div>
        <button class="keypad-btn" onclick="submitAcuityTrial(0)">▶</button>
        <div></div><button class="keypad-btn" onclick="submitAcuityTrial(90)">▼</button><div></div>
      </div>

      <div class="grid-3" style="margin-top:10px;">
        <div class="kpi-card"><div class="val" id="res-s-od">--</div><div class="lbl">فرز اليمنى (Smart OD)</div></div>
        <div class="kpi-card"><div class="val" id="res-s-os">--</div><div class="lbl">فرز اليسرى (Smart OS)</div></div>
        <div class="kpi-card"><div class="val" id="res-s-iod">--</div><div class="lbl">فرق العينين (IOD LogMAR)</div></div>
      </div>
    </div>
  </div>

  <!-- 4. محطة الرؤية الحاسوبية لتناظر المنعكس القرني -->
  <div id="tab-triage" class="tab-pane">
    <div class="card">
      <div class="card-title">
        <span>المحطة 4: قياسات صورة العين (تقديرية)</span>
        <span class="badge" style="background:#fef3c7; color:#92400e;">فرز أولي — يتطلب تأكيداً طبياً</span>
      </div>

      <div class="alert-box alert-warning">
        <span>⚠️</span>
        <div><strong>حدود القياس:</strong> تستخدم هذه النسخة مدخلات يدوية ومقياساً مرجعياً مفترضاً. تتأثر النتائج بالصورة وجودتها ووضعية الطفل؛ لا تستخدمها لتشخيص الحول أو الإطراق أو الخطأ الانكساري.</div>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
        <input type="file" accept="image/*" capture="user" onchange="processOcularPhoto(event)" style="font-size:0.8rem;">
        <button class="btn btn-outline" onclick="runSyntheticOcularCaliper()">إجراء محاكاة المعايرة الهندسية للقزحية (HVID = 11.7mm)</button>
      </div>

      <canvas id="cv-triage" width="580" height="200" style="display:block; margin:0 auto;"></canvas>

      <div class="grid-3" style="margin-top:12px;">
        <div class="form-group">
          <label>انحراف المنعكس التقريبي (Hirschberg mm)</label>
          <input type="number" id="tri-hirsch" class="form-control" min="0" max="3" step="0.05" placeholder="أدخل قيمة القياس" oninput="updateTriageStatus()">
          <label><input type="checkbox" id="tri-hirsch-confirmed" onchange="updateTriageStatus()"> أؤكد أن القيمة مدخلة من قياس فعلي وليست افتراضية.</label>
        </div>
        <div class="form-group">
          <label>المسافة الهامشية للجفن (MRD1 mm)</label>
          <input type="number" id="tri-mrd1" class="form-control" min="0.5" max="6" step="0.10" placeholder="أدخل قيمة القياس" oninput="updateTriageStatus()">
          <label><input type="checkbox" id="tri-mrd1-confirmed" onchange="updateTriageStatus()"> أؤكد أن القيمة مدخلة من قياس فعلي وليست افتراضية.</label>
        </div>
        <div class="form-group">
          <label>إشارة القياس وفق قواعد النموذج</label>
          <input type="text" id="tri-flag-disp" class="form-control" value="غير مكتمل - يلزم إدخال القياسين وتأكيدهما" readonly style="font-weight:bold;">
        </div>
        <div class="form-group">
          <label>درجة أعراض إجهاد العين (0–5)</label>
          <input type="number" id="std-asthenopia" class="form-control" min="0" max="5" value="0" oninput="updateTriageStatus()">
        </div>
      </div>
    </div>
  </div>

  <!-- 5. ملخص النتائج والسجل المحلي -->
  <div id="tab-sim" class="tab-pane">
    <div class="card">
      <div class="card-title">
        <span>ملخص النتائج والسجل المحلي</span>
        <button class="btn btn-outline" onclick="downloadParentCardPNG()">تحميل البطاقة (PNG)</button>
      </div>
      <canvas id="cv-board" width="600" height="220" style="display:block; margin:0 auto 12px;"></canvas>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="btn btn-success" style="flex:1;" onclick="commitMasterScreeningRecord()">حفظ السجل الموحد وتصدير الحالة</button>
        <button class="btn btn-primary" onclick="exportMasterCSV()">تصدير السجلات (CSV)</button>
        <button class="btn btn-outline" onclick="exportMasterJSON()">نسخة احتياطية JSON</button>
        <button class="btn btn-outline" onclick="document.getElementById('master-import-file').click()">استيراد ودمج</button>
        <input id="master-import-file" type="file" accept="application/json,.json" style="display:none" onchange="importMasterBackup(event)">
        <button class="btn btn-danger" onclick="wipeLocalDB()">مسح السجلات</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:12px;">
        <div class="kpi-card"><div class="val" id="db-total">0</div><div class="lbl">إجمالي المفحوصين (N)</div></div>
        <div class="kpi-card" style="background:#eef6ff;"><div class="val" id="db-kappa" style="color:#0d47a1;">--</div><div class="lbl">Kappa ثنائي عند حد 0.20 LogMAR • n=<span id="db-paired-n">0</span></div></div>
        <div class="kpi-card" style="background:#f0fdf4;"><div class="val" id="db-sens" style="color:#166534;">--%</div><div class="lbl">حساسية الحدة الرقمية مقابل المرجع • n=<span id="db-gold-n-sens">0</span><br>95% CI: <span id="db-sens-ci">--</span></div></div>
        <div class="kpi-card" style="background:#f0fdfa;"><div class="val" id="db-spec" style="color:#115e59;">--%</div><div class="lbl">نوعية الحدة الرقمية مقابل المرجع • n=<span id="db-gold-n-spec">0</span><br>95% CI: <span id="db-spec-ci">--</span></div></div>
        <div class="kpi-card" style="background:#faf5ff;"><div class="val" id="db-ppv" style="color:#581c87; font-size:0.95rem;">PPV: --</div><div class="val" id="db-npv" style="color:#581c87; font-size:0.95rem;">NPV: --</div><div class="lbl">القيم التنبؤية • PPV CI: <span id="db-ppv-ci">--</span><br>NPV CI: <span id="db-npv-ci">--</span></div></div>
        <div class="kpi-card" style="background:#eef2ff;"><div class="val" id="db-time-saved" style="color:#3730a3;">N/A</div><div class="lbl">فرق الزمن (ورقي − رقمي) • n=<span id="db-time-n">0</span></div></div>
      </div>
      <div class="alert-box alert-info">مؤشرات الدقة هنا تقارن نتيجة الحدة الرقمية الثنائية عند 0.20 LogMAR وحدها بالمرجع الموثق؛ لا تستخدم الإحالة المركبة. أُهملت نتائج المرجع القديمة التي لا تحتوي طريقة ومعياراً وفاحصاً وتاريخاً.</div>
      <div class="alert-box alert-info">حالات مكتملة: الورقي <span id="db-paper-n">0</span> • الرقمي <span id="db-smart-n">0</span> • التحقق المرجعي الموثق <span id="db-verified">0/0 (0%)</span>.</div>
      <div class="alert-box alert-warning">قد تحتوي سجلات الإصدارات السابقة قيماً افتراضية غير موثقة لقياسات العين. لا يمكن التحقق من مصدر القيمة من الرقم وحده؛ راجع هذه السجلات قبل إدخالها في التحليل.</div>

      <div style="overflow-x:auto;">
        <table id="tbl-data">
          <thead>
            <tr>
              <th>معرف المشارك</th><th>الفاحص</th><th>الموافقة</th><th>ورقي (OD/OS)</th><th>زمن الورقي</th>
              <th>رقمي (OD/OS)</th><th>IOD</th><th>زمن الرقمي</th><th>قيمة تقريبية (Δ)</th><th>إشارة النموذج</th><th>النتيجة المرجعية</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="gold-modal" class="scan-text-backdrop" aria-hidden="true">
    <section class="scan-text-dialog" role="dialog" aria-modal="true" aria-labelledby="gold-modal-title" style="max-height:90vh; overflow:auto;">
      <h2 id="gold-modal-title">توثيق نتيجة المرجع التشخيصي</h2>
      <p class="muted">المشارك: <strong id="gold-record-id"></strong>. أدخل الطريقة والمعيار كما وردا في البروتوكول المعتمد.</p>
      <div class="form-group"><label for="gold-status">حالة المرجع</label><select id="gold-status" class="form-control" onchange="updateGoldReferenceForm()"><option value="99">لم يُجرَ / غير متاح</option><option value="1">إيجابي وفق معيار الدراسة</option><option value="0">سلبي وفق معيار الدراسة</option></select></div>
      <div id="gold-details" style="display:grid; gap:10px; margin-top:10px;">
        <div class="form-group"><label for="gold-method">طريقة الفحص المرجعي *</label><input id="gold-method" class="form-control" maxlength="300" placeholder="كما وردت في البروتوكول"></div>
        <div class="form-group"><label for="gold-examiner">معرف فاحص المرجع *</label><input id="gold-examiner" class="form-control" maxlength="64"></div>
        <div class="form-group"><label for="gold-date">تاريخ التحقق *</label><input id="gold-date" class="form-control" type="date"></div>
        <div class="form-group"><label for="gold-criteria">معيار تصنيف الحالة *</label><textarea id="gold-criteria" class="form-control" rows="3" maxlength="1000" placeholder="اكتب المعيار المعتمد دون إنشاء عتبة جديدة"></textarea></div>
        <div class="form-group"><label for="gold-masked">هل كان فاحص المرجع محجوباً عن نتائج الفحص؟</label><select id="gold-masked" class="form-control"><option value="YES">نعم</option><option value="NO">لا</option><option value="UNKNOWN">غير معروف / غير موثق</option></select></div>
      </div>
      <div class="confirm-actions" style="margin-top:14px;"><button class="btn btn-outline" onclick="closeGoldEditor()">إلغاء</button><button class="btn btn-primary" onclick="saveGoldReference()">حفظ التوثيق</button></div>
    </section>
  </div>

  <!-- 6. استبيان مقياس SUS للممرضين متعدد المقيمين -->
  <div id="tab-sus" class="tab-pane">
    <div class="card">
      <div class="card-title">
        <span>استبيان تقييم سهولة الاستخدام (صياغة مكيّفة عن SUS)</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" onclick="exportSUSCSV()">تصدير تقييمات CSV</button>
        </div>
      </div>

      <!-- Global Benchmark Box -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:14px;">
        <div class="kpi-card" style="background:linear-gradient(135deg, #0d47a1, #1565c0); color:#fff;">
          <div class="val" id="lbl-sus-mean" style="color:#4ade80; font-size:1.4rem;">--</div>
          <div class="lbl" style="color:#bbdefb;">متوسط الدرجة الوصفية (Mean ± SD)</div>
        </div>
        <div class="kpi-card">
          <div class="val" id="lbl-sus-count">0</div>
          <div class="lbl">عدد التقييمات المسجلة</div>
        </div>
        <div class="kpi-card" style="background:#f0fdf4;">
          <div class="val" style="color:#166534;" id="lbl-sus-grade">--</div>
          <div class="lbl">التفسير</div>
        </div>
      </div>

      <!-- Evaluator Demographics -->
      <div class="alert-box alert-info">البنود الحالية مكيّفة لسياق التطبيق. تعامل مع الناتج كمؤشر وصفي؛ لا تقارنه بمراجع SUS المنشورة قبل التحقق محلياً من الترجمة والتكييف.</div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:14px;">
        <strong style="font-size:0.8rem; color:#1e293b; display:block; margin-bottom:6px;">بيانات الفاحص المقيم (Examiner Demographics)</strong>
        <div class="grid-4">
          <div class="form-group"><label>كود الفاحص</label><input type="text" id="sus-eval-id" class="form-control" placeholder="كود الفاحص"></div>
          <div class="form-group"><label>اسم الفاحص</label><input type="text" id="sus-eval-name" class="form-control" placeholder="اسم الفاحص"></div>
          <div class="form-group"><label>المركز / المدرسة</label><input type="text" id="sus-eval-center" class="form-control" placeholder="المركز أو المدرسة"></div>
          <div class="form-group"><label>المسمى الوظيفي</label><input type="text" id="sus-eval-role" class="form-control" placeholder="المسمى الوظيفي"></div>
        </div>
      </div>

      <div class="grid-2" id="sus-container"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; flex-wrap:wrap; gap:8px;">
        <button class="btn btn-success" onclick="saveSUSEvaluation()">حفظ وتوثيق استبانة الفاحص</button>
        <span class="badge" style="background:#e8f5e9; color:#2e7d32; font-size:0.85rem;" id="lbl-sus-current">أكمل البنود العشرة لحساب الدرجة</span>
      </div>

      <!-- Table of Saved SUS Evaluations -->
      <div style="margin-top:16px; overflow-x:auto;">
        <strong style="font-size:0.8rem; color:#1e293b; display:block; margin-bottom:6px;">سجل استبانات الفاحصين المحفوظة (albasar_sus_evaluations_v3)</strong>
        <table id="tbl-sus">
          <thead>
            <tr><th>الكود</th><th>الفاحص</th><th>المركز / المدرسة</th><th>المسمى</th><th>درجة SUS</th><th>التصنيف</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>

</div>

<script>
  let pxPerMM = 3.78;
  let activeCalibRefMM = 85.60;
  let calibrationVerified = false;
  let toastTimeout = null;

  function showToast(message, tone = 'info') {
    const toast = document.getElementById('app-toast');
    toast.textContent = message;
    toast.className = 'app-toast ' + tone;
    toast.hidden = false;
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function requestConfirmation(title, message) {
    return new Promise((resolve) => {
      const backdrop = document.getElementById('confirm-backdrop');
      const cancel = document.getElementById('confirm-cancel');
      const accept = document.getElementById('confirm-accept');
      const finish = (value) => {
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        cancel.onclick = null;
        accept.onclick = null;
        window.removeEventListener('keydown', onKeyDown);
        resolve(value);
      };
      const onKeyDown = (event) => { if (event.key === 'Escape') finish(false); };
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
      cancel.onclick = () => finish(false);
      accept.onclick = () => finish(true);
      window.addEventListener('keydown', onKeyDown);
      accept.focus();
    });
  }

  function requestScanText() {
    return new Promise((resolve) => {
      const backdrop = document.getElementById('scan-text-backdrop');
      const input = document.getElementById('scan-text-input');
      const cancel = document.getElementById('scan-text-cancel');
      const accept = document.getElementById('scan-text-apply');
      const finish = (value) => {
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        cancel.onclick = null;
        accept.onclick = null;
        input.onkeydown = null;
        window.removeEventListener('keydown', onKeyDown);
        resolve(value);
      };
      const onKeyDown = (event) => { if (event.key === 'Escape') finish(''); };
      input.value = '';
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
      cancel.onclick = () => finish('');
      accept.onclick = () => finish(input.value.trim());
      input.onkeydown = (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finish(input.value.trim()); } };
      window.addEventListener('keydown', onKeyDown);
      input.focus();
    });
  }

  const ACUITY_TABLE = [
    { snellen: "6/60",  logmar: 1.00, mm: 29.09 },
    { snellen: "6/36",  logmar: 0.80, mm: 18.35 },
    { snellen: "6/24",  logmar: 0.60, mm: 11.58 },
    { snellen: "6/18",  logmar: 0.50, mm: 9.20 },
    { snellen: "6/12",  logmar: 0.30, mm: 5.80 },
    { snellen: "6/9.5", logmar: 0.20, mm: 4.61 },
    { snellen: "6/7.5", logmar: 0.10, mm: 3.66 },
    { snellen: "6/6",   logmar: 0.00, mm: 2.91 }
  ];
  const LOGMAR_MAP = { "أقل من 6/60": 1.0, "6/60": 1.0, "6/36": 0.8, "6/24": 0.6, "6/18": 0.5, "6/12": 0.3, "6/9.5": 0.2, "6/7.5": 0.1, "6/6": 0.0 };

  const MASTER_RECORD_COLUMNS = [
    'Child_ID', 'Examiner_ID', 'Paper_Examiner_ID', 'Paper_Started_At', 'Paper_Completed_At', 'Smart_Examiner_ID', 'Smart_Started_At', 'Smart_Completed_At', 'Parental_Consent', 'Examination_Date', 'School_Name', 'School_Sector',
    'Grade_Level', 'Age_Years', 'Gender', 'Wears_Glasses', 'Crossover_Sequence',
    'Paper_Snellen_OD', 'Paper_LogMAR_OD', 'Paper_Snellen_OS', 'Paper_LogMAR_OS', 'Paper_Time_Sec', 'Paper_Referral',
    'Smart_Snellen_OD', 'Smart_Acuity_OD_Below_Test_Range', 'Smart_LogMAR_OD', 'Smart_Snellen_OS', 'Smart_Acuity_OS_Below_Test_Range', 'Smart_LogMAR_OS', 'Smart_IOD_LogMAR', 'Smart_Time_Sec',
    'Hirschberg_Asym_mm', 'Hirschberg_Prism_Diopters', 'MRD1_Min_mm', 'Triage_Ocular_Flag', 'Asthenopia_Score',
    'Final_Triage_Referral', 'Referral_Urgency', 'Referral_PHCC', 'FollowUp_Status', 'Gold_Standard_Confirmed',
    'Gold_Standard_Method', 'Gold_Standard_Examiner_ID', 'Gold_Standard_Date', 'Gold_Standard_Criteria', 'Gold_Standard_Masked'
  ];

  function normalizeMasterRecord(record) {
    const normalized = {};
    MASTER_RECORD_COLUMNS.forEach((column) => {
      normalized[column] = record && record[column] !== undefined && record[column] !== null
        ? record[column]
        : (column === 'Gold_Standard_Confirmed' ? 99 : column === 'Gold_Standard_Masked' ? 'UNKNOWN' : '');
    });
    return normalized;
  }

  function csvCell(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  let paperRunning = false, paperStart = 0, paperElapsed = 0;
  let smartRunning = false, smartStart = 0, smartElapsed = 0;
  let smartTimerInterval = null, paperTimerInterval = null;
  let paperStartedAt = '', paperStoppedAt = '', paperCompletedAt = '', smartStartedAt = '', smartCompletedAt = '';

  let testEye = 'OD', currentStepIdx = 2, targetAngle = 0;
  let correctInLevel = 0, attemptsInLevel = 0, bestPassedIdx = -1;
  let smartOD = "", smartOS = "";

  function studyRegistrationReady() {
    const age = Number(document.getElementById('std-age').value);
    const grade = Number(document.getElementById('std-grade').value);
    return Boolean(
      document.getElementById('std-id').value.trim() &&
      document.getElementById('std-examiner').value.trim() &&
      document.getElementById('std-consent').value === '1' &&
      document.getElementById('std-school').value.trim() &&
      document.getElementById('std-sector').value &&
      Number.isFinite(age) && age >= 5 && age <= 14 &&
      Number.isFinite(grade) && grade >= 1 && grade <= 6 &&
      document.getElementById('std-gender').value &&
      ['0', '1'].includes(document.getElementById('std-glasses').value) &&
      ['ورقي (6m) ← رقمي (2m)', 'رقمي (2m) ← ورقي (6m)'].includes(document.getElementById('std-seq').value)
    );
  }

  function paperStationReadyForCompletion() {
    return Boolean(
      paperStartedAt && paperStoppedAt && !paperRunning && document.getElementById('paper-examiner-id').value.trim() &&
      document.getElementById('p-od').value && document.getElementById('p-os').value && paperElapsed > 0
    );
  }

  function paperStationComplete() {
    return Boolean(paperCompletedAt && paperStationReadyForCompletion());
  }

  function smartStationComplete() {
    return Boolean(smartStartedAt && smartCompletedAt && smartOD && smartOS && smartElapsed > 0);
  }

  function canStartPaperStation() {
    const digitalFirst = document.getElementById('std-seq').value === 'رقمي (2m) ← ورقي (6m)';
    return studyRegistrationReady() && calibrationVerified && document.getElementById('paper-examiner-id').value.trim() &&
      !paperStationComplete() && (!digitalFirst || smartStationComplete());
  }

  function canStartSmartStation() {
    const paperFirst = document.getElementById('std-seq').value === 'ورقي (6m) ← رقمي (2m)';
    return studyRegistrationReady() && calibrationVerified && document.getElementById('smart-examiner-id').value.trim() &&
      !smartStationComplete() && (!paperFirst || paperStationComplete());
  }

  function canSwitchTab(id) {
    const sequence = document.getElementById('std-seq').value;
    const paperFirst = sequence === 'ورقي (6m) ← رقمي (2m)';
    const digitalFirst = sequence === 'رقمي (2m) ← ورقي (6m)';
    const paperDone = paperStationComplete();
    const smartDone = smartStationComplete();
    const bothDone = paperDone && smartDone;
    const anyStarted = Boolean(paperStartedAt || smartStartedAt);
    if (id === 'tab-calib') return !anyStarted;
    if (id === 'tab-sus') return !anyStarted || bothDone;
    if (id === 'tab-reg') {
      if (!anyStarted || bothDone) return true;
      if (paperFirst && paperDone && !smartDone) return false;
      return digitalFirst && smartDone && !paperDone || !paperFirst && !digitalFirst;
    }
    if (id === 'tab-triage' || id === 'tab-sim') return bothDone;
    if (bothDone) return id === 'tab-acuity';
    if (anyStarted && !bothDone) {
      if (paperFirst && paperStartedAt) return paperDone ? id === 'tab-acuity' : id === 'tab-reg';
      if (digitalFirst && smartStartedAt) return smartDone ? id === 'tab-reg' : id === 'tab-acuity';
    }
    if (!studyRegistrationReady() || !calibrationVerified) return false;
    if (digitalFirst && !smartDone) return id === 'tab-acuity';
    return false;
  }

  function switchTab(id, btn) {
    if (!canSwitchTab(id)) return showToast('هذه المحطة مقفلة حتى إكمال المحطة السابقة وفق التسلسل المسجل.', 'info');
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const selectedButton = btn || Array.from(document.querySelectorAll('.nav-btn')).find(el => (el.getAttribute('onclick') || '').includes("'" + id + "'"));
    if (selectedButton) selectedButton.classList.add('active');
    if (id === 'tab-sim') renderBlackboardEmulation();
    updateStationIsolation();
  }

  function switchTabTo(id) {
    const button = Array.from(document.querySelectorAll('.nav-btn')).find(el => (el.getAttribute('onclick') || '').includes("'" + id + "'"));
    switchTab(id, button);
  }

  function updateStationIsolation() {
    const sequence = document.getElementById('std-seq').value;
    const paperPane = document.getElementById('paper-station-content');
    if (paperPane) paperPane.style.display = sequence === 'رقمي (2m) ← ورقي (6m)' && !smartCompletedAt ? 'none' : 'block';
    const sequenceSelect = document.getElementById('std-seq');
    const anyStarted = Boolean(paperStartedAt || smartStartedAt);
    if (sequenceSelect) sequenceSelect.disabled = anyStarted;
    ['std-id', 'std-examiner', 'std-consent', 'std-school', 'std-sector', 'std-grade', 'std-age', 'std-gender', 'std-glasses'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.disabled = anyStarted;
    });
    const qrButton = document.getElementById('btn-qr-open');
    const newIdButton = document.getElementById('btn-new-id');
    if (qrButton) qrButton.disabled = anyStarted;
    if (newIdButton) newIdButton.disabled = anyStarted;
    const paperExaminer = document.getElementById('paper-examiner-id');
    const smartExaminer = document.getElementById('smart-examiner-id');
    if (paperExaminer) paperExaminer.disabled = Boolean(paperStartedAt);
    if (smartExaminer) smartExaminer.disabled = Boolean(smartStartedAt);
    ['p-od', 'p-os'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.disabled = !paperStartedAt;
    });
    const paperTimerButton = document.getElementById('btn-paper-clk');
    if (paperTimerButton) paperTimerButton.disabled = !paperRunning && !canStartPaperStation();
    const paperProceedButton = document.getElementById('btn-paper-proceed');
    if (paperProceedButton) paperProceedButton.disabled = !paperStationReadyForCompletion();
    const odStartButton = document.getElementById('btn-start-od');
    const osStartButton = document.getElementById('btn-start-os');
    if (odStartButton) odStartButton.disabled = Boolean(smartStartedAt);
    if (osStartButton) osStartButton.disabled = Boolean(smartStartedAt) || !smartOD;
    const paperTitle = document.getElementById('paper-seq-title');
    if (paperTitle && sequence) paperTitle.textContent = (sequence.startsWith('ورقي') ? 'المحطة (1)' : 'المحطة (2)') + ': نتائج الفحص الورقي (لوحة سنيلين 6 أمتار):';
    document.querySelectorAll('.nav-btn[data-tab]').forEach((button) => {
      const tab = button.getAttribute('data-tab');
      const activeTab = document.querySelector('.tab-pane.active')?.id;
      button.disabled = !canSwitchTab(tab) && tab !== activeTab;
      button.setAttribute('aria-disabled', String(button.disabled));
    });
  }

  function proceedFromPaperStation() {
    if (!paperStationReadyForCompletion()) return showToast('أوقف المؤقت وأكمل معرف الفاحص ونتيجتي العينين قبل اعتماد المحطة الورقية.', 'error');
    paperCompletedAt = new Date().toISOString();
    updateStationIsolation();
    const sequence = document.getElementById('std-seq').value;
    if (sequence === 'ورقي (6m) ← رقمي (2m)') return switchTabTo('tab-acuity');
    if (sequence === 'رقمي (2m) ← ورقي (6m)' && smartStationComplete()) return switchTabTo('tab-triage');
    showToast('التسلسل المسجل لا يسمح بمتابعة المرحلة الحالية بعد.', 'error');
  }

  function changeCalibRef(mm) {
    activeCalibRefMM = parseFloat(mm);
    calibrationVerified = false;
    const box = document.getElementById('physical-box');
    box.innerText = activeCalibRefMM === 85.60 ? "البطاقة الوطنية / المصرفية (85.60 mm)" : "مسطرة مليمترية (50.00 mm)";
    adjustCalibration(document.getElementById('rng-px').value, false);
  }

  function adjustCalibration(px, physicallyMatched = true) {
    const pixelWidth = parseFloat(px);
    calibrationVerified = physicallyMatched;
    pxPerMM = +(pixelWidth / activeCalibRefMM).toFixed(3);
    document.getElementById('physical-box').style.width = pixelWidth + 'px';
    document.getElementById('lbl-px-val').innerText = Math.round(pixelWidth);
    document.getElementById('lbl-ppm-val').innerText = pxPerMM;
    document.getElementById('calib-header-badge').innerText = \`\${calibrationVerified ? 'تم ضبط الحجم' : 'مرجع العرض غير متحقق'}: \${pxPerMM} px/mm\`;

    document.getElementById('disp-h-66').innerText = (2.91).toFixed(2) + ' mm';
    document.getElementById('disp-h-69').innerText = (4.61).toFixed(2) + ' mm';
    document.getElementById('disp-h-618').innerText = (9.20).toFixed(2) + ' mm';
    const estDPI = Math.round(pxPerMM * 25.4);
    document.getElementById('disp-dpi').innerText = estDPI + ' DPI';

    localStorage.setItem('albasar_ppm_v3', pxPerMM);
    renderOptotypeSVG();
    updateStationIsolation();
  }

  async function openStandaloneQRScanner() {
    const code = (await requestScanText()).trim();
    if (!code) return;
    if (code.length > 4096) return showToast('محتوى QR أطول من الحد المسموح.', 'error');
    let data = {};
    try {
      if (code.startsWith('{')) {
        const obj = JSON.parse(code);
        data = {
          childId: obj.childId || obj.id || obj.Child_ID || obj.code,
          school: obj.schoolName || obj.school || obj.School_Name,
          sector: obj.schoolSector || obj.sector || obj.School_Sector,
          grade: obj.gradeLevel || obj.grade || obj.Grade_Level,
          age: obj.ageYears || obj.age || obj.Age_Years,
          gender: obj.gender || obj.Gender,
          glasses: obj.wearsGlasses ?? obj.glasses ?? obj.Wears_Glasses,
          consent: obj.parentalConsent ?? obj.consent ?? obj.Parental_Consent,
          phcc: obj.referralPHCC || obj.phcc || obj.Referral_PHCC
        };
      } else if (code.startsWith('http://') || code.startsWith('https://')) {
        const params = new URL(code).searchParams;
        data = { childId: params.get('id') || params.get('childId'), school: params.get('school') || params.get('schoolName'), sector: params.get('sector') || params.get('schoolSector'), grade: params.get('grade'), age: params.get('age'), gender: params.get('gender'), glasses: params.get('glasses') || params.get('wearsGlasses'), consent: params.get('consent'), phcc: params.get('phcc') };
      } else if (code.includes('|') || code.includes(';')) {
        const parts = code.split(code.includes('|') ? '|' : ';').map(value => value.trim());
        data = { childId: parts[0], school: parts[1], sector: parts[2], grade: parts[3], age: parts[4], gender: parts[5], consent: parts[6], phcc: parts[7] };
      } else {
        data = { childId: code };
      }
    } catch (e) {
      return showToast('تعذر تحليل QR. استخدم JSON أو رابطاً أو حقولاً مفصولة بعلامة |.', 'error');
    }

    const clean = (value, label, limit) => {
      if (value === undefined || value === null || value === '') return '';
      if (typeof value !== 'string' && typeof value !== 'number') throw new Error('قيمة ' + label + ' غير صالحة.');
      const result = String(value).trim();
      if (result.length > limit || /[\\u0000-\\u001f\\u007f]/.test(result)) throw new Error('تحقق من محتوى ' + label + ' في QR.');
      return result;
    };
    try {
      const childId = clean(data.childId, 'المعرف', 64);
      const school = clean(data.school, 'المدرسة', 120);
      const sector = clean(data.sector, 'القطاع', 40);
      const phcc = clean(data.phcc, 'المركز الصحي', 120);
      let gender = clean(data.gender, 'الجنس', 16);
      if (gender === '1') gender = 'ذكر';
      if (gender === '2') gender = 'أنثى';
      if (sector && !['حكومي حضري', 'حكومي ريفي', 'أهلي'].includes(sector)) throw new Error('قطاع QR غير معروف؛ أدخله يدوياً.');
      if (gender && !['ذكر', 'أنثى'].includes(gender)) throw new Error('جنس QR غير صالح.');
      const grade = data.grade === '' || data.grade === undefined || data.grade === null ? '' : Number(data.grade);
      const age = data.age === '' || data.age === undefined || data.age === null ? '' : Number(data.age);
      const glasses = data.glasses === '' || data.glasses === undefined || data.glasses === null ? '' : Number(data.glasses);
      const consent = data.consent === '' || data.consent === undefined || data.consent === null ? '' : Number(data.consent);
      if (grade !== '' && (!Number.isInteger(grade) || grade < 1 || grade > 6)) throw new Error('الصف في QR يجب أن يكون بين 1 و6.');
      if (age !== '' && (!Number.isInteger(age) || age < 5 || age > 14)) throw new Error('العمر في QR يجب أن يكون بين 5 و14 سنة.');
      if (glasses !== '' && glasses !== 0 && glasses !== 1) throw new Error('قيمة النظارة في QR يجب أن تكون 0 أو 1.');
      if (consent !== '' && consent !== 0 && consent !== 1) throw new Error('قيمة الموافقة في QR يجب أن تكون 0 أو 1.');
      if (childId) document.getElementById('std-id').value = childId;
      if (school) document.getElementById('std-school').value = school;
      if (sector) document.getElementById('std-sector').value = sector;
      if (grade !== '') document.getElementById('std-grade').value = String(grade);
      if (age !== '') document.getElementById('std-age').value = String(age);
      if (gender) document.getElementById('std-gender').value = gender;
      if (glasses !== '') document.getElementById('std-glasses').value = String(glasses);
      if (consent !== '') document.getElementById('std-consent').value = String(consent);
      if (phcc) document.getElementById('std-phcc').value = phcc;
      showToast('تمت قراءة بيانات QR بعد التحقق منها. راجع الحقول قبل الحفظ.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'محتوى QR غير صالح.', 'error');
    }
  }

  function generateNextID() {
    const db = getDB();
    const existing = new Set(db.map(record => String(record.Child_ID || '').trim().toUpperCase()));
    let generatedId = '';
    do {
      let token = '';
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        token = window.crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();
      } else if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(10);
        window.crypto.getRandomValues(bytes);
        token = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
      } else {
        token = Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
      }
      generatedId = 'BAB-' + token;
    } while (existing.has(generatedId.toUpperCase()));
    document.getElementById('std-id').value = generatedId;
    document.getElementById('std-seq').value = '';
    document.getElementById('std-examiner').value = '';
    document.getElementById('paper-examiner-id').value = '';
    document.getElementById('smart-examiner-id').value = '';
    paperStartedAt = '';
    paperStoppedAt = '';
    paperCompletedAt = '';
    smartStartedAt = '';
    smartCompletedAt = '';
    clearInterval(paperTimerInterval);
    clearInterval(smartTimerInterval);
    paperRunning = false;
    smartRunning = false;
    paperElapsed = 0;
    smartElapsed = 0;
    smartOD = "";
    smartOS = "";
    document.getElementById('lbl-paper-time').innerText = 'الزمن: 0.0 ثانية';
    document.getElementById('lbl-smart-time').innerText = 'الزمن الرقمي: 0.0 ثانية';
    const paperTimerButton = document.getElementById('btn-paper-clk');
    paperTimerButton.innerText = 'بدء مؤقت الورقي';
    paperTimerButton.classList.remove('btn-danger');
    paperTimerButton.classList.add('btn-outline');
    document.getElementById('smart-cur-res').innerText = 'المحطة 2: بانتظار بدء الفحص المستقل';
    document.getElementById('res-s-od').innerText = '--';
    document.getElementById('res-s-os').innerText = '--';
    document.getElementById('res-s-iod').innerText = '--';
    document.getElementById('p-od').value = '';
    document.getElementById('p-os').value = '';
    document.getElementById('std-consent').value = '0';
    document.getElementById('std-asthenopia').value = '0';
    document.getElementById('std-school').value = '';
    document.getElementById('std-sector').value = '';
    document.getElementById('std-grade').value = '';
    document.getElementById('std-age').value = '';
    document.getElementById('std-gender').value = '';
    document.getElementById('std-glasses').value = '';
    document.getElementById('std-phcc').value = '';
    document.getElementById('tri-hirsch').value = '';
    document.getElementById('tri-mrd1').value = '';
    document.getElementById('tri-hirsch-confirmed').checked = false;
    document.getElementById('tri-mrd1-confirmed').checked = false;
    updateTriageStatus();
    updateStationIsolation();
  }

  function togglePaperTimer() {
    const btn = document.getElementById('btn-paper-clk');
    if (!paperRunning) {
      if (!canStartPaperStation()) return showToast('أكمل بيانات المشارك ومعايرة الجهاز ومعرف الفاحص، واتبع ترتيب المحطات المخصص قبل بدء الورقي.', 'error');
      paperStartedAt = paperStartedAt || new Date().toISOString();
      paperStoppedAt = '';
      paperCompletedAt = '';
      paperStart = performance.now() - paperElapsed;
      paperRunning = true;
      updateStationIsolation();
      btn.innerText = "إيقاف مؤقت الورقي";
      btn.classList.replace('btn-outline', 'btn-danger');
      paperTimerInterval = setInterval(() => {
        paperElapsed = performance.now() - paperStart;
        document.getElementById('lbl-paper-time').innerText = \`الزمن: \${(paperElapsed / 1000).toFixed(1)} ثانية\`;
      }, 100);
    } else {
      paperRunning = false;
      paperStoppedAt = new Date().toISOString();
      updateStationIsolation();
      clearInterval(paperTimerInterval);
      btn.innerText = "استئناف مؤقت الورقي";
      btn.classList.replace('btn-danger', 'btn-outline');
      if (paperStationReadyForCompletion()) proceedFromPaperStation();
    }
    updateStationIsolation();
  }

  function launchTrainingDemo() {
    showToast("وضع التدريب لا يسجل إجابات الفحص أو الزمن.");
    currentStepIdx = 0;
    renderOptotypeSVG();
  }

  function initAcuityPhase(eye) {
    if (smartStationComplete()) return showToast('اكتملت المحطة الرقمية لهذا المشارك. استخدم توليد معرف جديد لبدء سجل آخر.', 'error');
    if (!canStartSmartStation()) return showToast('أكمل بيانات المشارك ومعايرة الجهاز ومعرف فاحص الرقمية، والتزم بترتيب المحطتين قبل البدء.', 'error');
    if (eye === 'OS' && !smartOD) return showToast('ابدأ بالعين اليمنى؛ تُفتح العين اليسرى بعد إكمالها.', 'error');
    if (eye === 'OD' || !smartStartedAt) smartStartedAt = new Date().toISOString();
    smartCompletedAt = '';
    updateStationIsolation();
    testEye = eye;
    currentStepIdx = 2;
    correctInLevel = 0;
    attemptsInLevel = 0;
    bestPassedIdx = -1;

    document.getElementById('lbl-active-eye').innerText = \`العين المفحوصة: \${eye === 'OD' ? 'اليمنى' : 'اليسرى'}\`;
    if (!smartRunning) {
      smartStart = performance.now();
      smartRunning = true;
      smartTimerInterval = setInterval(() => {
        smartElapsed = performance.now() - smartStart;
        document.getElementById('lbl-smart-time').innerText = \`الزمن الرقمي: \${(smartElapsed / 1000).toFixed(1)} ثانية\`;
      }, 100);
    }
    updateStationIsolation();
    renderOptotypeSVG();
  }

  function renderOptotypeSVG() {
    const step = ACUITY_TABLE[currentStepIdx];
    document.getElementById('lbl-active-level').innerText = \`المستوى: \${step.snellen} (LogMAR \${step.logmar.toFixed(2)})\`;
    const sizePx = Math.max(8, Math.round(step.mm * pxPerMM));
    const svg = document.getElementById('svg-e');
    svg.setAttribute('width', sizePx);
    svg.setAttribute('height', sizePx);

    const angles = [0, 90, 180, 270];
    targetAngle = angles[Math.floor(Math.random() * angles.length)];
    svg.style.transform = \`rotate(\${targetAngle}deg)\`;
  }

  function submitAcuityTrial(chosenAngle) {
    attemptsInLevel++;
    const isCorrect = (chosenAngle === targetAngle);
    if (isCorrect) correctInLevel++;

    // Use the same majority rule at every scored line; never advance from one answer.
    if (correctInLevel >= 3) {
      bestPassedIdx = currentStepIdx;
      if (currentStepIdx < ACUITY_TABLE.length - 1) {
        currentStepIdx++;
        correctInLevel = 0; attemptsInLevel = 0;
        renderOptotypeSVG();
      } else {
        finishEye(ACUITY_TABLE[currentStepIdx].snellen);
      }
    } else if (attemptsInLevel - correctInLevel >= 2 || attemptsInLevel >= 4) {
      if (bestPassedIdx >= 0 && currentStepIdx > bestPassedIdx) {
        finishEye(ACUITY_TABLE[bestPassedIdx].snellen);
      } else if (currentStepIdx > 0) {
        // A failed entry level is followed by a directly tested, larger optotype.
        currentStepIdx--;
        correctInLevel = 0; attemptsInLevel = 0;
        renderOptotypeSVG();
      } else {
        finishEye('أقل من 6/60');
      }
    } else {
      renderOptotypeSVG();
    }
  }

  function finishEye(snellenVal) {
    if (testEye === 'OD') {
      smartOD = snellenVal;
      document.getElementById('res-s-od').innerText = smartOD;
      showToast(\`اكتملت نتيجة العين اليمنى: \${smartOD}. اتبع البروتوكول للانتقال إلى العين اليسرى.\`, 'success');
      initAcuityPhase('OS');
    } else {
      smartOS = snellenVal;
      smartCompletedAt = new Date().toISOString();
      updateStationIsolation();
      document.getElementById('res-s-os').innerText = smartOS;
      if (smartRunning) {
        smartRunning = false;
        clearInterval(smartTimerInterval);
      }
      const iod = Math.abs(LOGMAR_MAP[smartOD] - LOGMAR_MAP[smartOS]).toFixed(2);
      document.getElementById('res-s-iod').innerText = iod;
      showToast(\`اكتمل تسجيل العينين: اليمنى \${smartOD} | اليسرى \${smartOS}\`, 'success');
      if (document.getElementById('std-seq').value === 'رقمي (2m) ← ورقي (6m)') switchTabTo('tab-reg');
    }
  }

  function processOcularPhoto(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const cv = document.getElementById('cv-triage');
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        updateTriageStatus();
        showToast('عُرضت الصورة دون تحليل آلي. راجعها وأدخل القياسات وفق بروتوكول الدراسة.', 'info');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function runSyntheticOcularCaliper() {
    const cv = document.getElementById('cv-triage');
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    drawOcularOverlays(ctx);
    updateTriageStatus();
  }

  function drawOcularOverlays(ctx) {
    const eyes = [{ cx: 170, cy: 100, lbl: 'OD (Right)' }, { cx: 410, cy: 100, lbl: 'OS (Left)' }];
    const hShift = parseFloat(document.getElementById('tri-hirsch').value) || 0;
    const mrd = parseFloat(document.getElementById('tri-mrd1').value) || 4.1;

    eyes.forEach((eye, i) => {
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(eye.cx, eye.cy, 68, 32, 0, 0, Math.PI * 2); ctx.stroke();

      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(eye.cx, eye.cy, 28, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(eye.cx, eye.cy, 11, 0, Math.PI * 2); ctx.fill();

      const shiftPx = (i === 1) ? (hShift * 5.0) : 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(eye.cx + shiftPx, eye.cy - 1, 3.2, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(eye.cx, eye.cy); ctx.lineTo(eye.cx, eye.cy - (mrd * 6.5)); ctx.stroke();

      ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';
      ctx.fillText(eye.lbl + ' | مرجع افتراضي HVID=11.7mm', eye.cx - 70, eye.cy + 52);
    });
  }

  function updateTriageStatus() {
    const hInput = document.getElementById('tri-hirsch');
    const mrdInput = document.getElementById('tri-mrd1');
    const h = parseFloat(hInput.value);
    const mrd = parseFloat(mrdInput.value);
    const hConfirmed = document.getElementById('tri-hirsch-confirmed').checked;
    const mrdConfirmed = document.getElementById('tri-mrd1-confirmed').checked;
    if (!hConfirmed || !mrdConfirmed || !Number.isFinite(h) || !Number.isFinite(mrd)) {
      document.getElementById('tri-flag-disp').value = 'غير مكتمل - يلزم إدخال القياسين وتأكيدهما';
      return;
    }
    if (h < 0 || h > 3 || mrd < 0.5 || mrd > 6) {
      document.getElementById('tri-flag-disp').value = 'قيمة خارج النطاق المدخل؛ راجع القياس';
      return;
    }
    let desc = "0 - لم تُسجل إشارة تجاوز";
    if (h >= 1.0 && mrd < 2.5) desc = "3 - تجاوز حدين مبرمجين؛ تحقّق من القياس";
    else if (h >= 1.0) desc = "1 - تجاوز حد المنعكس القرني في النموذج";
    else if (mrd < 2.5) desc = "2 - قيمة MRD1 دون حد النموذج";
    document.getElementById('tri-flag-disp').value = desc;
  }

  function renderBlackboardEmulation() {
    const cv = document.getElementById('cv-board');
    const ctx = cv.getContext('2d');
    const od = smartOD;
    const os = smartOS;
    const maxLog = Math.max(LOGMAR_MAP[od] || 0, LOGMAR_MAP[os] || 0);
    const worstSnellen = od && os ? ((LOGMAR_MAP[od] >= LOGMAR_MAP[os]) ? od : os) : 'غير مكتمل';
    const blurPx = (maxLog * 11.5).toFixed(1);

    ctx.filter = 'none';
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, cv.width - 10, cv.height - 10);

    ctx.filter = \`blur(\${blurPx}px)\`;
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.font = 'bold 22px Tahoma';
    ctx.fillText('بسم الله الرحمن الرحيم', cv.width / 2, 50);
    ctx.font = '18px Tahoma';
    ctx.fillText('درس القراءة والرياضيات:  ٤ × ٦ = ٢٤', cv.width / 2, 98);
    ctx.font = '15px Tahoma';
    ctx.fillText('رسم توضيحي مبسط؛ لا يحاكي الرؤية الفعلية (النتيجة: ' + worstSnellen + ')', cv.width / 2, 145);

    ctx.filter = 'none';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 12px Tahoma';
    ctx.fillText('معرف المشارك: ' + document.getElementById('std-id').value + ' | عرض توضيحي لا يمثل تشخيصاً أو وصفة طبية', cv.width / 2, 192);
  }

  function downloadParentCardPNG() {
    renderBlackboardEmulation();
    const cv = document.getElementById('cv-board');
    const a = document.createElement('a');
    a.download = \`Referral_Card_\${document.getElementById('std-id').value}.png\`;
    a.href = cv.toDataURL('image/png');
    a.click();
  }

  function commitMasterScreeningRecord() {
    if (document.getElementById('std-consent').value === "0") {
      return showToast("تحقق من متطلبات الموافقة المعتمدة في بروتوكول الدراسة قبل حفظ السجل.", 'error');
    }
    const pOD = document.getElementById('p-od').value;
    const pOS = document.getElementById('p-os').value;
    const childId = document.getElementById('std-id').value.trim();
    const examinerId = document.getElementById('std-examiner').value.trim();
    const paperExaminerId = document.getElementById('paper-examiner-id').value.trim();
    const smartExaminerId = document.getElementById('smart-examiner-id').value.trim();
    const crossoverSequence = document.getElementById('std-seq').value;
    const schoolName = document.getElementById('std-school').value.trim();
    const schoolSector = document.getElementById('std-sector').value;
    const wearsGlasses = document.getElementById('std-glasses').value;
    const ageYears = Number(document.getElementById('std-age').value);
    const gradeLevel = Number(document.getElementById('std-grade').value);
    const gender = document.getElementById('std-gender').value;

    if (!childId || childId.length > 64 || !examinerId || !paperExaminerId || !smartExaminerId || !crossoverSequence || !paperStationComplete() || !smartStationComplete() || !calibrationVerified || !schoolName || !schoolSector || !wearsGlasses || !gender || !Number.isFinite(ageYears) || ageYears < 5 || ageYears > 14 || gradeLevel < 1 || gradeLevel > 6) {
      return showToast('أكمل معرفات الفاحصين والتسلسل المخصص وبيانات المشارك، وسجّل بدء وإكمال المحطتين قبل الحفظ.', 'error');
    }
    if (getDB().some((record) => normalizeId(record.Child_ID) === normalizeId(childId))) {
      return showToast('هذا المعرف موجود مسبقاً في السجل. أدخل معرفاً فريداً.', 'error');
    }

    // Strict Blinding Check: Station 1 & Station 2 must be independently populated
    if (!pOD || !pOS) {
      return showToast("أدخل نتيجتي العينين في محطة الفحص الورقي.", 'error');
    }
    if (!smartOD || !smartOS) {
      return showToast("أدخل نتيجة كلتا العينين في المحطة الرقمية بشكل مستقل عن نتيجة المحطة الورقية.", 'error');
    }
    const hirschbergInput = document.getElementById('tri-hirsch');
    const mrd1Input = document.getElementById('tri-mrd1');
    const hirschbergMM = parseFloat(hirschbergInput.value);
    const mrd1MM = parseFloat(mrd1Input.value);
    if (!document.getElementById('tri-hirsch-confirmed').checked || !document.getElementById('tri-mrd1-confirmed').checked || !Number.isFinite(hirschbergMM) || !Number.isFinite(mrd1MM) || hirschbergMM < 0 || hirschbergMM > 3 || mrd1MM < 0.5 || mrd1MM > 6) {
      return showToast('أدخل قياسي Hirschberg وMRD₁ وأكد أنهما من قياس فعلي قبل حفظ السجل.', 'error');
    }

    const sOD = smartOD;
    const sOS = smartOS;
    const pLogOD = LOGMAR_MAP[pOD] ?? 0.0;
    const pLogOS = LOGMAR_MAP[pOS] ?? 0.0;
    const sLogOD = LOGMAR_MAP[sOD] ?? 0.0;
    const sLogOS = LOGMAR_MAP[sOS] ?? 0.0;
    const iod = Math.abs(sLogOD - sLogOS).toFixed(2);
    const triageFlagText = document.getElementById('tri-flag-disp').value || "0";
    const triageCode = parseInt(triageFlagText.charAt(0), 10) || 0;

    const paperRef = (Math.max(pLogOD, pLogOS) >= 0.20) ? 1 : 0;
    const asthenopiaScore = Math.max(0, Math.min(5, Number(document.getElementById('std-asthenopia').value) || 0));
    const smartRef = (Math.max(sLogOD, sLogOS) >= 0.20 || parseFloat(iod) >= 0.20 || triageCode > 0 || asthenopiaScore >= 2) ? 1 : 0;
    const urgency = triageCode > 0 || Math.max(sLogOD, sLogOS) >= 0.80
      ? 'MODEL_PRIORITY'
      : smartRef ? 'MODEL_REVIEW' : 'MODEL_NO_FLAG';
    const record = {
      Child_ID: childId,
      Examiner_ID: examinerId,
      Paper_Examiner_ID: paperExaminerId,
      Paper_Started_At: paperStartedAt,
      Paper_Completed_At: paperCompletedAt,
      Smart_Examiner_ID: smartExaminerId,
      Smart_Started_At: smartStartedAt,
      Smart_Completed_At: smartCompletedAt,
      Parental_Consent: Number(document.getElementById('std-consent').value),
      Examination_Date: new Date().toISOString(),
      School_Name: schoolName,
      School_Sector: schoolSector,
      Grade_Level: gradeLevel,
      Age_Years: ageYears,
      Gender: gender,
      Wears_Glasses: Number(wearsGlasses),
      Crossover_Sequence: crossoverSequence,
      Paper_Snellen_OD: pOD,
      Paper_LogMAR_OD: +pLogOD.toFixed(2),
      Paper_Snellen_OS: pOS,
      Paper_LogMAR_OS: +pLogOS.toFixed(2),
      Paper_Time_Sec: +(paperElapsed / 1000).toFixed(1),
      Paper_Referral: paperRef,
      Smart_Snellen_OD: sOD,
      Smart_Acuity_OD_Below_Test_Range: sOD === 'أقل من 6/60',
      Smart_LogMAR_OD: +sLogOD.toFixed(2),
      Smart_Snellen_OS: sOS,
      Smart_Acuity_OS_Below_Test_Range: sOS === 'أقل من 6/60',
      Smart_LogMAR_OS: +sLogOS.toFixed(2),
      Smart_IOD_LogMAR: Number(iod),
      Smart_Time_Sec: +(smartElapsed / 1000).toFixed(1),
      Hirschberg_Asym_mm: hirschbergMM,
      Hirschberg_Prism_Diopters: Math.round(hirschbergMM * 15),
      MRD1_Min_mm: mrd1MM,
      Triage_Ocular_Flag: triageCode,
      Asthenopia_Score: asthenopiaScore,
      Final_Triage_Referral: smartRef,
      Referral_Urgency: urgency,
      Referral_PHCC: document.getElementById('std-phcc').value,
      FollowUp_Status: 0,
      Gold_Standard_Confirmed: 99,
      Gold_Standard_Method: '',
      Gold_Standard_Examiner_ID: '',
      Gold_Standard_Date: '',
      Gold_Standard_Criteria: '',
      Gold_Standard_Masked: 'UNKNOWN'
    };

    const db = getDB();
    db.push(record);
    try {
      localStorage.setItem('albasar_master_records_v3', JSON.stringify(db));
    } catch (e) {
      return showToast('تعذر حفظ السجل محلياً؛ تحقق من المساحة المتاحة قبل المتابعة.', 'error');
    }

    paperElapsed = 0; smartElapsed = 0;
    smartOD = null; smartOS = null;
    document.getElementById('p-od').value = '';
    document.getElementById('p-os').value = '';
    document.getElementById('std-consent').value = '0';
    document.getElementById('std-asthenopia').value = '0';
    document.getElementById('lbl-paper-time').innerText = "الزمن: 0.0 ثانية";
    document.getElementById('lbl-smart-time').innerText = "الزمن الرقمي: 0.0 ثانية";
    document.getElementById('smart-cur-res').innerText = "المحطة 2: بانتظار بدء الفحص المستقل";

    showToast("حُفظ السجل محلياً في هذا المتصفح.", 'success');
    renderTable();
    generateNextID();
  }

  function getDB() {
    const raw = localStorage.getItem('albasar_master_records_v3');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeMasterRecord) : [];
      } catch (e) { return []; }
    }
    return [];
  }

  function getAcuityLogmar(snellen, recordedLogmar) {
    if (typeof snellen !== 'string' || !snellen.trim()) return null;
    if (Object.prototype.hasOwnProperty.call(LOGMAR_MAP, snellen.trim())) return LOGMAR_MAP[snellen.trim()];
    if (snellen.trim() === '6/9') return 0.2;
    const value = Number(recordedLogmar);
    return Number.isFinite(value) ? value : null;
  }

  function binaryFlag(value) {
    if (value === 0 || value === '0') return 0;
    if (value === 1 || value === '1') return 1;
    return null;
  }

  function hasDocumentedReference(record) {
    return Boolean(record.Gold_Standard_Method && String(record.Gold_Standard_Method).trim()
      && record.Gold_Standard_Examiner_ID && String(record.Gold_Standard_Examiner_ID).trim()
      && record.Gold_Standard_Date && !Number.isNaN(Date.parse(record.Gold_Standard_Date))
      && record.Gold_Standard_Criteria && String(record.Gold_Standard_Criteria).trim()
      && ['YES', 'NO', 'UNKNOWN'].includes(record.Gold_Standard_Masked));
  }

  function wilsonInterval95(successes, total) {
    if (!total) return null;
    const z = 1.959963984540054;
    const p = successes / total;
    const denominator = 1 + z * z / total;
    const center = (p + z * z / (2 * total)) / denominator;
    const margin = z * Math.sqrt((p * (1 - p) / total) + (z * z / (4 * total * total))) / denominator;
    return [+(Math.max(0, center - margin) * 100).toFixed(1), +(Math.min(1, center + margin) * 100).toFixed(1)];
  }

  function calculateDiagnosticMetrics(records) {
    let paperCompleteN = 0, smartCompleteN = 0;
    const paired = records.map((record) => {
      const paperOD = getAcuityLogmar(record.Paper_Snellen_OD, record.Paper_LogMAR_OD);
      const paperOS = getAcuityLogmar(record.Paper_Snellen_OS, record.Paper_LogMAR_OS);
      const smartOD = getAcuityLogmar(record.Smart_Snellen_OD, record.Smart_LogMAR_OD);
      const smartOS = getAcuityLogmar(record.Smart_Snellen_OS, record.Smart_LogMAR_OS);
      const paperComplete = paperOD !== null && paperOS !== null;
      const smartComplete = smartOD !== null && smartOS !== null;
      if (paperComplete) paperCompleteN++;
      if (smartComplete) smartCompleteN++;
      return !paperComplete || !smartComplete ? null
        : { paperRefer: Math.max(paperOD, paperOS) >= 0.2, smartRefer: Math.max(smartOD, smartOS) >= 0.2 };
    }).filter(Boolean);

    let bothRefer = 0, paperOnly = 0, smartOnly = 0, bothNormal = 0;
    paired.forEach((pair) => {
      if (pair.paperRefer && pair.smartRefer) bothRefer++;
      else if (pair.paperRefer) paperOnly++;
      else if (pair.smartRefer) smartOnly++;
      else bothNormal++;
    });

    const pairedN = paired.length;
    const po = pairedN ? (bothRefer + bothNormal) / pairedN : 0;
    const pPaperPositive = pairedN ? (bothRefer + paperOnly) / pairedN : 0;
    const pPaperNegative = pairedN ? (smartOnly + bothNormal) / pairedN : 0;
    const pSmartPositive = pairedN ? (bothRefer + smartOnly) / pairedN : 0;
    const pSmartNegative = pairedN ? (paperOnly + bothNormal) / pairedN : 0;
    const pe = pPaperPositive * pSmartPositive + pPaperNegative * pSmartNegative;
    const kappa = pairedN && pe < 1 ? (po - pe) / (1 - pe) : null;
    let kappaInterpretation = !pairedN ? 'لا توجد أزواج فحص مكتملة' : kappa === null ? 'غير محدد: لا يوجد تباين كافٍ' : 'اتساق مرتفع (تفسير استرشادي)';
    if (kappa !== null && kappa < 0.2) kappaInterpretation = 'اتساق طفيف (Slight Agreement)';
    else if (kappa !== null && kappa < 0.4) kappaInterpretation = 'اتساق مقبول (Fair Agreement)';
    else if (kappa !== null && kappa < 0.6) kappaInterpretation = 'اتساق متوسط (Moderate Agreement)';
    else if (kappa !== null && kappa < 0.8) kappaInterpretation = 'اتساق جوهري عالي (Substantial Agreement)';

    let tp = 0, fp = 0, fn = 0, tn = 0;
    const goldRows = records.filter((record) =>
      binaryFlag(record.Gold_Standard_Confirmed) !== null && hasDocumentedReference(record)
      && getAcuityLogmar(record.Smart_Snellen_OD, record.Smart_LogMAR_OD) !== null
      && getAcuityLogmar(record.Smart_Snellen_OS, record.Smart_LogMAR_OS) !== null
    );
    goldRows.forEach((record) => {
      const smartOD = getAcuityLogmar(record.Smart_Snellen_OD, record.Smart_LogMAR_OD);
      const smartOS = getAcuityLogmar(record.Smart_Snellen_OS, record.Smart_LogMAR_OS);
      // Evaluate digital acuity alone; the composite triage flag also includes exploratory inputs.
      const screen = Math.max(smartOD, smartOS) >= 0.2;
      const gold = binaryFlag(record.Gold_Standard_Confirmed) === 1;
      if (screen && gold) tp++;
      else if (screen) fp++;
      else if (gold) fn++;
      else tn++;
    });

    const percent = (numerator, denominator) => denominator ? +(numerator / denominator * 100).toFixed(1) : null;
    const times = records.filter((record) => Number(record.Paper_Time_Sec) > 0 && Number(record.Smart_Time_Sec) > 0);
    const meanTimeSavedSec = times.length
      ? +(times.reduce((sum, record) => sum + Number(record.Paper_Time_Sec) - Number(record.Smart_Time_Sec), 0) / times.length).toFixed(1)
      : null;

    return {
      totalN: records.length,
      paperCompleteN,
      smartCompleteN,
      pairedN,
      goldEvaluatedN: goldRows.length,
      verifiedRate: records.length ? +(goldRows.length / records.length * 100).toFixed(1) : null,
      timedN: times.length,
      kappa: kappa === null ? null : +kappa.toFixed(3),
      kappaInterpretation,
      observedAgreement: +(po * 100).toFixed(1),
      sensitivity: percent(tp, tp + fn),
      specificity: percent(tn, tn + fp),
      ppv: percent(tp, tp + fp),
      npv: percent(tn, tn + fn),
      tp, fp, fn, tn,
      sensitivityCI95: wilsonInterval95(tp, tp + fn),
      specificityCI95: wilsonInterval95(tn, tn + fp),
      ppvCI95: wilsonInterval95(tp, tp + fp),
      npvCI95: wilsonInterval95(tn, tn + fn),
      bothRefer, paperOnly, smartOnly, bothNormal,
      meanTimeSavedSec,
    };
  }

  function toggleGold(childId) {
    openGoldEditor(childId);
  }

  let editingGoldChildId = null;

  function openGoldEditor(childId) {
    const record = getDB().find(r => r.Child_ID === childId);
    if (!record) return;
    editingGoldChildId = childId;
    document.getElementById('gold-record-id').textContent = childId;
    document.getElementById('gold-status').value = String(record.Gold_Standard_Confirmed ?? 99);
    document.getElementById('gold-method').value = record.Gold_Standard_Method || '';
    document.getElementById('gold-examiner').value = record.Gold_Standard_Examiner_ID || '';
    document.getElementById('gold-date').value = record.Gold_Standard_Date || '';
    document.getElementById('gold-criteria').value = record.Gold_Standard_Criteria || '';
    document.getElementById('gold-masked').value = record.Gold_Standard_Masked || 'UNKNOWN';
    updateGoldReferenceForm();
    document.getElementById('gold-modal').classList.add('open');
    document.getElementById('gold-modal').setAttribute('aria-hidden', 'false');
  }

  function updateGoldReferenceForm() {
    const details = document.getElementById('gold-details');
    if (details) details.style.display = document.getElementById('gold-status').value === '99' ? 'none' : 'grid';
  }

  function closeGoldEditor() {
    editingGoldChildId = null;
    document.getElementById('gold-modal').classList.remove('open');
    document.getElementById('gold-modal').setAttribute('aria-hidden', 'true');
  }

  function saveGoldReference() {
    if (!editingGoldChildId) return;
    const status = document.getElementById('gold-status').value;
    const method = document.getElementById('gold-method').value.trim();
    const examiner = document.getElementById('gold-examiner').value.trim();
    const date = document.getElementById('gold-date').value;
    const criteria = document.getElementById('gold-criteria').value.trim();
    if (status !== '99' && (!method || !examiner || !date || !criteria)) {
      return showToast('أدخل طريقة المرجع ومعياره والفاحص والتاريخ قبل تسجيل النتيجة.', 'error');
    }
    const db = getDB();
    const record = db.find(r => r.Child_ID === editingGoldChildId);
    if (!record) return showToast('لم يعد السجل موجوداً.', 'error');
    record.Gold_Standard_Confirmed = Number(status);
    record.Gold_Standard_Method = status === '99' ? '' : method;
    record.Gold_Standard_Examiner_ID = status === '99' ? '' : examiner;
    record.Gold_Standard_Date = status === '99' ? '' : date;
    record.Gold_Standard_Criteria = status === '99' ? '' : criteria;
    record.Gold_Standard_Masked = status === '99' ? 'UNKNOWN' : document.getElementById('gold-masked').value;
    try {
      localStorage.setItem('albasar_master_records_v3', JSON.stringify(db));
    } catch (e) {
      return showToast('تعذر حفظ التحقق المرجعي في التخزين المحلي.', 'error');
    }
    closeGoldEditor();
    renderTable();
    showToast('حُفظت نتيجة المرجع مع بيانات مصدرها.', 'success');
  }

  function renderTable() {
    const db = getDB();
    const tbody = document.querySelector('#tbl-data tbody');
    if (!tbody) return;

    tbody.replaceChildren();
    if (db.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 11;
      emptyCell.textContent = 'لا توجد سجلات مفحوصة بعد. ابدأ بإدخال بيانات التلاميذ.';
      emptyCell.style.cssText = 'text-align:center; padding:1.5rem; color:#64748b;';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      document.getElementById('db-total').innerText = '0';
      document.getElementById('db-kappa').innerText = 'N/A';
      document.getElementById('db-sens').innerText = '--%';
      document.getElementById('db-spec').innerText = '--%';
      document.getElementById('db-ppv').innerText = 'PPV: --';
      document.getElementById('db-npv').innerText = 'NPV: --';
      document.getElementById('db-time-saved').innerText = 'N/A';
      document.getElementById('db-paired-n').innerText = '0';
      document.getElementById('db-gold-n-sens').innerText = '0';
      document.getElementById('db-gold-n-spec').innerText = '0';
      document.getElementById('db-time-n').innerText = '0';
      document.getElementById('db-sens-ci').innerText = '--';
      document.getElementById('db-spec-ci').innerText = '--';
      document.getElementById('db-ppv-ci').innerText = '--';
      document.getElementById('db-npv-ci').innerText = '--';
      document.getElementById('db-paper-n').innerText = '0';
      document.getElementById('db-smart-n').innerText = '0';
      document.getElementById('db-verified').innerText = '0/0 (0%)';
      return;
    }

    db.forEach(r => {
      const row = document.createElement('tr');
      const addCell = (value, strong = false) => {
        const cell = document.createElement('td');
        const text = String(value ?? '');
        if (strong) {
          const emphasis = document.createElement('strong');
          emphasis.textContent = text;
          cell.appendChild(emphasis);
        } else {
          cell.textContent = text;
        }
        row.appendChild(cell);
        return cell;
      };

      addCell(r.Child_ID, true);
      addCell(r.Examiner_ID);
      const consentCell = addCell(r.Parental_Consent === 1 || r.Parental_Consent === '1' ? 'موقعة' : 'غير موثقة');
      consentCell.style.color = r.Parental_Consent === 1 || r.Parental_Consent === '1' ? '#16a34a' : '#dc2626';
      addCell(String(r.Paper_Snellen_OD ?? '') + ' | ' + String(r.Paper_Snellen_OS ?? ''));
      addCell(String(r.Paper_Time_Sec ?? '') + ' ث');
      addCell(String(r.Smart_Snellen_OD ?? '') + ' | ' + String(r.Smart_Snellen_OS ?? ''));
      addCell(r.Smart_IOD_LogMAR);
      addCell(String(r.Smart_Time_Sec ?? '') + ' ث');
      const hirschVal = parseFloat(r.Hirschberg_Asym_mm) || 0;
      addCell(Math.round(hirschVal * 15) + 'Δ (' + hirschVal + 'mm)');
      const referralCell = document.createElement('td');
      const referralBadge = document.createElement('span');
      const referred = r.Final_Triage_Referral === 1 || r.Final_Triage_Referral === '1';
      referralBadge.className = referred ? 'tag-ref' : 'tag-ok';
      referralBadge.textContent = referred ? 'مراجعة (1)' : 'لا إشارة (0)';
      referralCell.appendChild(referralBadge);
      row.appendChild(referralCell);

      const referenceCell = document.createElement('td');
      const referenceButton = document.createElement('button');
      referenceButton.type = 'button';
      referenceButton.style.cssText = 'background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:3px 8px; font-size:0.75rem; cursor:pointer;';
      referenceButton.title = 'أدخل نتيجة المرجع مع بيانات الطريقة والمعيار والفاحص والتاريخ';
      const goldValue = Number(r.Gold_Standard_Confirmed);
      const documented = hasDocumentedReference(r);
      referenceButton.textContent = goldValue === 1 ? (documented ? 'إيجابي موثق' : 'إيجابي قديم؛ بيانات المرجع ناقصة')
        : goldValue === 0 ? (documented ? 'سلبي موثق' : 'سلبي قديم؛ بيانات المرجع ناقصة')
          : 'غير متحقق (99) — إدخال التفاصيل';
      referenceButton.addEventListener('click', () => toggleGold(String(r.Child_ID ?? '')));
      referenceCell.appendChild(referenceButton);
      row.appendChild(referenceCell);
      tbody.appendChild(row);
    });

    const metrics = calculateDiagnosticMetrics(db);
    document.getElementById('db-total').innerText = String(metrics.totalN);
    const kappaLabel = metrics.kappa === null ? 'N/A' : metrics.kappa.toFixed(3);
    document.getElementById('db-kappa').textContent = kappaLabel;
    document.getElementById('db-sens').innerText = metrics.sensitivity === null ? '--%' : metrics.sensitivity + '%';
    document.getElementById('db-spec').innerText = metrics.specificity === null ? '--%' : metrics.specificity + '%';
    document.getElementById('db-ppv').innerText = 'PPV: ' + (metrics.ppv === null ? '--%' : metrics.ppv + '%');
    document.getElementById('db-npv').innerText = 'NPV: ' + (metrics.npv === null ? '--%' : metrics.npv + '%');
    const formatCI = (interval) => interval ? interval[0] + '–' + interval[1] + '%' : '--';
    document.getElementById('db-sens-ci').innerText = formatCI(metrics.sensitivityCI95);
    document.getElementById('db-spec-ci').innerText = formatCI(metrics.specificityCI95);
    document.getElementById('db-ppv-ci').innerText = formatCI(metrics.ppvCI95);
    document.getElementById('db-npv-ci').innerText = formatCI(metrics.npvCI95);
    document.getElementById('db-time-saved').innerText = metrics.meanTimeSavedSec === null ? 'N/A' : metrics.meanTimeSavedSec.toFixed(1) + ' ث';
    document.getElementById('db-paired-n').innerText = String(metrics.pairedN);
    document.getElementById('db-gold-n-sens').innerText = String(metrics.goldEvaluatedN);
    document.getElementById('db-gold-n-spec').innerText = String(metrics.goldEvaluatedN);
    document.getElementById('db-time-n').innerText = String(metrics.timedN);
    document.getElementById('db-paper-n').innerText = String(metrics.paperCompleteN);
    document.getElementById('db-smart-n').innerText = String(metrics.smartCompleteN);
    document.getElementById('db-verified').innerText = String(metrics.goldEvaluatedN) + '/' + String(metrics.totalN) + ' (' + (metrics.verifiedRate === null ? 0 : metrics.verifiedRate) + '%)';
  }

  function exportMasterCSV() {
    const db = getDB();
    if (!db.length) return showToast('لا توجد سجلات لتصديرها بعد.');
    const cols = MASTER_RECORD_COLUMNS;
    const rows = db.map(r => cols.map(c => csvCell(r[c])).join(','));
    const csvStr = '\\uFEFF' + cols.join(',') + '\\n' + rows.join('\\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = \`AlBasar_MasterRecords_\${new Date().toISOString().slice(0,10)}.csv\`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportMasterJSON() {
    const db = getDB();
    if (!db.length) return showToast('لا توجد سجلات لنسخها احتياطياً.');
    const backup = { application: 'Al-Basar AI', schemaVersion: 3, exportedAt: new Date().toISOString(), records: db };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'AlBasar_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function normalizeId(value) { return String(value || '').trim().toLocaleUpperCase(); }

  function stableSerialize(value) {
    if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';
    }
    return JSON.stringify(value) ?? 'null';
  }

  function validateBackupRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    if (typeof record.Child_ID !== 'string' || !normalizeId(record.Child_ID) || record.Child_ID.length > 64) return false;
    if (!Array.isArray(MASTER_RECORD_COLUMNS) || !record.Examination_Date || Number.isNaN(Date.parse(record.Examination_Date))) return false;
    return ['Paper_Snellen_OD', 'Paper_Snellen_OS', 'Smart_Snellen_OD', 'Smart_Snellen_OS'].every(key => typeof record[key] === 'string' && record[key].length <= 40);
  }

  async function importMasterBackup(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 25000000) throw new Error('حجم ملف النسخة الاحتياطية يتجاوز 25 ميغابايت.');
      const parsed = JSON.parse(await file.text());
      const incomingRaw = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.records) ? parsed.records : null;
      if (!incomingRaw) throw new Error('لم يُعثر على قائمة سجلات في ملف JSON.');
      if (incomingRaw.some(record => !validateBackupRecord(record))) throw new Error('يتضمن الملف سجلاً غير مكتمل أو غير صالح؛ لم يُدمج شيء.');

      const current = getDB();
      const currentById = new Map();
      const conflicts = new Set();
      current.forEach(record => {
        const key = normalizeId(record.Child_ID);
        const prior = currentById.get(key);
        if (prior && stableSerialize(prior) !== stableSerialize(record)) conflicts.add(String(record.Child_ID));
        else if (!prior) currentById.set(key, record);
      });

      const incomingById = new Map();
      const additions = [];
      let duplicates = 0;
      incomingRaw.map(normalizeMasterRecord).forEach(record => {
        const key = normalizeId(record.Child_ID);
        const previousImport = incomingById.get(key);
        if (previousImport) {
          if (stableSerialize(previousImport) === stableSerialize(record)) duplicates++;
          else conflicts.add(String(record.Child_ID));
          return;
        }
        incomingById.set(key, record);
        const previousLocal = currentById.get(key);
        if (!previousLocal) additions.push(record);
        else if (stableSerialize(previousLocal) === stableSerialize(record)) duplicates++;
        else conflicts.add(String(record.Child_ID));
      });

      if (conflicts.size) throw new Error('تعارض في معرفات المشاركين: ' + Array.from(conflicts).slice(0, 8).join('، ') + '. لم تُدمج أي بيانات؛ راجع السجلات يدوياً.');
      if (!additions.length) return showToast('لا توجد سجلات جديدة. تم تجاوز ' + duplicates + ' نسخة مطابقة.');
      const accepted = await requestConfirmation('مراجعة دمج النسخة', 'ستُضاف ' + additions.length + ' سجلات جديدة، وستُتجاوز ' + duplicates + ' سجلات مطابقة. لم يظهر تعارض في المعرفات. هل تريد المتابعة؟');
      if (!accepted) return;
      const merged = additions.concat(current);
      localStorage.setItem('albasar_master_records_v3', JSON.stringify(merged));
      renderTable();
      showToast('اكتمل الدمج: أضيف ' + additions.length + ' سجل محلياً.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر استيراد النسخة الاحتياطية.', 'error');
    }
  }

  function wipeLocalDB() {
    requestConfirmation('حذف السجلات المحلية؟', 'سيؤدي هذا إلى حذف جميع السجلات من هذا المتصفح، ولا يمكن التراجع عن ذلك.').then((accepted) => {
      if (!accepted) return;
      localStorage.removeItem('albasar_master_records_v3');
      renderTable();
      showToast('حُذفت السجلات من هذا المتصفح.', 'success');
    });
  }

  const SUS_TEXTS = [
    "1. أرغب في استخدام هذه المنظومة في الفرز البصري المدرسي بشكل دوري.",
    "2. وجدت خطوات الفحص في النظام معقدة دون مسوغ سريري.",
    "3. وجدت أن واجهة المنظومة سهلة الاستخدام وسلسة أثناء التواجد في الصف.",
    "4. أحتاج إلى دعم تقني متخصص لتشغيل المنظومة داخل المدرسة.",
    "5. وظائف المنظومة (المعايرة، فحص النظر، وتوليد بطاقة الأم) متكاملة بشكل متناسق.",
    "6. شعرت بوجود تضارب أو عدم اتساق أثناء التعامل مع النظام.",
    "7. أتصور أن ممرضي وممرضات الصحة المدرسية سيتقنون استخدام المنظومة في وقت وجيز.",
    "8. كان استخدام التطبيق مجهداً أو مربكاً عند التعامل مع أطفال الصف الأول الابتدائي.",
    "9. شعرت باطمئنان مهني وثقة سريرية أثناء توجيه التلاميذ للإحالة.",
    "10. توجب عليّ استيعاب مفاهيم برمجية كثيرة قبل التمكن من بدء الفحص الميداني."
  ];

  function buildSUS() {
    const box = document.getElementById('sus-container');
    if (!box) return;
    box.replaceChildren();
    SUS_TEXTS.forEach((question, index) => {
      const group = document.createElement('div');
      group.className = 'form-group';
      group.style.marginBottom = '0.75rem';
      const label = document.createElement('label');
      label.style.cssText = 'font-weight:600; font-size:0.85rem; color:#334155;';
      label.textContent = question;
      const select = document.createElement('select');
      select.id = 'sus-item-' + (index + 1);
      select.className = 'form-control';
      const options = [
        ['', 'اختر إجابة'], ['1', '1 - لا أوافق بشدة'], ['2', '2 - لا أوافق'],
        ['3', '3 - محايد'], ['4', '4 - أوافق'], ['5', '5 - أوافق بشدة'],
      ];
      options.forEach(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      });
      select.addEventListener('change', calcSUS);
      group.append(label, select);
      box.appendChild(group);
    });
    calcSUS();
    renderSUSTable();
  }

  function calcSUS() {
    let sum = 0;
    for (let i = 1; i <= 10; i++) {
      const el = document.getElementById('sus-item-' + i);
      const v = el ? parseInt(el.value, 10) : NaN;
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        const resEl = document.getElementById('lbl-sus-current');
        if (resEl) resEl.innerText = 'أكمل البنود العشرة لحساب الدرجة';
        return null;
      }
      sum += (i % 2 === 1) ? (v - 1) : (5 - v);
    }
    const score = (sum * 2.5).toFixed(1);

    const resEl = document.getElementById('lbl-sus-current');
    if (resEl) {
      resEl.innerText = \`الدرجة الوصفية الحالية: \${score} / 100\`;
    }
    return parseFloat(score);
  }

  function getSUSDB() {
    const raw = localStorage.getItem('albasar_sus_evaluations_v3');
    if (raw) {
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
    }
    return [];
  }

  function saveSUSEvaluation() {
    const evalId = document.getElementById('sus-eval-id').value.trim();
    const evalName = document.getElementById('sus-eval-name').value.trim();
    const center = document.getElementById('sus-eval-center').value;
    const role = document.getElementById('sus-eval-role').value;

    const score = calcSUS();
    if (!evalId || !evalName || score === null) {
      return showToast('أدخل كود الفاحص واسمه وأجب عن البنود العشرة قبل حفظ التقييم.', 'error');
    }
    const grade = 'درجة وصفية؛ دون عتبات تفسير محلية موثقة';

    const answers = [];
    for (let i = 1; i <= 10; i++) {
      const el = document.getElementById('sus-item-' + i);
      answers.push(el ? parseInt(el.value, 10) : 3);
    }

    const record = {
      evaluationId: "SUS-EV-" + Date.now(),
      evaluatorId: evalId,
      nurseName: evalName,
      phccCenter: center,
      roleTitle: role,
      experienceYears: '',
      evaluatedAt: new Date().toISOString(),
      qAnswers: answers,
      susScore: score,
      susGrade: grade
    };

    const list = getSUSDB();
    list.push(record);
    localStorage.setItem('albasar_sus_evaluations_v3', JSON.stringify(list));
    showToast("حُفظ التقييم محلياً.", 'success');
    renderSUSTable();
  }

  function renderSUSTable() {
    const list = getSUSDB();
    const tbody = document.querySelector('#tbl-sus tbody');
    if (!tbody) return;

    tbody.replaceChildren();
    if (list.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'لا توجد تقييمات مسجلة بعد. أكمل الاستبانة أعلاه واضغط حفظ التوثيق.';
      cell.style.cssText = 'text-align:center; padding:1.25rem; color:#64748b;';
      row.appendChild(cell);
      tbody.appendChild(row);
      const mEl = document.getElementById('lbl-sus-mean');
      if (mEl) mEl.innerText = "-- ± --";
      const cEl = document.getElementById('lbl-sus-count');
      if (cEl) cEl.innerText = "0";
      const gEl = document.getElementById('lbl-sus-grade');
      if (gEl) gEl.innerText = "--";
      return;
    }

    list.forEach(ev => {
      const row = document.createElement('tr');
      const addCell = (value, strong = false) => {
        const cell = document.createElement('td');
        if (strong) {
          const emphasis = document.createElement('strong');
          emphasis.textContent = String(value ?? '');
          cell.appendChild(emphasis);
        } else {
          cell.textContent = String(value ?? '');
        }
        row.appendChild(cell);
      };
      addCell(ev.evaluatorId, true);
      addCell(ev.nurseName);
      addCell(ev.phccCenter);
      addCell(ev.roleTitle || 'ممرض فاحص');
      addCell(ev.susScore, true);
      const statusCell = document.createElement('td');
      const status = document.createElement('span');
      status.className = 'tag-ok';
      status.textContent = 'درجة وصفية';
      statusCell.appendChild(status);
      row.appendChild(statusCell);
      tbody.appendChild(row);
    });

    const scores = list.map(x => x.susScore);
    const mean = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const variance = scores.length > 1
      ? scores.reduce((a, b) => a + Math.pow(b - Number(mean), 2), 0) / (scores.length - 1)
      : null;
    const sd = variance === null ? '--' : Math.sqrt(variance).toFixed(1);

    const mEl = document.getElementById('lbl-sus-mean');
    if (mEl) mEl.innerText = \`\${mean} ± \${sd}\`;
    const cEl = document.getElementById('lbl-sus-count');
    if (cEl) cEl.innerText = list.length;
    const gEl = document.getElementById('lbl-sus-grade');
    if (gEl) {
      gEl.innerText = 'درجة وصفية؛ لا توجد عتبة قبول في هذه النسخة';
    }
  }

  function exportSUSCSV() {
    const list = getSUSDB();
    if (!list.length) return showToast('لا توجد تقييمات محفوظة للتصدير بعد.');

    const headers = [
      "Evaluation_ID", "Evaluator_ID", "Nurse_Name", "PHCC_Center", "Role_Title", "Experience_Years",
      "Evaluation_Date", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10",
      "SUS_Score", "Interpretation"
    ];

    const rows = list.map(ev => [
      csvCell(ev.evaluationId),
      csvCell(ev.evaluatorId),
      csvCell(ev.nurseName),
      csvCell(ev.phccCenter),
      csvCell(ev.roleTitle || ''),
      ev.experienceYears || '',
      csvCell(ev.evaluatedAt),
      ...ev.qAnswers,
      ev.susScore,
      csvCell('درجة وصفية؛ لا توجد عتبات محلية موثقة')
    ].join(','));

    const csvContent = '\\uFEFF' + headers.join(',') + '\\n' + rows.join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = \`AlBasar_Usability_Evaluations_\${new Date().toISOString().slice(0,10)}.csv\`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const savedPPM = localStorage.getItem('albasar_ppm_v3');
    if (savedPPM) {
      pxPerMM = parseFloat(savedPPM);
      const px = Math.round(pxPerMM * activeCalibRefMM);
      document.getElementById('rng-px').value = px;
      adjustCalibration(px, false);
    } else {
      adjustCalibration(324, false);
    }
    buildSUS();
    if (localStorage.getItem('albasar_master_records_v3') !== null) {
      localStorage.setItem('albasar_master_records_v3', JSON.stringify(getDB()));
    }
    renderTable();
    updateStationIsolation();
    runSyntheticOcularCaliper();
    document.addEventListener('input', updateStationIsolation);
    document.addEventListener('change', updateStationIsolation);
  });
</script>
</body>
</html>`;
}
