import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  UNTTESTABLE_LOGMAR,
  classifyClinicalDecision,
  snellenToLogmar,
} from '../utils/acuityMath';
import { WHOPreScreenDraft } from '../types';

interface CDSSProps {
  childId: string;
  examinerId: string;
  parentalConsent: number;
  schoolName: string;
  schoolSector: string;
  gradeLevel: number;
  ageYears: number;
  gender: string;
  wearsGlasses: number;
  crossoverSequence: string;
  paperOd: string;
  paperOs: string;
  paperTimeSec: number;
  smartOd: string;
  smartOs: string;
  smartTimeSec: number;
  hirschbergMM: number;
  mrd1MM: number;
  hirschbergRecorded: boolean;
  mrd1Recorded: boolean;
  triageOcularFlag: number;
  asthenopiaScore: number;
  referralPHCC: string;
  /** WHO/AAPOS external-eye red flags recorded in Step 3. */
  externalEyeFindings: string[];
  /** WHO 2025 pre-screen answers recorded in Step 1. */
  whoPreScreen: WHOPreScreenDraft;
  /** Compressed diagnostic-clarity photo of the eyes (data URL), when captured. */
  eyePhotoDataUrl?: string;
  onCommitRecord: () => void;
  onProceedToDatabase: () => void;
}

type VerdictTone = 'pass' | 'warn' | 'urgent' | 'pending';

/** Canvas 2D exposes `direction` at runtime but the TS DOM lib does not declare it. */
type RtlCanvasContext = CanvasRenderingContext2D & { direction: 'ltr' | 'rtl' | 'inherit' };

const BLACKBOARD_WIDTH = 1200;
const BLACKBOARD_HEIGHT = 480;
const ARABIC_FONT = '"Cairo", "Noto Kufi Arabic", system-ui, -apple-system, "Segoe UI", sans-serif';

const NURSING_INSTRUCTIONS: Record<VerdictTone, string[]> = {
  pass: [
    'طمئن ولي الأمر أن الفحص الأولي لم يُظهر إشارة إحالة.',
    'شجّع على إعادة الفحص سنوياً، والرجوع فوراً عند أي شكوى في الرؤية.',
    'سلّم بطاقة ولي الأمر عند الطلب، ووثّق أن النتيجة أُبلغت.',
  ],
  warn: [
    'أبلغ ولي الأمر أن الطفل يحتاج مراجعة مركز الصحة الأولية خلال أسبوعين.',
    'سلّمه بطاقة ولي الأمر مع اسم المركز ورقم التواصل.',
    'ذكّره بإحضار النظارة الطبية إن كان يستخدمها.',
    'سجّل موعد المراجعة في متابعة السجل.',
  ],
  urgent: [
    'أبلغ ولي الأمر بحاجة الطفل إلى مراجعة الطبيب خلال 48 ساعة.',
    'تأكد من وجود مرافق ووسيلة نقل مناسبة.',
    'سلّم بطاقة ولي الأمر ورقم المركز الصحي أو المستشفى.',
    'أبلغ مشرف الصحة المدرسية بالحالة قبل نهاية اليوم.',
  ],
  pending: [
    'أكمل فحص العينين وقياسات العين قبل تسليم أي إرشادات لولي الأمر.',
    'لا تُبلغ نتيجة غير مكتملة أو مؤقتة.',
  ],
};

const VERDICT_COPY: Record<VerdictTone, { title: string; subtitle: string; icon: typeof CheckCircle2 }> = {
  pass: {
    title: 'سليم',
    subtitle: 'لا توجد إشارة إحالة في الفحص الأولي',
    icon: CheckCircle2,
  },
  warn: {
    title: 'يحتاج مراجعة',
    subtitle: 'مراجعة مركز الصحة الأولية خلال أسبوعين',
    icon: AlertTriangle,
  },
  urgent: {
    title: 'إحالة عاجلة',
    subtitle: 'مراجعة الطبيب خلال 48 ساعة',
    icon: AlertOctagon,
  },
  pending: {
    title: 'النتيجة غير مكتملة',
    subtitle: 'أكمل خطوات الفحص لعرض التوصية',
    icon: AlertTriangle,
  },
};

