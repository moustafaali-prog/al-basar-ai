import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Play,
  QrCode,
  RefreshCw,
  Square,
  UserCheck,
} from 'lucide-react';
import { UNTESTABLE_ACUITY_LABEL } from '../utils/acuityMath';
import { defaultAgeForGrade, readSessionContext, writeSessionContext } from '../utils/sessionContext';
import { QRScannerModal, ScannedStudentData } from './QRScannerModal';
import { WashoutTimer } from './WashoutTimer';
import { WHOPreScreenDraft } from '../types';

interface RegistrationProps {
  childId: string;
  setChildId: (id: string) => void;
  childName: string;
  setChildName: (name: string) => void;
  examinerId: string;
  setExaminerId: (id: string) => void;
  parentalConsent: number;
  setParentalConsent: (val: number) => void;
  schoolName: string;
  setSchoolName: (name: string) => void;
  schoolSector: string;
  setSchoolSector: (sector: string) => void;
  gradeLevel: number;
  setGradeLevel: (grade: number) => void;
  ageYears: number;
  setAgeYears: (age: number) => void;
  gender: string;
  setGender: (gender: string) => void;
  wearsGlasses: number;
  setWearsGlasses: (val: number) => void;
  whoPreScreen: WHOPreScreenDraft;
  setWHOPreScreen: (value: WHOPreScreenDraft) => void;
  crossoverSequence: string;
  setCrossoverSequence: (seq: string) => void;
  paperExaminerId: string;
  setPaperExaminerId: (id: string) => void;
  /** The signed-in examiner on duty — pre-fills the paper-station examiner id. */
  examinerName?: string;
  /** The second examiner (dual-examiner blinding) — one-tap swap at the station. */
  alternateExaminerId?: string;
  /** Editable second-examiner id (dual-examiner blinding). */
  setAlternateExaminerId?: (id: string) => void;
  onPaperTestStarted: () => void;
  showPaperStation: boolean;
  isDigitalFirst: boolean;
  sequenceLocked: boolean;
  smartCompleted: boolean;
  identityLocked: boolean;
  stationReady: boolean;
  paperStationStarted: boolean;
  paperOd: string;
  setPaperOd: (val: string) => void;
  paperOs: string;
  setPaperOs: (val: string) => void;
  paperTimeSec: number;
  setPaperTimeSec: (sec: number) => void;
  referralPHCC: string;
  setReferralPHCC: (val: string) => void;
  onProceedToSmartStation: () => void;
  onGenerateNextId: () => void;
  /** Notifies the host app when the QR scanner overlay opens/closes (Android back button). */
  onQRScannerOpenChange?: (open: boolean) => void;
  /** Incremented by the host app to force-close the scanner (hardware back button). */
  qrScannerCloseSignal?: number;
}

interface YesNoPillsProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  allowUnknown?: boolean;
  unknownLabel?: string;
}

const YesNoPills: React.FC<YesNoPillsProps> = ({
  label,
  hint,
  value,
  onChange,
  allowUnknown = false,
  unknownLabel = 'لا أعلم',
}) => (
  <div className="prescreen-row">
    <div>
      <div className="prescreen-row__label">{label}</div>
      {hint && <div className="prescreen-row__hint">{hint}</div>}
    </div>
    <div className="choice-pills">
      <button type="button" className="choice-pill" data-tone="pass" aria-pressed={value === 'YES'} onClick={() => onChange('YES')}>
        نعم
      </button>
      <button type="button" className="choice-pill" data-tone="warn" aria-pressed={value === 'NO'} onClick={() => onChange('NO')}>
        لا
      </button>
      {allowUnknown && (
        <button type="button" className="choice-pill" aria-pressed={value === 'UNKNOWN'} onClick={() => onChange('UNKNOWN')}>
          {unknownLabel}
        </button>
      )}
    </div>
  </div>
);

const GRADE_CHOICES = [
  { grade: 1, age: 6, label: 'الصف 1' },
  { grade: 2, age: 7, label: 'الصف 2' },
  { grade: 3, age: 8, label: 'الصف 3' },
  { grade: 4, age: 9, label: 'الصف 4' },
  { grade: 5, age: 10, label: 'الصف 5' },
  { grade: 6, age: 11, label: 'الصف 6' },
] as const;

