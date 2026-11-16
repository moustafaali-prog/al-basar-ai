import React from 'react';
import { Ruler, CreditCard, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { CalibrationData } from '../types';
import { SNELLEN_LADDER } from '../utils/acuityMath';

interface CalibrationModuleProps {
  calibration: CalibrationData;
  onUpdateCalibration: (data: CalibrationData) => void;
}

export const CalibrationModule: React.FC<CalibrationModuleProps> = ({
  calibration,
  onUpdateCalibration,
}) => {
  const isCard = calibration.referenceType === 'CARD_85_6';
  const refMM = isCard ? 85.60 : 50.00;
  const testingDistance = calibration.testingDistanceMeters ?? 2.0;

  const handleSliderChange = (newPixelWidth: number) => {
    const pxPerMM = +(newPixelWidth / refMM).toFixed(3);
    const estimatedDPI = Math.round(pxPerMM * 25.4);
    const updated: CalibrationData = {
      ...calibration,
      sliderPixelWidth: newPixelWidth,
      pxPerMM,
      estimatedDPI,
      lastCalibratedDate: new Date().toISOString(),
      isCalibrated: true,
    };
    onUpdateCalibration(updated);
  };

  const handleDistanceChange = (meters: number) => {
    onUpdateCalibration({
      ...calibration,
      testingDistanceMeters: meters,
      lastCalibratedDate: '',
      isCalibrated: false,
    });
  };

  const handleSwitchReference = (type: 'CARD_85_6' | 'RULER_50') => {
    const newRefMM = type === 'CARD_85_6' ? 85.60 : 50.00;
    // Keep pxPerMM steady and adjust the pixel width for that reference
    const newWidth = Math.round(calibration.pxPerMM * newRefMM);
    const updated: CalibrationData = {
      ...calibration,
      referenceType: type,
      referenceLengthMM: newRefMM,
      sliderPixelWidth: newWidth,
      lastCalibratedDate: '',
      isCalibrated: false,
    };
    onUpdateCalibration(updated);
  };

  const handleResetDefault = () => {
    // This is a mathematical starting estimate only; it is not a physical calibration.
    const defaultPx = Math.round(3.78 * refMM);
    onUpdateCalibration({
      ...calibration,
      sliderPixelWidth: defaultPx,
      pxPerMM: +(defaultPx / refMM).toFixed(3),
      estimatedDPI: Math.round((defaultPx / refMM) * 25.4),
      lastCalibratedDate: '',
      isCalibrated: false,
    });
  };

  return (
    <section className="admin-card">
      <div className="card-head">
        <div>
          <h2 className="card-head__title">
            <Ruler size={19} aria-hidden="true" />
            ضبط حجم الرموز على الشاشة
          </h2>
          <p className="card-head__sub">
            اضبط عرض المرجع على الشاشة باستخدام مسطرة فعلية، ثم استخدم الجهاز والمسافة المحددين في بروتوكول الدراسة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="segmented" role="group" aria-label="مسافة الفحص">
            <button type="button" className={`segmented__btn ${testingDistance===2 ? 'is-active' : ''}`} onClick={()=>handleDistanceChange(2)}>2.0 m</button>
            <button type="button" className={`segmented__btn ${testingDistance===3 ? 'is-active' : ''}`} onClick={()=>handleDistanceChange(3)}>3.0 m WHO 2025</button>
          </div>
          <span className="pill pill--primary">مسافة الفحص: {testingDistance.toFixed(1)} m</span>
        </div>
      </div>

      <div className="notice notice--warn items-start mb-4">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <strong className="block font-extrabold">تحقق من الحجم على الجهاز المستخدم قبل جمع البيانات:</strong>
          <p className="mt-1">
            القيمة الافتراضية تقديرية وليست معايرة. ضع المرجع المادي المحدد أدناه أمام الشاشة واضبط العرض حتى يطابق طوله الفعلي. كرر ذلك بعد تغيير الجهاز أو إعدادات العرض.
          </p>
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <div className="segmented segmented--wrap" role="group" aria-label="نوع المرجع المادي">
          <button
            type="button"
            onClick={() => handleSwitchReference('CARD_85_6')}
            className="segmented__btn"
            aria-pressed={isCard}
          >
            <CreditCard size={15} aria-hidden="true" />
            البطاقة القياسية · <span dir="ltr">85.6 mm</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchReference('RULER_50')}
            className="segmented__btn"
            aria-pressed={!isCard}
          >
            <Ruler size={15} aria-hidden="true" />
            مسطرة مليمترية · <span dir="ltr">50 mm</span>
          </button>
        </div>
      </div>

      <div className="calibration-stage mb-3">
        <p className="field-hint">ضع المرجع المادي هنا وطابق الحواف بدقة:</p>
        <div
          style={{ width: `${calibration.sliderPixelWidth}px` }}
          className="calibration-bar"
        >
          <span className="opacity-75" aria-hidden="true">◀</span>
          <div className="text-center">
            <div dir="ltr">{refMM.toFixed(2)} mm</div>
            <div className="text-[10px] font-normal text-blue-100" dir="ltr">
              {calibration.sliderPixelWidth} px · {calibration.pxPerMM} px/mm
            </div>
          </div>
          <span className="opacity-75" aria-hidden="true">▶</span>
        </div>
        <p className="field-hint text-center">إذا كان المرجع أوسع من الشاشة، اسحبه أفقياً للمقارنة.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center mb-4">
        <button
          type="button"
          onClick={() => handleSliderChange(calibration.sliderPixelWidth - 1)}
          className="m3-btn m3-btn--outline m3-btn--sm"
          title="تقليص 1 بكسل"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => handleSliderChange(calibration.sliderPixelWidth + 1)}
          className="m3-btn m3-btn--outline m3-btn--sm"
          title="زيادة 1 بكسل"
        >
          +1
        </button>
        <button
          type="button"
          onClick={handleResetDefault}
          className="m3-btn m3-btn--ghost m3-btn--sm"
        >
          <RotateCcw size={13} aria-hidden="true" />
          استخدام تقدير ابتدائي غير معاير
        </button>
      </div>

      <div className="max-w-xl mx-auto mb-4">
        <div className="flex justify-between items-center gap-2 text-[12px] font-bold text-[var(--m3-text-soft)] mb-2">
          <span>العرض بالبكسل: <strong className="text-[var(--m3-primary)] font-mono" dir="ltr">{calibration.sliderPixelWidth} px</strong></span>
          <span>معامل التحويل: <strong className="text-[var(--m3-pass)] font-mono" dir="ltr">{calibration.pxPerMM} px/mm</strong></span>
        </div>
        <input
          type="range"
          min={120}
          max={750}
          value={calibration.sliderPixelWidth}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="m3-range"
          aria-label="عرض المرجع بالبكسل"
        />
        <div className="flex justify-between text-[10px] text-[var(--m3-muted)] mt-1">
          <span>120 px · شاشات منخفضة الكثافة</span>
          <span>750 px · شاشات فائقة الدقة</span>
        </div>
      </div>

      <div className="admin-stats mb-4">
        <div className="admin-stat">
          <strong className="text-[var(--m3-primary-strong)]" dir="ltr">{calibration.pxPerMM}</strong>
          <span>معامل البكسل لكل ملم</span>
        </div>
        <div className="admin-stat">
          <strong className="text-[var(--m3-primary-strong)]" dir="ltr">{calibration.estimatedDPI} DPI</strong>
          <span>مكافئ DPI الحسابي</span>
        </div>
        <div className="admin-stat">
          <strong className="text-[var(--m3-pass)]" dir="ltr">{Math.round(testingDistance * 1000)} mm</strong>
          <span>مسافة الفحص السريري</span>
        </div>
        <div className="admin-stat">
          <strong className="text-[var(--m3-warn)]" dir="ltr">5.0&apos; Arcmin</strong>
          <span>الزاوية البصرية لـ 6/6</span>
        </div>
      </div>

      <div className="admin-table-wrap mb-4">
        <div className="admin-table-head">
          <span className="section-title text-[13px]">أحجام الرموز النظرية عند مسافة العرض المحددة</span>
          <span className="field-hint" dir="ltr">h = {(2.9089 * (testingDistance / 2.0)).toFixed(4)} × 10^LogMAR</span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>مستوى سنيلين</th>
                <th>قيمة LogMAR</th>
                <th>الارتفاع الفيزيائي الحقيقي</th>
                <th>العرض على شاشتك الحالية</th>
                <th>ملاحظة القياس</th>
              </tr>
            </thead>
            <tbody>
              {SNELLEN_LADDER.map((step) => {
                const physicalMM = step.mm * (testingDistance / 2.0);
                const renderedPx = Math.round(physicalMM * calibration.pxPerMM);
                return (
                  <tr key={step.snellen}>
                    <td className="cell-strong text-[var(--m3-primary)]">{step.snellen}</td>
                    <td>{step.logmar.toFixed(2)}</td>
                    <td className="cell-strong">{physicalMM.toFixed(2)} mm</td>
                    <td className="cell-pass">{renderedPx} px</td>
                    <td className="cell-muted">
                      {step.snellen === '6/6' ? 'قيمة مرجعية في سلم العرض' : step.snellen === '6/12' ? 'حد الإحالة وفق WHO 2025 (LogMAR 0.30)' : 'قيمة سلم؛ لا تمثل تشخيصاً منفردة'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`pill ${calibration.isCalibrated ? 'pill--pass' : 'pill--warn'}`}>
          {calibration.isCalibrated ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
          {calibration.isCalibrated ? 'تم حفظ الضبط محلياً' : 'ضبط تقديري غير متحقق'}
        </span>
        <span className="field-hint">
          {calibration.lastCalibratedDate
            ? `آخر ضبط: ${new Date(calibration.lastCalibratedDate).toLocaleString('ar-IQ')}`
            : 'لا يوجد ضبط مادي مسجل'}
        </span>
      </div>
    </section>
  );
};