/** Human-readable time-frame that is printed on the parent card. */
const VERDICT_TIMEFRAME: Record<VerdictTone, string> = {
  pass: 'فحص أولي سليم — لا توجد إحالة مطلوبة',
  warn: 'مراجعة خلال أسبوعين',
  urgent: 'إحالة عاجلة خلال 48 ساعة',
  pending: 'النتيجة غير مكتملة بعد',
};

const resolveTone = (urgency: string): VerdictTone => {
  if (urgency === 'MODEL_NO_FLAG') return 'pass';
  if (urgency === 'MODEL_REVIEW') return 'warn';
  if (urgency === 'MODEL_PRIORITY') return 'urgent';
  return 'pending';
};

const formatArabicDate = (date: Date): string => {
  try {
    return new Intl.DateTimeFormat('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

export const CDSSAndEmpathySimulator: React.FC<CDSSProps> = ({
  childId,
  parentalConsent,
  schoolName,
  schoolSector,
  gradeLevel,
  ageYears,
  gender,
  wearsGlasses,
  paperOd,
  paperOs,
  paperTimeSec,
  smartOd,
  smartOs,
  smartTimeSec,
  hirschbergMM,
  mrd1MM,
  hirschbergRecorded,
  mrd1Recorded,
  triageOcularFlag,
  asthenopiaScore,
  referralPHCC,
  externalEyeFindings,
  whoPreScreen,
  eyePhotoDataUrl,
  onCommitRecord,
  onProceedToDatabase,
}) => {
  const blackboardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Fixed at mount so the printed examination date never changes mid-session. */
  const examinationDate = useMemo(() => new Date(), []);

  const isSmartAcuityComplete = Boolean(smartOd.trim() && smartOs.trim());
  const activeOd = smartOd.trim() || 'غير مفحوص';
  const activeOs = smartOs.trim() || 'غير مفحوص';

  const isBiometryComplete = hirschbergRecorded && mrd1Recorded;

  const decision = isSmartAcuityComplete && isBiometryComplete
    ? classifyClinicalDecision(smartOd, smartOs, hirschbergMM, mrd1MM, asthenopiaScore, {
        paperOd,
        paperOs,
        externalEyeFindings,
        whoPreScreen: {
          diabetes: whoPreScreen.diabetes,
          eyePainOrSevereItch: whoPreScreen.eyePainOrSevereItch,
          childAssent: whoPreScreen.childAssent,
        },
      })
    : {
        urgency: 'PENDING' as const,
        categoryAr: !isSmartAcuityComplete ? 'بانتظار إكمال الفحص الرقمي للعينين' : 'بانتظار توثيق قياسات العين',
        detailsAr: !isSmartAcuityComplete
          ? 'لا يُحسب ملخص الفرز حتى تُسجّل نتيجتا الفحص الرقمي بشكل مستقل.'
          : 'لا يُحسب ملخص الفرز حتى تُوثق قياسات Hirschberg وMRD₁ أو يؤكد الفاحص إدخالهما من قياس فعلي.',
        referralCode: 0,
      };

  const tone = resolveTone(decision.urgency);
  const verdict = VERDICT_COPY[tone];
  const VerdictIcon = verdict.icon;

  const odLog = snellenToLogmar(smartOd) ?? 0;
  const osLog = snellenToLogmar(smartOs) ?? 0;
  const paperOdLog = snellenToLogmar(paperOd) ?? 0;
  const paperOsLog = snellenToLogmar(paperOs) ?? 0;
  const worstLog = isSmartAcuityComplete
    ? Math.max(odLog, osLog, paperOdLog, paperOsLog)
    : 0;
  const untestable = [smartOd, smartOs, paperOd, paperOs]
    .some((label) => snellenToLogmar(label) === UNTTESTABLE_LOGMAR);
  const worstSnellen = untestable
    ? 'غير قابل للقياس الميداني'
    : isSmartAcuityComplete
      ? (Math.max(odLog, osLog) >= Math.max(paperOdLog, paperOsLog)
          ? (odLog >= osLog ? smartOd : smartOs)
          : (paperOdLog >= paperOsLog ? paperOd : paperOs))
      : 'بانتظار القياس';

  const drawBlackboard = useCallback(() => {
    const canvas = blackboardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Arabic shaping / bidi on Android + iOS needs an explicit RTL canvas.
    (ctx as RtlCanvasContext).direction = 'rtl';

    ctx.filter = 'none';
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    // ---------------- "What the child sees" simulation ----------------
    // The blur emulates the reduced acuity. Code 88 is NOT simulated with an
    // extreme fog: an untestable child gets a clear, printable message.
    if (untestable) {
      ctx.fillStyle = '#fde68a';
      ctx.font = `bold 34px ${ARABIC_FONT}`;
      ctx.fillText('تلميذ غير قابل للقياس الميداني — يلزم تقييم أخصائي عيون', canvas.width - 70, 150);
    } else {
      const blurRadius = Math.min(30, Math.max(0, worstLog * 24)).toFixed(1);
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 30px ${ARABIC_FONT}`;
      ctx.fillText('بسم الله الرحمن الرحيم', canvas.width - 70, 60);
      ctx.font = `26px ${ARABIC_FONT}`;
      ctx.fillText('درس الرياضيات:  ٣٥ + ١٥ = ٥٠', canvas.width - 70, 112);
      ctx.font = `23px ${ARABIC_FONT}`;
      ctx.fillText('قال المعلم: العلم نورٌ يضيء طريق المستقبل', canvas.width - 70, 162);
      ctx.filter = 'none';
    }

    // ---------------- Crisp parent-card information ----------------
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 208);
    ctx.lineTo(canvas.width - 48, 208);
    ctx.stroke();

    const right = canvas.width - 70;
    const verdictColor = tone === 'urgent'
      ? '#fecaca'
      : tone === 'warn'
        ? '#fde68a'
        : tone === 'pass'
          ? '#bbf7d0'
          : '#e2e8f0';

    ctx.fillStyle = '#fef08a';
    ctx.font = `bold 27px ${ARABIC_FONT}`;
    ctx.fillText(`بطاقة ولي الأمر · كود التلميذ: ${childId || 'BAB-###'}`, right, 252);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `22px ${ARABIC_FONT}`;
    ctx.fillText(`المدرسة: ${schoolName || 'غير محددة'}`, right, 294);
    ctx.fillText(`تاريخ الفحص: ${formatArabicDate(examinationDate)}`, right, 330);

    ctx.fillStyle = verdictColor;
    ctx.font = `bold 28px ${ARABIC_FONT}`;
    ctx.fillText(`النتيجة: ${verdict.title} — ${VERDICT_TIMEFRAME[tone]}`, right, 378);

    ctx.fillStyle = '#bbf7d0';
    ctx.font = `21px ${ARABIC_FONT}`;
    ctx.fillText(`المركز الصحي للإحالة: ${referralPHCC || 'غير محددة'}`, right, 418);
    ctx.fillText(`أسوأ حدة بصر مسجلة: ${worstSnellen}`, right, 452);
  }, [
    childId,
    examinationDate,
    referralPHCC,
    schoolName,
    tone,
    untestable,
    verdict.title,
    worstLog,
    worstSnellen,
  ]);

  useEffect(() => {
    drawBlackboard();
  }, [drawBlackboard]);

  const downloadParentalCard = () => {
    const canvas = blackboardCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `AlBasar_ReferralCard_${childId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const recordCode = childId.trim() || 'BAB-###';
  const canCommit = Boolean(paperOd && paperOs && isSmartAcuityComplete && isBiometryComplete);
  const missingRequirements = [
    !paperOd || !paperOs ? 'نتيجة الفحص الورقي للعينين' : '',
    !isSmartAcuityComplete ? 'الفحص الرقمي للعينين' : '',
    !isBiometryComplete ? 'توثيق قياسات العين' : '',
  ].filter(Boolean);

  const bannerTitle = tone === 'pass'
    ? 'اجتياز — بصر سليم'
    : tone === 'urgent'
      ? 'إحالة عاجلة — مراجعة خلال 48 ساعة'
      : tone === 'warn'
        ? 'إحالة — مراجعة المركز الصحي'
        : 'النتيجة غير مكتملة';

  const verdictLabel = decision.referralCode === 1
    ? 'إحالة · REFER'
    : tone === 'pending'
      ? 'بانتظار · PENDING'
      : 'اجتياز · PASS';

  return (
    <div className="whoeyes-step4" dir="rtl">
      <section className="result-stage">
        <div className={`result-hero result-hero--${tone}`} role="status" aria-live="polite">
          <div className="result-hero__top">
            <span className="result-hero__icon" aria-hidden="true">
              <VerdictIcon size={38} />
            </span>
            <div className="result-hero__copy">
              <span className="result-hero__eyebrow">{verdictLabel} · {recordCode}</span>
              <h1>{bannerTitle}</h1>
              <p>{verdict.subtitle}</p>
            </div>
          </div>

          <div className="result-hero__metrics">
            <div><small>العين اليمنى OD</small><strong>{activeOd}</strong></div>
            <div><small>العين اليسرى OS</small><strong>{activeOs}</strong></div>
            <div><small>أسوأ عين</small><strong>{worstSnellen}</strong></div>
            <div><small>Hirschberg</small><strong>{hirschbergRecorded ? `${hirschbergMM.toFixed(2)} mm` : '—'}</strong></div>
            <div><small>MRD₁</small><strong>{mrd1Recorded ? `${mrd1MM.toFixed(1)} mm` : '—'}</strong></div>
          </div>

          <p className="result-hero__detail">{decision.detailsAr}</p>

          <div className="result-hero__meta">
            <span className="pill">{recordCode}</span>
            {referralPHCC && (
              <span className="result-hero__phcc">
                <ShieldCheck size={14} aria-hidden="true" />
                المركز الصحي: {referralPHCC}
              </span>
            )}
          </div>
        </div>

        {eyePhotoDataUrl && (
          <figure className="result-photo">
            <img src={eyePhotoDataUrl} alt="صورة العينين الملتقطة أثناء الفحص" />
            <figcaption>
              <Sparkles size={13} aria-hidden="true" />
              صورة العين الملتقطة — محفوظة محلياً وتُرفع للمركز الصحي عند المزامنة.
            </figcaption>
          </figure>
        )}

        <div className="result-board">
          <div className="result-board__head">
            <span><Eye size={18} aria-hidden="true" /> بطاقة السبورة للأم</span>
            <small>محاكاة ما يراه الطفل</small>
          </div>
          <div className="blackboard-frame">
            <canvas
              ref={blackboardCanvasRef}
              width={BLACKBOARD_WIDTH}
              height={BLACKBOARD_HEIGHT}
              aria-label={`بطاقة السبورة للأم للتلميذ ${recordCode}`}
              role="img"
            />
          </div>
          <p className="who-tips">
            نصائح WHO 2025 للرعاية البصرية: 90 دقيقة في الهواء الطلق يومياً · قاعدة 20-20-20 للراحة البصرية
          </p>
        </div>
      </section>

      <section className="nursing-card">
        <h3>
          <ClipboardList size={18} aria-hidden="true" />
          إرشادات التمريض لولي الأمر
        </h3>
        <ul>
          {NURSING_INSTRUCTIONS[tone].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <div className="final-actions">
        <button
          type="button"
          onClick={onCommitRecord}
          disabled={!canCommit}
          className="final-save-cta"
        >
          <span className="final-save-cta__icon" aria-hidden="true"><Save size={24} /></span>
          <span className="final-save-cta__copy">
            <strong>💾 حفظ السجل والانتقال للتلميذ التالي</strong>
            <small>{recordCode}</small>
          </span>
        </button>
        <button type="button" onClick={downloadParentalCard} className="final-download-btn">
          <Download size={18} aria-hidden="true" />
          📥 تحميل بطاقة السبورة للأم (PNG)
        </button>
        {!canCommit && (
          <p className="final-actions__hint" role="status">
            أكمل أولاً: {missingRequirements.join('، ')}. لا يمكن حفظ سجل غير مكتمل.
          </p>
        )}
      </div>

      <p className="field-hint result-disclaimer">
        <ShieldCheck size={13} aria-hidden="true" />
        العرض التوضيحي تقديري ولا يُستخدم للتشخيص، والقياس المعتمد هو ما سجله الفاحص.
      </p>
    </div>
  );
};