const AGE_CHOICES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

/** Five chips per row: 6/6 → 6/18 then 6/24 → code 88. */
const PAPER_ACUITY_CHOICES = [
  '6/6',
  '6/7.5',
  '6/9.5',
  '6/12',
  '6/18',
  '6/24',
  '6/36',
  '6/60',
  'أقل من 6/60',
  UNTESTABLE_ACUITY_LABEL,
] as const;

const HEALTHY_PRE_SCREEN: WHOPreScreenDraft = {
  childAssent: 'YES',
  diabetes: 'NO',
  eyePainOrSevereItch: 'NO',
  parentVisionConcern: 'NO',
  parentHearingConcern: 'NO',
  teacherVisionConcern: 'NO',
  learningConcern: 'NO',
  spectacles: 'NONE',
  hearingAids: 'NO',
};

/**
 * A pre-screen is "healthy" when every symptom/history flag is negative.
 * The spectacles flag is a *history* flag, not a symptom: a child who wears
 * distance glasses is still healthy, so the value is accepted when it agrees
 * with the participant record (`wearsGlasses`).
 */
const isHealthyPreScreen = (value: WHOPreScreenDraft, wearsGlasses: number): boolean =>
  value.childAssent === 'YES' &&
  value.diabetes === 'NO' &&
  value.eyePainOrSevereItch === 'NO' &&
  value.parentVisionConcern === 'NO' &&
  value.parentHearingConcern === 'NO' &&
  value.teacherVisionConcern === 'NO' &&
  value.learningConcern === 'NO' &&
  (
    value.spectacles === 'NONE' ||
    (wearsGlasses === 1 && value.spectacles === 'DISTANCE')
  ) &&
  value.hearingAids === 'NO';

interface PaperAcuityGridProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const PaperAcuityGrid: React.FC<PaperAcuityGridProps> = ({ label, value, onChange, disabled }) => (
  <div className="paper-eye">
    <div className="paper-eye__head">
      <strong>{label}</strong>
      <span className="paper-eye__value">{value || 'لم تُسجّل'}</span>
    </div>
    <div className="snellen-grid" role="group" aria-label={`حدة البصر الورقية — ${label}`}>
      {PAPER_ACUITY_CHOICES.map((option) => {
        const isUntestable = option === UNTESTABLE_ACUITY_LABEL;
        return (
          <button
            key={option}
            type="button"
            className={`snellen-chip${isUntestable ? ' snellen-chip--untestable' : ''}`}
            aria-pressed={value === option}
            disabled={disabled}
            onClick={() => onChange(option)}
            title={option}
          >
            <strong>{isUntestable ? '88' : option}</strong>
            {isUntestable && <small>غير قابل للفحص</small>}
          </button>
        );
      })}
    </div>
  </div>
);

export const RegistrationAndPaperStation: React.FC<RegistrationProps> = ({
  childId,
  setChildId,
  childName,
  setChildName,
  examinerId,
  setExaminerId,
  parentalConsent,
  setParentalConsent,
  schoolName,
  setSchoolName,
  schoolSector,
  setSchoolSector,
  gradeLevel,
  setGradeLevel,
  ageYears,
  setAgeYears,
  gender,
  setGender,
  wearsGlasses,
  setWearsGlasses,
  whoPreScreen,
  setWHOPreScreen,
  crossoverSequence,
  setCrossoverSequence,
  paperExaminerId,
  setPaperExaminerId,
  examinerName,
  alternateExaminerId,
  setAlternateExaminerId,
  onPaperTestStarted,
  showPaperStation,
  isDigitalFirst,
  sequenceLocked,
  smartCompleted,
  identityLocked,
  stationReady,
  paperStationStarted,
  paperOd,
  setPaperOd,
  paperOs,
  setPaperOs,
  paperTimeSec,
  setPaperTimeSec,
  referralPHCC,
  setReferralPHCC,
  onProceedToSmartStation,
  onGenerateNextId,
  onQRScannerOpenChange,
  qrScannerCloseSignal,
}) => {
  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [preScreenOpen, setPreScreenOpen] = useState(false);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(
    () => !schoolName || !schoolSector || !examinerId,
  );

  /**
   * Keeps the host app's hardware-back overlay stack in sync: the Android
   * back button must close the QR scanner instead of leaving the app.
   */
  const openQRScanner = () => {
    setIsQRScannerOpen(true);
    onQRScannerOpenChange?.(true);
  };
  const closeQRScanner = () => {
    setIsQRScannerOpen(false);
    onQRScannerOpenChange?.(false);
  };
  useEffect(() => {
    return () => {
      if (isQRScannerOpen) onQRScannerOpenChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQRScannerOpen]);

  // The host app can force the scanner shut (Android hardware back button).
  useEffect(() => {
    if (!qrScannerCloseSignal) return;
    closeQRScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrScannerCloseSignal]);

  useEffect(() => {
    // Merge with the latest context so a mounted Step 1 never clears the smart
    // examiner ID that App.tsx captured at the digital station.
    const latest = readSessionContext();
    writeSessionContext({
      schoolName,
      schoolSector,
      referralPHCC,
      examinerId,
      paperExaminerId,
      smartExaminerId: latest.smartExaminerId,
      alternateExaminerId: latest.alternateExaminerId,
      gradeLevel,
    });
  }, [schoolName, schoolSector, referralPHCC, examinerId, paperExaminerId, gradeLevel]);

  /**
   * Pre-fill the paper-station examiner from the signed-in profile.
   * An explicit choice is never overwritten (dual-examiner blinding).
   */
  useEffect(() => {
    if (paperExaminerId) return;
    const fallback = (examinerName || '').trim();
    if (fallback) setPaperExaminerId(fallback);
  }, [examinerName, paperExaminerId, setPaperExaminerId]);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        setPaperTimeSec(+elapsed.toFixed(1));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning, startTime, setPaperTimeSec]);

  const togglePaperTimer = () => {
    if (!timerRunning) {
      setStartTime(performance.now() - paperTimeSec * 1000);
      setTimerRunning(true);
      onPaperTestStarted();
    } else {
      setTimerRunning(false);
    }
  };

  /**
   * Tapping any Snellen chip starts the paper station automatically.
   *
   * The examiner must never be blocked by a forgotten "Start" button: the tap on
   * an acuity line IS the start of the paper measurement, so the timer is armed
   * and `onPaperTestStarted()` is called to stamp `paperStartedAt`/`paperCompletedAt`
   * in App.tsx. The duration is seeded with a small positive offset so the saved
   * `Paper_Time_Sec` is always a valid (> 0) number even when the examiner taps
   * Start manually a moment later.
   */
  const handlePaperAcuityChange = (eye: 'OD' | 'OS', value: string) => {
    if (!timerRunning) {
      setStartTime(performance.now() - Math.max(paperTimeSec, 0.3) * 1000);
      setTimerRunning(true);
      onPaperTestStarted();
    }
    if (eye === 'OD') setPaperOd(value);
    else setPaperOs(value);
  };

  const resetPaperTimer = () => {
    setTimerRunning(false);
    setPaperTimeSec(0);
  };

  const setPreScreenValue = <K extends keyof WHOPreScreenDraft>(key: K, value: WHOPreScreenDraft[K]) => {
    setWHOPreScreen({ ...whoPreScreen, [key]: value });
  };

  const healthyPreScreenApplied = parentalConsent === 1 && isHealthyPreScreen(whoPreScreen, wearsGlasses);

  /**
   * Speed path for a well child: one tap records consent, assent, and all
   * healthy WHO pre-screen answers. Every answer remains editable afterwards.
   *
   * The spectacles answer is derived from the participant's own record so the
   * SPSS export can never contradict itself: a child recorded as wearing
   * glasses is marked "DISTANCE" spectacles, never "NONE".
   */
  const applyHealthyPreScreen = () => {
    setParentalConsent(1);
    setWHOPreScreen({
      ...HEALTHY_PRE_SCREEN,
      spectacles: wearsGlasses === 1 ? 'DISTANCE' : 'NONE',
    });
    setPreScreenOpen(false);
  };

  const handleQRScanSuccess = (data: ScannedStudentData, rawText: string) => {
    if (data.childId) setChildId(data.childId);
    if (data.schoolName) setSchoolName(data.schoolName);
    if (data.schoolSector) setSchoolSector(data.schoolSector);
    if (data.gradeLevel !== undefined && !isNaN(data.gradeLevel)) setGradeLevel(data.gradeLevel);
    if (data.ageYears !== undefined && !isNaN(data.ageYears)) setAgeYears(data.ageYears);
    if (data.gender) setGender(data.gender);
    if (data.parentalConsent !== undefined && !isNaN(data.parentalConsent)) setParentalConsent(data.parentalConsent);
    if (data.referralPHCC) setReferralPHCC(data.referralPHCC);
    if (data.examinerId) setExaminerId(data.examinerId);

    const populatedFields: string[] = [];
    if (data.childId) populatedFields.push(`الكود: ${data.childId}`);
    if (data.schoolName) populatedFields.push(`المدرسة: ${data.schoolName}`);
    if (data.gradeLevel) populatedFields.push(`الصف: ${data.gradeLevel}`);

    setScanSuccessMessage(
      populatedFields.length > 0
        ? `تم مسح الباركود وتعبئة: ${populatedFields.join(' • ')}`
        : `تم التعرف على الباركود: ${rawText}`
    );

    setTimeout(() => setScanSuccessMessage(null), 6000);
  };

  return (
    <div className="space-y-4">
      <section
        className={`session-bar m3-card${sessionPanelOpen ? ' is-open' : ''}${identityLocked ? ' is-locked' : ''}`}
        aria-label="جلسة المدرسة الحالية"
      >
        <button
          type="button"
          className="session-bar__summary"
          aria-expanded={sessionPanelOpen}
          onClick={() => setSessionPanelOpen((open) => !open)}
        >
          <span className="session-bar__pin" aria-hidden="true">📌</span>
          <span className="session-bar__text">
            <strong>الجلسة الحالية:</strong>
            <span className={schoolName ? '' : 'is-missing'}>{schoolName || 'لم تُضبط المدرسة'}</span>
            <span className="session-bar__sep">|</span>
            <span>الصف {gradeLevel || '—'}</span>
            <span className="session-bar__sep">|</span>
            <span>الفاحص: {examinerId || '—'}</span>
          </span>
          <span className="session-bar__change">{sessionPanelOpen ? 'إخفاء' : 'تغيير'}</span>
        </button>

        {sessionPanelOpen && (
          <div className="session-bar__panel">
            <div className="session-bar__grid">
              <div className="field">
                <label>اسم المدرسة</label>
                <input
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  className="m3-input"
                  placeholder="مدرسة..."
                  disabled={identityLocked}
                />
              </div>
              <div className="field">
                <label>قطاع المدرسة</label>
                <select
                  value={schoolSector}
                  onChange={(event) => setSchoolSector(event.target.value)}
                  className="m3-select"
                  disabled={identityLocked}
                >
                  <option value="">اختر القطاع</option>
                  <option value="حكومي حضري">حكومي حضري</option>
                  <option value="حكومي ريفي">حكومي ريفي</option>
                  <option value="أهلي">أهلي</option>
                </select>
              </div>
              <div className="field">
                <label>كود الفاحص</label>
                <input
                  value={examinerId}
                  onChange={(event) => setExaminerId(event.target.value)}
                  className="m3-input m3-input--mono"
                  placeholder="NURSE-01"
                  disabled={identityLocked}
                />
              </div>
              <div className="field">
                <label>فاحص المحطة الورقية (6م)</label>
                <input
                  value={paperExaminerId}
                  onChange={(event) => setPaperExaminerId(event.target.value)}
                  className="m3-input m3-input--mono"
                  placeholder={examinerName || 'اسم/كود الفاحص'}
                  disabled={identityLocked}
                  autoComplete="off"
                />
                {alternateExaminerId && !identityLocked && (
                  <button
                    type="button"
                    onClick={() => setPaperExaminerId(alternateExaminerId)}
                    className="m3-btn m3-btn--sm m3-btn--tonal"
                    title="تعمية ثنائية: سلّم الفحص الورقي إلى الفاحص الثاني"
                  >
                    👥 تبديل مع الفاحص الثاني
                  </button>
                )}
                <p className="field-hint">
                  تعمية ثنائية: يُسجَّل الفاحص الذي أجرى فحص لوح 6 أمتار بشكل منفصل.
                </p>
              </div>
              <div className="field">
                <label>الفاحص الثاني (للتعمية)</label>
                <input
                  value={alternateExaminerId}
                  onChange={(event) => setAlternateExaminerId(event.target.value)}
                  className="m3-input m3-input--mono"
                  placeholder="اسم/كود الفاحص الثاني"
                  disabled={identityLocked}
                  autoComplete="off"
                />
                <p className="field-hint">
                  اتركه فارغاً إذا أُجري الفحص بفاحص واحد.
                </p>
              </div>
              <div className="field">
                <label>المركز الصحي التابع</label>
                <input
                  value={referralPHCC}
                  onChange={(event) => setReferralPHCC(event.target.value)}
                  className="m3-input"
                  placeholder="مركز صحي..."
                  disabled={identityLocked}
                />
              </div>
            </div>
            <p className="field-hint session-bar__hint">
              تُحفظ تلقائياً وتُعاد للتلميذ التالي.
              {identityLocked ? ' مقفلة أثناء الفحص.' : ''}
            </p>
          </div>
        )}
      </section>

      <fieldset disabled={identityLocked} className="contents" aria-label="بيانات التلميذ">
        <section className="m3-card card-pad">
          <div className="card-head">
            <div>
              <h2 className="card-head__title"><UserCheck size={20} aria-hidden="true" /> تسجيل سريع</h2>
              <p className="card-head__sub">الخطوة 1 — تسجيل سريع</p>
            </div>
          </div>

          {!stationReady && (
            <p className="field-hint mb-3">
              أكمل بيانات المدرسة والقطاع وكود الفاحص والموافقة.
            </p>
          )}

          {scanSuccessMessage && (
            <div className="notice notice--pass mb-4" role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span className="flex-1">{scanSuccessMessage}</span>
              <button type="button" onClick={()=>setScanSuccessMessage(null)} className="text-xs font-bold underline">إخفاء</button>
            </div>
          )}

          {parentalConsent !== 1 && (
            <div className="notice notice--urgent mb-4" role="status">
              <AlertCircle size={17} aria-hidden="true" />
              <span>الموافقة الخطية لولي الأمر مطلوبة قبل بدء الفحص.</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block mb-2 font-semibold">رقم/كود التلميذ</label>
              <div className="flex gap-2">
                <input id="child-id" type="text" value={childId} onChange={e=>setChildId(e.target.value)} className="m3-input m3-input--mono flex-1 text-lg" placeholder="BAB-101" />
                <button type="button" onClick={onGenerateNextId} className="m3-btn m3-btn--outline">
                  <RefreshCw size={15} />
                  كود تلقائي
                </button>
                <button type="button" onClick={openQRScanner} className="m3-btn m3-btn--primary">
                  <QrCode size={16} />
                  مسح QR
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-2 font-semibold">اسم التلميذ</label>
              <input type="text" value={childName} onChange={e=>setChildName(e.target.value)} className="m3-input text-lg" placeholder="أدخل اسم التلميذ الكامل" />
            </div>

            <div>
              <label className="block mb-3 font-semibold">الصف الدراسي</label>
              <div className="grade-chip-grid" role="group" aria-label="اختيار الصف الدراسي">
                {GRADE_CHOICES.map(({ grade, age, label }) => (
                  <button
                    key={grade}
                    type="button"
                    aria-pressed={gradeLevel === grade}
                    onClick={() => {
                      const nextAge = defaultAgeForGrade(grade);
                      setGradeLevel(grade);
                      if (gradeLevel !== grade || ageYears === 0) setAgeYears(nextAge);
                    }}
                    className="grade-chip"
                  >
                    <strong>{label}</strong>
                    <small>افتراضي {age} سنوات</small>
                  </button>
                ))}
              </div>
              <div className="age-quick-row" role="group" aria-label="تعديل عمر التلميذ بالسنوات">
                <span className="age-quick-row__label">العمر ±1</span>
                {AGE_CHOICES.map((age) => (
                  <button
                    key={age}
                    type="button"
                    className="age-chip"
                    aria-pressed={ageYears === age}
                    onClick={() => setAgeYears(age)}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-semibold">الجنس</label>
                <div className="choice-pills choice-pills--lg">
                  <button type="button" className="choice-pill choice-pill--lg" aria-pressed={gender === 'ذكر'} onClick={() => setGender('ذكر')}>👦 ذكر</button>
                  <button type="button" className="choice-pill choice-pill--lg" aria-pressed={gender === 'أنثى'} onClick={() => setGender('أنثى')}>👧 أنثى</button>
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold">النظارة أثناء الفحص</label>
                <div className="choice-pills choice-pills--lg">
                  <button type="button" className="choice-pill choice-pill--lg" aria-pressed={wearsGlasses === 0} onClick={() => setWearsGlasses(0)}>بدون نظارة UVA</button>
                  <button type="button" className="choice-pill choice-pill--lg" aria-pressed={wearsGlasses === 1} onClick={() => setWearsGlasses(1)}>يرتدي نظارة PVA</button>
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-2 font-semibold">موافقة ولي الأمر</label>
              <div className="choice-pills choice-pills--lg">
                <button type="button" className="choice-pill choice-pill--lg" data-tone="pass" aria-pressed={parentalConsent === 1} onClick={() => setParentalConsent(1)}>موجودة وموقعة ✅</button>
                <button type="button" className="choice-pill choice-pill--lg" data-tone="warn" aria-pressed={parentalConsent === 0} onClick={() => setParentalConsent(0)}>غير موجودة</button>
              </div>
            </div>

            <div className="prescreen-block">
              <div className="prescreen-block__head">
                <div>
                  <span className="eyebrow">WHO 2025 · قبل الفحص</span>
                  <h3 className="section-title">الفرز الأولي</h3>
                </div>
                <button
                  type="button"
                  className="prescreen-edit-link"
                  aria-expanded={preScreenOpen}
                  onClick={() => setPreScreenOpen((open) => !open)}
                >
                  {preScreenOpen ? 'إخفاء الأسئلة' : 'تعديل الأسئلة الفردية'}
                </button>
              </div>

              <button type="button" className="quick-pass-action" onClick={applyHealthyPreScreen}>
                <CheckCircle2 size={22} aria-hidden="true" />
                <span>
                  <strong>✅ فحص قبلي سليم: موافقة متوفرة ولا توجد شكاوى مسبقة</strong>
                  <small>تعبئة سريعة للموافقة والرضا وكل أسئلة الفرز — تبقى كل إجابة قابلة للتعديل.</small>
                </span>
              </button>

              {whoPreScreen.childAssent === 'NO' && (
                <div className="notice notice--warn assent-warning mt-2" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>
                    ⚠️ رفض الطفل الفحص — لا يُجبر الطفل على الفحص (وثّق الحالة وفق بروتوكول WHO 2025).
                  </span>
                </div>
              )}

              {healthyPreScreenApplied && (
                <div className="notice notice--pass quick-pass-status" role="status">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>التعبئة السريعة مطبّقة: الموافقة متوفرة، الطفل موافق، ولا توجد شكاوى مسجلة.</span>
                </div>
              )}

              {preScreenOpen && (
                <div className="prescreen-list">
                  <YesNoPills
                    label="موافقة الطفل على الفحص"
                    hint="لا يُجرى الفحص إذا رفض الطفل"
                    value={whoPreScreen.childAssent}
                    onChange={(v) => setPreScreenValue('childAssent', v as any)}
                  />
                  <YesNoPills
                    label="سكري معروف لدى الطفل؟"
                    value={whoPreScreen.diabetes}
                    onChange={(v) => setPreScreenValue('diabetes', v as any)}
                    allowUnknown
                  />
                  <YesNoPills
                    label="ألم أو حكة شديدة في العين الآن؟"
                    value={whoPreScreen.eyePainOrSevereItch}
                    onChange={(v) => setPreScreenValue('eyePainOrSevereItch', v as any)}
                    allowUnknown
                  />
                  <YesNoPills
                    label="قلق ولي الأمر بشأن رؤية الطفل؟"
                    value={whoPreScreen.parentVisionConcern}
                    onChange={(v) => setPreScreenValue('parentVisionConcern', v as any)}
                    allowUnknown
                  />
                  <YesNoPills
                    label="قلق ولي الأمر بشأن سمع الطفل؟"
                    value={whoPreScreen.parentHearingConcern}
                    onChange={(v) => setPreScreenValue('parentHearingConcern', v as any)}
                    allowUnknown
                  />
                  <YesNoPills
                    label="ملاحظة المعلم لمشكلة رؤية في الصف؟"
                    value={whoPreScreen.teacherVisionConcern}
                    onChange={(v) => setPreScreenValue('teacherVisionConcern', v as any)}
                    allowUnknown
                  />
                  <YesNoPills
                    label="صعوبة تعلّم أو تركيز ملحوظة؟"
                    value={whoPreScreen.learningConcern}
                    onChange={(v) => setPreScreenValue('learningConcern', v as any)}
                    allowUnknown
                  />
                  <YesNoPills
                    label="يستخدم معيناً سمعياً؟"
                    value={whoPreScreen.hearingAids}
                    onChange={(v) => setPreScreenValue('hearingAids', v as any)}
                    allowUnknown
                  />
                  <div className="prescreen-row">
                    <div>
                      <div className="prescreen-row__label">النظارة المعتادة</div>
                      <div className="prescreen-row__hint">تُسجّل كحالة تاريخية وفق WHO 2025</div>
                    </div>
                    <div className="choice-pills">
                      <button type="button" className="choice-pill" aria-pressed={whoPreScreen.spectacles === 'NONE'} onClick={() => setPreScreenValue('spectacles', 'NONE')}>لا يستخدم</button>
                      <button type="button" className="choice-pill" aria-pressed={whoPreScreen.spectacles === 'DISTANCE'} onClick={() => setPreScreenValue('spectacles', 'DISTANCE')}>نظارة مسافة</button>
                      <button type="button" className="choice-pill" aria-pressed={whoPreScreen.spectacles === 'NEAR'} onClick={() => setPreScreenValue('spectacles', 'NEAR')}>نظارة قريبة</button>
                      <button type="button" className="choice-pill" aria-pressed={whoPreScreen.spectacles === 'UNKNOWN'} onClick={() => setPreScreenValue('spectacles', 'UNKNOWN')}>لا أعلم</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </fieldset>

      {showPaperStation && (
        <section className="m3-card card-pad">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Eye size={17}/> فحص الورقي المقارن (6m)</h3>
          <div className="flex items-center gap-3 mb-3">
            <span className={`timer-box ${timerRunning ? 'is-running' : ''}`}><Clock size={15}/>{paperTimeSec.toFixed(1)} ث</span>
            <button type="button" onClick={togglePaperTimer} disabled={!stationReady} className={`m3-btn m3-btn--sm ${timerRunning ? 'm3-btn--danger' : 'm3-btn--primary'}`}>
              {timerRunning ? <Square size={14}/> : <Play size={14}/>}
              {timerRunning ? 'إيقاف المؤقت' : 'بدء المؤقت'}
            </button>
          </div>
          <div className="paper-eyes">
            <PaperAcuityGrid
              label="العين اليمنى · OD"
              value={paperOd}
              onChange={(value) => handlePaperAcuityChange('OD', value)}
              disabled={!stationReady}
            />
            <PaperAcuityGrid
              label="العين اليسرى · OS"
              value={paperOs}
              onChange={(value) => handlePaperAcuityChange('OS', value)}
              disabled={!stationReady}
            />
          </div>
          {!paperStationStarted && (
            <p className="field-hint mt-2">المؤقت يبدأ تلقائياً عند أول اختيار لخط حدة البصر.</p>
          )}
          <p className="field-hint mt-2">
            حد الإحالة: 6/12 (LogMAR ≥ 0.30) — الرمز 88 يُحال وجوباً.
          </p>
        </section>
      )}

      {/* Mandatory 2-minute accommodative washout between Station 1 and Station 2. */}
      <div className="m3-card card-pad flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">⏱️ راحة بصرية بين المحطتين</div>
          <div className="text-xs text-[var(--m3-muted)] mt-0.5">
            دقيقتان لاسترخاء التكيّف (المؤقت إرشادي ولا يمنع المتابعة).
          </div>
        </div>
        <WashoutTimer variant="light" />
      </div>

      <QRScannerModal isOpen={isQRScannerOpen} onClose={closeQRScanner} onScanSuccess={handleQRScanSuccess} />
    </div>
  );
};
