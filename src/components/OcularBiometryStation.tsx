import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Eye,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Upload,
  Zap,
} from 'lucide-react';
import { convertHirschbergToPrism } from '../utils/acuityMath';
import {
  ANALYSIS_HEIGHT,
  ANALYSIS_WIDTH,
  FALLBACK_HVID_PX,
  STANDARD_PEDIATRIC_HVID_MM,
  analyzeOcularFrame,
  computeMRD1FromLandmarks,
  computeNetHirschberg,
  eyeAtAnalysisPoint,
  validateOcularRanges,
  type EyeKey,
  type EyeLandmarks,
  type ImagePoint,
  type OcularFrameAnalysis,
} from '../utils/ocularImageAnalysis';
import { useFeedback } from './FeedbackProvider';

type AutoStatus = 'idle' | 'scanning' | 'done' | 'error';
type QualityState = 'idle' | 'clear' | 'blur' | 'glare';
type AuditPointType = 'pupil' | 'reflex' | 'eyelid';

interface OcularBiometryProps {
  hirschbergMM: number;
  setHirschbergMM: (val: number) => void;
  hirschbergRecorded: boolean;
  setHirschbergRecorded: (recorded: boolean) => void;
  mrd1MM: number;
  setMrd1MM: (val: number) => void;
  mrd1Recorded: boolean;
  setMrd1Recorded: (recorded: boolean) => void;
  triageOcularFlag: number;
  setTriageOcularFlag: (flag: number) => void;
  /** Capture provenance of the AI reading: 1 = Auto, 2 = Retake, 3 = Manual Tap Fallback. */
  aiQualityFlag: number;
  setAIQualityFlag: (flag: number) => void;
  asthenopiaScore: number;
  setAsthenopiaScore: (score: number) => void;
  externalEyeFindings: string[];
  setExternalEyeFindings: (findings: string[]) => void;
  externalEyeOther: string;
  setExternalEyeOther: (value: string) => void;
  externalEyeScreened: boolean;
  setExternalEyeScreened: (value: boolean) => void;
  onProceedToCDSS: () => void;
}

interface AuditPointSet {
  pupil: ImagePoint | null;
  reflex: ImagePoint | null;
  eyelid: ImagePoint | null;
}

const EYE_FINDINGS = [
  { id: 'EYELID_CRUST_OR_PUS', short: 'إفرازات / قشور جفن', tone: 'warn' },
  { id: 'SCLERAL_REDNESS', short: 'احمرار الصلبة', tone: 'urgent' },
  { id: 'EYE_DISCHARGE', short: 'إفرازات عينية', tone: 'warn' },
  { id: 'CORNEAL_HAZINESS', short: 'عتامة القرنية', tone: 'urgent' },
  { id: 'EYE_MISALIGNMENT', short: 'انحراف ظاهر', tone: 'urgent' },
  { id: 'OTHER', short: 'ملاحظة أخرى', tone: 'warn' },
] as const;

const EXTERNAL_GATE_IDS = [
  'EYELID_CRUST_OR_PUS',
  'EYE_DISCHARGE',
  'SCLERAL_REDNESS',
  'CORNEAL_HAZINESS',
] as const;

const ASTHENOPIA_SIGNS = [
  { key: 'squint', label: 'تغميض متكرر عند النظر للأمام' },
  { key: 'tilt', label: 'إمالة الرأس بشكل ملحوظ' },
  { key: 'rub', label: 'فرك العينين بكثرة' },
  { key: 'close', label: 'الاقتراب كثيراً من الشاشة / اللوح' },
  { key: 'headache', label: 'صداع أو إجهاد بصري بعد القراءة' },
] as const;

interface ClinicalPreset {
  id: 'normal' | 'strabismus' | 'ptosis';
  emoji: string;
  label: string;
  detail: string;
  tone: 'pass' | 'warn' | 'urgent';
  hirschbergMM: number;
  mrd1MM: number;
}

const CLINICAL_PRESETS: ClinicalPreset[] = [
  {
    id: 'normal',
    emoji: '✅',
    label: 'طبيعي مبدئياً',
    detail: 'Hirschberg < 0.5mm | MRD1 = 4.0mm',
    tone: 'pass',
    hirschbergMM: 0,
    mrd1MM: 4.0,
  },
  {
    id: 'strabismus',
    emoji: '⚠️',
    label: 'اشتباه حَوَل',
    detail: 'Hirschberg ≥ 1.0mm / ≥ 15PD',
    tone: 'warn',
    hirschbergMM: 1.0,
    mrd1MM: 4.0,
  },
  {
    id: 'ptosis',
    emoji: '🚨',
    label: 'اشتباه تدلي جفن',
    detail: 'MRD1 < 2.5mm',
    tone: 'urgent',
    hirschbergMM: 0,
    mrd1MM: 2.0,
  },
];

const emptyAuditPoints = (): Record<EyeKey, AuditPointSet> => ({
  OD: { pupil: null, reflex: null, eyelid: null },
  OS: { pupil: null, reflex: null, eyelid: null },
});

const pointsFromAnalysis = (analysis: OcularFrameAnalysis): Record<EyeKey, AuditPointSet> => ({
  OD: {
    pupil: analysis.landmarks.OD.pupil,
    reflex: analysis.landmarks.OD.reflex,
    eyelid: analysis.landmarks.OD.upperLid,
  },
  OS: {
    pupil: analysis.landmarks.OS.pupil,
    reflex: analysis.landmarks.OS.reflex,
    eyelid: analysis.landmarks.OS.upperLid,
  },
});

/**
 * Canvas detection can fail in extreme lighting or on a locked-down browser.
 * The examiner must still be able to tap the two visible landmarks manually,
 * so we provide a neutral HVID-scaled frame that the HUD can write into.
 */
const createFallbackAnalysis = (image: HTMLImageElement): OcularFrameAnalysis => {
  const emptyLandmark = (eye: EyeKey): EyeLandmarks => ({
    eye,
    pupil: null,
    reflex: null,
    upperLid: null,
    pupilRadiusPx: null,
    offsetPx: null,
    hvidPx: null,
    hvidSource: 'standard',
    saturatedPupilRatio: 0,
    pupilConfidence: 0,
  });

  return {
    landmarks: { OD: emptyLandmark('OD'), OS: emptyLandmark('OS') },
    sharpness: 0,
    contrast: 0,
    isBlurred: false,
    hasGlare: false,
    glareRatio: 0,
    mmPerPx: STANDARD_PEDIATRIC_HVID_MM / FALLBACK_HVID_PX,
    transform: {
      imgWidth: image.naturalWidth || ANALYSIS_WIDTH,
      imgHeight: image.naturalHeight || ANALYSIS_HEIGHT,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
  };
};

const toEyeLandmarks = (
  eye: EyeKey,
  points: AuditPointSet,
  base: EyeLandmarks,
): EyeLandmarks => {
  const offsetPx = points.pupil && points.reflex
    ? Math.hypot(points.pupil.x - points.reflex.x, points.pupil.y - points.reflex.y)
    : null;

  return {
    ...base,
    eye,
    pupil: points.pupil,
    reflex: points.reflex,
    upperLid: points.eyelid,
    offsetPx,
  };
};

const formatMM = (value: number): string => Number.isFinite(value) ? value.toFixed(2) : '—';

export const OcularBiometryStation: React.FC<OcularBiometryProps> = ({
  hirschbergMM,
  setHirschbergMM,
  hirschbergRecorded,
  setHirschbergRecorded,
  mrd1MM,
  setMrd1MM,
  mrd1Recorded,
  setMrd1Recorded,
  triageOcularFlag,
  setTriageOcularFlag,
  aiQualityFlag,
  setAIQualityFlag,
  asthenopiaScore,
  setAsthenopiaScore,
  externalEyeFindings,
  setExternalEyeFindings,
  setExternalEyeOther,
  externalEyeScreened,
  setExternalEyeScreened,
  onProceedToCDSS,
}) => {
  const { notify } = useFeedback();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hadRetakeRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [isShutterActive, setIsShutterActive] = useState(false);

  const [autoStatus, setAutoStatus] = useState<AutoStatus>('idle');
  const [autoMessage, setAutoMessage] = useState('');
  const [qualityState, setQualityState] = useState<QualityState>('idle');
  const [qualityMessage, setQualityMessage] = useState('');
  const [bypassAuto, setBypassAuto] = useState(false);

  const [analysis, setAnalysis] = useState<OcularFrameAnalysis | null>(null);
  const [auditPoints, setAuditPoints] = useState<Record<EyeKey, AuditPointSet>>(emptyAuditPoints);
  const [auditType, setAuditType] = useState<AuditPointType>('pupil');

  const [symptomSquint, setSymptomSquint] = useState(false);
  const [symptomTilt, setSymptomTilt] = useState(false);
  const [symptomRub, setSymptomRub] = useState(false);
  const [symptomClose, setSymptomClose] = useState(false);
  const [symptomHeadache, setSymptomHeadache] = useState(false);

  const [externalEyeGateAbnormal, setExternalEyeGateAbnormal] = useState(false);

  useEffect(() => {
    let count = 0;
    if (symptomSquint) count += 1;
    if (symptomTilt) count += 1;
    if (symptomRub) count += 1;
    if (symptomClose) count += 1;
    if (symptomHeadache) count += 1;
    setAsthenopiaScore(count);
  }, [symptomSquint, symptomTilt, symptomRub, symptomClose, symptomHeadache, setAsthenopiaScore]);

  useEffect(() => {
    if (!hirschbergRecorded || !mrd1Recorded) return;
    const hasStrabismus = hirschbergMM >= 1.0;
    const hasPtosis = mrd1MM < 2.5;
    if (hasStrabismus && hasPtosis) {
      setTriageOcularFlag(3);
    } else if (hasStrabismus) {
      setTriageOcularFlag(1);
    } else if (hasPtosis) {
      setTriageOcularFlag(2);
    } else {
      setTriageOcularFlag(0);
    }
  }, [hirschbergMM, mrd1MM, hirschbergRecorded, mrd1Recorded, setTriageOcularFlag]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    setCameraActive(false);
    setCameraError('');
  }, []);

  /**
   * Applies HVID-normalized geometry to the two validated ocular fields.
   * The measured values are always clamped into the admissible pediatric range.
   */
  const applyMetricsFromAudit = useCallback((
    points: Record<EyeKey, AuditPointSet>,
    source: OcularFrameAnalysis,
    manual: boolean,
  ): boolean => {
    const od = toEyeLandmarks('OD', points.OD, source.landmarks.OD);
    const os = toEyeLandmarks('OS', points.OS, source.landmarks.OS);

    if (od.offsetPx === null && os.offsetPx === null) return false;

    const net = computeNetHirschberg({ OD: od, OS: os }, source.mmPerPx);
    const mrdCandidates = [
      computeMRD1FromLandmarks(od, source.mmPerPx),
      computeMRD1FromLandmarks(os, source.mmPerPx),
    ].filter((value): value is number => value !== null);

    // A missing lid margin falls back to the local default; the examiner can
    // still refine MRD₁ with the slider or by re-tapping the eyelid point.
    const rawMrd1 = mrdCandidates.length > 0 ? Math.min(...mrdCandidates) : 4.0;
    const validated = validateOcularRanges(net.hirschbergAsymMm, rawMrd1);

    setHirschbergMM(validated.hirschbergMM);
    setMrd1MM(validated.mrd1MM);
    setHirschbergRecorded(true);
    setMrd1Recorded(true);
    setAIQualityFlag(manual ? 3 : (hadRetakeRef.current ? 2 : 1));

    if (validated.issues.length > 0) {
      notify(validated.issues.join(' '), 'info');
    }

    return true;
  }, [notify, setAIQualityFlag, setHirschbergMM, setHirschbergRecorded, setMrd1MM, setMrd1Recorded]);

  const runAutoDetection = useCallback((
    image: HTMLImageElement | null = userImage,
    skipQuality = false,
  ) => {
    if (!image) {
      notify('يرجى التقاط صورة أو اختيار صورة أولاً.', 'info');
      return;
    }

    setAutoStatus('scanning');
    setAutoMessage('');

    try {
      const result = analyzeOcularFrame(image);
      const nextPoints = pointsFromAnalysis(result);
      setAnalysis(result);
      setAuditPoints(nextPoints);

      // Quality gate: both checks run before any value is accepted.
      if (!skipQuality && (result.isBlurred || result.hasGlare)) {
        const message = result.isBlurred
          ? '⚠️ الصورة غير واضحة — يرجى إعادة التصوير بثبات.'
          : '⚠️ يوجد وهج ضوئي قوي يغطي الحدقة — غيّر زاوية التصوير قليلاً.';
        setQualityState(result.isBlurred ? 'blur' : 'glare');
        setQualityMessage(message);
        setAutoStatus('error');
        setAutoMessage(message);
        setHirschbergRecorded(false);
        setMrd1Recorded(false);
        setAIQualityFlag(0);
        notify(message, 'error');
        return;
      }

      setQualityState('clear');
      setQualityMessage('');
      const applied = applyMetricsFromAudit(nextPoints, result, skipQuality);

      if (!applied) {
        setAutoStatus('error');
        setAutoMessage('لم نتمكن من التعرف على الحدقة والانعكاس تلقائياً — اضغط على الصورة لتحديد النقاط يدوياً.');
        setHirschbergRecorded(false);
        setMrd1Recorded(false);
        setAIQualityFlag(0);
        notify('استخدم التحديد اليدوي على الصورة لتحديد الحدقة والانعكاس.', 'info');
        return;
      }

      setAutoStatus('done');
      setAutoMessage(skipQuality
        ? '⚡ تم تخطي الفحص التلقائي — اضبط النقاط يدوياً عند الحاجة.'
        : hadRetakeRef.current
          ? '✅ تم تحليل الصورة وإعادة ضبط القيم (محاولة ثانية).'
          : '✅ تم تحليل الصورة تلقائياً واعتماد القيم. راجعها قبل المتابعة.');
      notify('تم تحديث القياسات البصرية. راجع القيم قبل المتابعة.', 'success');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'تعذر تحليل الصورة. حاول مرة أخرى أو استخدم التحديد اليدوي.';
      setAutoStatus('error');
      setAutoMessage(message);
      setQualityState('idle');
      setAnalysis(createFallbackAnalysis(image));
      setAuditPoints(emptyAuditPoints());
      setHirschbergRecorded(false);
      setMrd1Recorded(false);
      setAIQualityFlag(0);
      notify(message, 'error');
    }
  }, [
    applyMetricsFromAudit,
    notify,
    setAIQualityFlag,
    setHirschbergRecorded,
    setMrd1Recorded,
    userImage,
  ]);

  const processLoadedImage = useCallback((image: HTMLImageElement) => {
    setUserImage(image);
    setAnalysis(null);
    setAuditPoints(emptyAuditPoints());
    setQualityState('idle');
    setQualityMessage('');
    setAutoStatus('scanning');
    setAutoMessage('جارٍ تحليل جودة الصورة والنقاط التشريحية...');
    setAIQualityFlag(0);
    setHirschbergRecorded(false);
    setMrd1Recorded(false);
    window.setTimeout(() => runAutoDetection(image), 60);
  }, [runAutoDetection, setAIQualityFlag, setHirschbergRecorded, setMrd1Recorded]);

  const startCamera = async (facing: 'user' | 'environment' = cameraFacingMode) => {
    if (cameraStarting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'تعذر الوصول إلى الكاميرا على هذا المتصفح. استخدم زر رفع الصورة بدلاً منها.';
      setCameraError(message);
      notify(message, 'error');
      return;
    }

    if (videoRef.current?.srcObject) {
      const existing = videoRef.current.srcObject as MediaStream;
      existing.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setCameraStarting(true);
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        const message = 'تعذر تجهيز معاينة الكاميرا. استخدم زر رفع الصورة.';
        setCameraError(message);
        notify(message, 'error');
        return;
      }
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      setCameraActive(true);
      setCameraFacingMode(facing);
    } catch {
      const video = videoRef.current;
      if (video?.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      const message = 'تعذر فتح الكاميرا. تحقق من الصلاحيات أو استخدم رفع الصورة.';
      setCameraError(message);
      notify(message, 'error');
    } finally {
      setCameraStarting(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      notify('انتظر ثانية حتى تبدأ معاينة الكاميرا.', 'info');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsShutterActive(true);
    window.setTimeout(() => setIsShutterActive(false), 200);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = new Image();
    image.src = canvas.toDataURL('image/png');
    image.onload = () => {
      stopCamera();
      if (userImage) hadRetakeRef.current = true;
      processLoadedImage(image);
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => {
        stopCamera();
        if (userImage) hadRetakeRef.current = true;
        processLoadedImage(image);
      };
      image.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const resetImage = () => {
    stopCamera();
    setUserImage(null);
    setAnalysis(null);
    setAuditPoints(emptyAuditPoints());
    setQualityState('idle');
    setQualityMessage('');
    setAutoStatus('idle');
    setAutoMessage('');
    setBypassAuto(false);
    hadRetakeRef.current = false;
    setAIQualityFlag(0);
    setHirschbergRecorded(false);
    setMrd1Recorded(false);
  };

  const handleBypassToggle = () => {
    if (!userImage) {
      notify('التقط صورة أولاً لتفعيل التحديد اليدوي.', 'info');
      return;
    }

    const next = !bypassAuto;
    setBypassAuto(next);

    if (next) {
      const source = analysis ?? createFallbackAnalysis(userImage);
      if (!analysis) setAnalysis(source);
      const applied = applyMetricsFromAudit(auditPoints, source, true);
      if (applied) {
        setQualityState('clear');
        setQualityMessage('');
        setAutoStatus('done');
        setAutoMessage('⚡ تم تخطي الفحص التلقائي — المس الصورة لضبط نقاط الحدقة والانعكاس.');
      } else {
        setAutoStatus('idle');
        setAutoMessage('اختر نوع النقطة ثم المس الصورة لتحديدها يدوياً.');
      }
      notify('تم تفعيل التحديد اليدوي. المس الصورة لضبط نقاط الحدقة والانعكاس.', 'info');
      return;
    }

    // Turning bypass off re-runs the objective quality gate.
    if (userImage) runAutoDetection(userImage, false);
  };

  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!userImage) return;
    const target = previewRef.current;
    if (!target) return;

    const source = analysis ?? createFallbackAnalysis(userImage);
    if (!analysis) setAnalysis(source);

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = ((event.clientX - rect.left) / rect.width) * ANALYSIS_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * ANALYSIS_HEIGHT;
    if (x < 0 || x > ANALYSIS_WIDTH || y < 0 || y > ANALYSIS_HEIGHT) return;

    const eye = eyeAtAnalysisPoint({ x, y }) ?? (x < ANALYSIS_WIDTH / 2 ? 'OD' : 'OS');
    const point: ImagePoint = {
      x: Math.max(0, Math.min(ANALYSIS_WIDTH, x)),
      y: Math.max(0, Math.min(ANALYSIS_HEIGHT, y)),
    };

    const nextPoints: Record<EyeKey, AuditPointSet> = {
      ...auditPoints,
      [eye]: {
        ...auditPoints[eye],
        [auditType]: point,
      },
    };

    setAuditPoints(nextPoints);
    const applied = applyMetricsFromAudit(nextPoints, source, true);

    if (applied) {
      setBypassAuto(true);
      setQualityState('clear');
      setQualityMessage('');
      setAutoStatus('done');
      setAutoMessage(`تم ضبط نقطة ${auditType === 'pupil' ? 'الحدقة' : auditType === 'reflex' ? 'الانعكاس' : 'الجفن'} يدوياً — AI_Quality_Flag = 3.`);
    } else {
      setBypassAuto(true);
      setQualityState('clear');
      setQualityMessage('');
      setAutoStatus('idle');
      setAutoMessage('تم تسجيل النقطة. حدد الآن النقطة الأخرى لنفس العين (الحدقة والانعكاس) لحساب Hirschberg.');
    }
  };

  const toggleFinding = (id: string) => {
    setExternalEyeScreened(true);
    if (id === 'NONE') {
      setExternalEyeFindings([]);
      return;
    }
    setExternalEyeFindings(
      externalEyeFindings.includes(id)
        ? externalEyeFindings.filter((item) => item !== id)
        : [...externalEyeFindings, id],
    );
  };

  const applyClinicalPreset = (preset: ClinicalPreset) => {
    setHirschbergMM(preset.hirschbergMM);
    setMrd1MM(preset.mrd1MM);
    setHirschbergRecorded(true);
    setMrd1Recorded(true);
    setAIQualityFlag(3);
    notify(`تم تطبيق الإعداد السريري: ${preset.label}. يمكنك تعديل القيم يدوياً إذا لزم.`, 'success');
  };

  const applyHealthyExternalEye = () => {
    setExternalEyeGateAbnormal(false);
    setExternalEyeFindings([]);
    setExternalEyeOther('');
    setExternalEyeScreened(true);
    notify('تم تسجيل الفحص الخارجي كطبيعي. تابع إلى تحليل النتائج.', 'success');
  };

  const qualityBlocked = !bypassAuto && (qualityState === 'blur' || qualityState === 'glare');
  const noExternalFindings = externalEyeScreened && externalEyeFindings.length === 0;
  const hasSuspicion = hirschbergRecorded && mrd1Recorded && (hirschbergMM >= 1.0 || mrd1MM < 2.5);
  const alignmentState = !hirschbergRecorded || !mrd1Recorded ? 'idle' : hasSuspicion ? 'warn' : 'pass';
  const prismDiopters = convertHirschbergToPrism(hirschbergMM);

  const renderEyeAuditHud = (eye: EyeKey) => {
    const points = auditPoints[eye];
    return (
      <g key={eye}>
        {points.pupil && (
          <g>
            <line x1={points.pupil.x - 12} y1={points.pupil.y} x2={points.pupil.x + 12} y2={points.pupil.y} stroke="#ef4444" strokeWidth="2.5" />
            <line x1={points.pupil.x} y1={points.pupil.y - 12} x2={points.pupil.x} y2={points.pupil.y + 12} stroke="#ef4444" strokeWidth="2.5" />
            <circle cx={points.pupil.x} cy={points.pupil.y} r="5" fill="none" stroke="#ef4444" strokeWidth="1.5" />
            <text x={points.pupil.x + 16} y={points.pupil.y - 12} fill="#fecaca" fontSize="12" fontWeight="800">
              {eye}
            </text>
          </g>
        )}
        {points.reflex && (
          <g>
            <circle cx={points.reflex.x} cy={points.reflex.y} r="8" fill="rgba(34,211,238,0.16)" stroke="#22d3ee" strokeWidth="2" />
            <circle cx={points.reflex.x} cy={points.reflex.y} r="2.7" fill="#22d3ee" />
          </g>
        )}
        {points.eyelid && (
          <g>
            <line x1={points.eyelid.x - 11} y1={points.eyelid.y} x2={points.eyelid.x + 11} y2={points.eyelid.y} stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx={points.eyelid.x} cy={points.eyelid.y} r="2.6" fill="#fbbf24" />
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="ocular-layout">
      <section className="m3-card card-pad">
        <div className="card-head">
          <div>
            <h2 className="card-head__title">
              <Camera size={20} aria-hidden="true" />
              التصوير العيني الدقيق
            </h2>
            <p className="card-head__sub">
              تقييم الحدقة والانعكاس القرني وتدلي الجفن. تعمل كل الحسابات محلياً على الجهاز دون إنترنت.
            </p>
          </div>
          <span className="pill pill--primary">
            <Sun size={13} aria-hidden="true" />
            إضاءة موزعة
          </span>
        </div>

        <div className="capture-stage">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`capture-video${cameraActive ? ' is-active' : ''}${cameraFacingMode === 'user' ? ' is-mirrored' : ''}`}
          />
          {cameraActive ? (
            <>
              <div className="alignment-frame" aria-hidden="true">
                <svg viewBox="0 0 600 300" preserveAspectRatio="none">
                  <ellipse cx="210" cy="150" rx="98" ry="58" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeDasharray="8 5" />
                  <ellipse cx="390" cy="150" rx="98" ry="58" fill="none" stroke="#86efac" strokeWidth="2.5" strokeDasharray="8 5" />
                  <line x1="308" y1="150" x2="292" y2="150" stroke="#f8fafc" strokeWidth="2" />
                  <line x1="300" y1="105" x2="300" y2="195" stroke="rgba(248,250,252,.36)" strokeWidth="1.5" strokeDasharray="5 5" />
                </svg>
              </div>
              {isShutterActive && <div className="capture-shutter" />}
              <span className="capture-guide-label">
                ضع وجه الطفل داخل الدائرتين — ابتعد 40–60 سم
              </span>
              <span className="capture-hint">
                <CheckCircle2 size={14} aria-hidden="true" />
                حافظ على ثبات الكاميرا وأزل الانعكاسات المباشرة
              </span>
            </>
          ) : userImage ? (
            <div className="precision-frame" ref={previewRef} onPointerDown={handlePreviewPointerDown}>
              <img src={userImage.src} alt="صورة العين الملتقطة للتحليل" />
              <svg className="precision-hud" viewBox={`0 0 ${ANALYSIS_WIDTH} ${ANALYSIS_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                {(['OD', 'OS'] as EyeKey[]).map(renderEyeAuditHud)}
              </svg>
            </div>
          ) : (
            <div className="capture-empty">
              {cameraStarting ? (
                <>
                  <span className="capture-spinner" aria-hidden="true" />
                  <strong>جارٍ تشغيل الكاميرا…</strong>
                  <span>انتظر لحظة حتى تظهر المعاينة.</span>
                </>
              ) : (
                <>
                  <Camera size={42} aria-hidden="true" />
                  <strong>{cameraError ? 'تعذر تشغيل الكاميرا' : 'جاهز لفحص العين'}</strong>
                  <span>{cameraError || 'افتح الكاميرا أو ارفع صورة واضحة للعين.'}</span>
                  {cameraError && (
                    <button type="button" className="m3-btn m3-btn--outline capture-retry" onClick={() => startCamera()}>
                      <RefreshCw size={15} aria-hidden="true" />
                      إعادة المحاولة
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => cameraActive ? capturePhoto() : startCamera()}
            className="m3-btn m3-btn--primary m3-btn--block"
            disabled={cameraStarting}
          >
            <Camera size={20} aria-hidden="true" />
            {cameraStarting
              ? 'جارٍ تشغيل الكاميرا…'
              : cameraActive
                ? 'التقاط الصورة الآن'
                : userImage
                  ? 'إعادة التصوير'
                  : 'فتح الكاميرا'}
          </button>

          <div className="flex flex-wrap gap-2 mt-2">
            <label className="m3-btn m3-btn--outline cursor-pointer flex-1">
              <Upload size={17} aria-hidden="true" />
              رفع صورة
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            {userImage && (
              <button type="button" className="m3-btn m3-btn--outline" onClick={resetImage}>
                <RefreshCw size={16} aria-hidden="true" />
                مسح الصورة
              </button>
            )}
          </div>
        </div>

        {qualityBlocked ? (
          <div className="notice notice--warn quality-banner mt-3" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>{qualityState === 'blur' ? 'فشل فحص الوضوح' : 'فشل فحص الوهج'}</strong>
              <p>{qualityMessage}</p>
              <div className="quality-banner__actions">
                <button type="button" className="m3-btn m3-btn--sm m3-btn--secondary" onClick={() => startCamera()}>
                  <Camera size={14} aria-hidden="true" />
                  إعادة التصوير
                </button>
                <button type="button" className="m3-btn m3-btn--sm m3-btn--outline" onClick={handleBypassToggle}>
                  <Zap size={14} aria-hidden="true" />
                  ⚡ تخطي الفحص التلقائي واستخدام التحديد اليدوي
                </button>
              </div>
            </div>
          </div>
        ) : autoStatus !== 'idle' ? (
          <div className={`notice mt-3 ${autoStatus === 'done' ? 'notice--pass' : autoStatus === 'scanning' ? 'notice--info' : 'notice--warn'}`} role="status">
            {autoStatus === 'done' ? <CheckCircle2 size={16} aria-hidden="true" /> : autoStatus === 'scanning' ? <Sparkles size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
            <span>{autoStatus === 'scanning' ? 'جارٍ قياس جودة الصورة والنقاط التشريحية…' : autoMessage}</span>
          </div>
        ) : null}

        {userImage && (
          <>
            <button
              type="button"
              className={`m3-btn m3-btn--block mt-2 ${bypassAuto ? 'm3-btn--primary' : 'm3-btn--outline'}`}
              onClick={handleBypassToggle}
              aria-pressed={bypassAuto}
            >
              <Zap size={16} aria-hidden="true" />
              {bypassAuto
                ? 'التحديد اليدوي مفعّل — اضغط لإيقاف التخطي'
                : '⚡ تخطي الفحص التلقائي واستخدام التحديد اليدوي'}
            </button>

            <div className="audit-tools" role="group" aria-label="نوع النقطة المراد تعديلها على الصورة">
              <span className="audit-tools__label">نقطة التعديل:</span>
              <button
                type="button"
                className={`audit-tool${auditType === 'pupil' ? ' is-active' : ''}`}
                aria-pressed={auditType === 'pupil'}
                onClick={() => setAuditType('pupil')}
              >
                <span className="audit-tool__dot audit-tool__dot--pupil" aria-hidden="true" />
                الحدقة
              </button>
              <button
                type="button"
                className={`audit-tool${auditType === 'reflex' ? ' is-active' : ''}`}
                aria-pressed={auditType === 'reflex'}
                onClick={() => setAuditType('reflex')}
              >
                <span className="audit-tool__dot audit-tool__dot--reflex" aria-hidden="true" />
                الانعكاس القرني
              </button>
              <button
                type="button"
                className={`audit-tool${auditType === 'eyelid' ? ' is-active' : ''}`}
                aria-pressed={auditType === 'eyelid'}
                onClick={() => setAuditType('eyelid')}
              >
                <span className="audit-tool__dot audit-tool__dot--eyelid" aria-hidden="true" />
                حد الجفن
              </button>
            </div>

            {analysis && (
              <div className="precision-meta" aria-label="مؤشرات جودة الصورة">
                <span>HVID {analysis.landmarks.OD.hvidSource === 'detected' ? 'مقاس' : 'قياسي 11.7 مم'}</span>
                <span>mm/px {analysis.mmPerPx.toFixed(4)}</span>
                <span>وضوح {analysis.sharpness.toFixed(4)}</span>
                <span>وهج {(analysis.glareRatio * 100).toFixed(0)}%</span>
              </div>
            )}
          </>
        )}

        <div className="clinical-presets">
          <div className="clinical-presets__head">
            <strong>إعداد سريري سريع</strong>
            <span>يملأ Hirschberg و MRD₁ بنقرة واحدة</span>
          </div>
          <div className="clinical-presets__grid">
            {CLINICAL_PRESETS.map((preset) => {
              const active = hirschbergRecorded && mrd1Recorded
                && Math.abs(hirschbergMM - preset.hirschbergMM) < 0.001
                && Math.abs(mrd1MM - preset.mrd1MM) < 0.05;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`clinical-preset clinical-preset--${preset.tone}${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => applyClinicalPreset(preset)}
                >
                  <span className="clinical-preset__emoji" aria-hidden="true">{preset.emoji}</span>
                  <span className="clinical-preset__copy">
                    <strong>{preset.label}</strong>
                    <small>{preset.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="field-hint mt-2 flex items-start gap-1.5">
          <ShieldCheck size={13} aria-hidden="true" />
          الحسابات تعتمد على قطر القزحية الأفقي (HVID) وقياس محلي بالكامل. لا تُرفع الصور إلى أي خدمة سحابية.
        </p>
      </section>

      <section className="m3-card card-pad">
        <div className="card-head">
          <div>
            <h2 className="card-head__title">
              <Eye size={20} aria-hidden="true" />
              القياسات والتقييم السريري
            </h2>
            <p className="card-head__sub">
              تُحدّث القيم فور تعديل نقاط الحدقة أو الانعكاس أو حد الجفن على الصورة.
            </p>
          </div>
          <span className="pill pill--neutral">
            <Activity size={13} aria-hidden="true" />
            HVID 11.7 مم
          </span>
        </div>

        <div className={`status-pill ${alignmentState === 'pass' ? 'is-pass' : alignmentState === 'warn' ? 'is-warn' : 'is-idle'}`} role="status">
          <span className="status-pill__label">
            {alignmentState === 'pass' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
            حالة المحاذاة العينية
          </span>
          <span className="status-pill__value">
            {alignmentState === 'pass' && 'طبيعي مبدئياً'}
            {alignmentState === 'warn' && 'يحتاج مراجعة سريرية'}
            {alignmentState === 'idle' && 'بانتظار القياس'}
          </span>
        </div>

        <div className="reading-grid mt-2">
          <div className="reading-box">
            <span>عدم تماثل الانعكاس — Hirschberg</span>
            <strong>{hirschbergRecorded ? `${formatMM(hirschbergMM)} mm` : '—'}</strong>
            <small>{hirschbergRecorded ? `${prismDiopters}PD تقديري` : 'بانتظار التحليل'}</small>
          </div>
          <div className="reading-box">
            <span>مسافة الجفن العلوي — MRD₁</span>
            <strong>{mrd1Recorded ? `${mrd1MM.toFixed(1)} mm` : '—'}</strong>
            <small>{mrd1Recorded ? (mrd1MM < 2.5 ? 'اشتباه تدلي جفن' : 'ضمن الحدود') : 'بانتظار التحليل'}</small>
          </div>
        </div>

        <div className="tap-section">
          <h3 className="section-title">
            <Eye size={16} aria-hidden="true" />
            الفحص الخارجي الظاهر
          </h3>
          <button
            type="button"
            className={`external-gate-pass${externalEyeScreened && externalEyeFindings.length === 0 && !externalEyeGateAbnormal ? ' is-active' : ''}`}
            aria-pressed={externalEyeScreened && externalEyeFindings.length === 0 && !externalEyeGateAbnormal}
            onClick={applyHealthyExternalEye}
          >
            <CheckCircle2 size={24} aria-hidden="true" />
            <span>
              <strong>✓ الفحص الخارجي طبيعي</strong>
              <small>لا احمرار، لا إفرازات ظاهرة، ولا انحراف ملحوظ.</small>
            </span>
          </button>

          <button
            type="button"
            className="external-gate-toggle"
            aria-expanded={externalEyeGateAbnormal}
            onClick={() => {
              setExternalEyeGateAbnormal((open) => !open);
              setExternalEyeScreened(true);
            }}
          >
            {externalEyeGateAbnormal ? 'إخفاء ملاحظات الفحص الخارجي غير الطبيعية' : 'إضافة ملاحظة للفحص الخارجي غير الطبيعي'}
          </button>

          {externalEyeGateAbnormal && (
            <div className="external-gate-chips" role="group" aria-label="ملاحظات الفحص الخارجي">
              {EYE_FINDINGS.filter((finding) => EXTERNAL_GATE_IDS.some((id) => id === finding.id)).map((finding) => {
                const selected = externalEyeFindings.includes(finding.id);
                return (
                  <button
                    key={finding.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleFinding(finding.id)}
                    className={`external-gate-chip external-gate-chip--${finding.tone}`}
                  >
                    <span>{finding.short}</span>
                    {selected && <CheckCircle2 size={16} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}

          {externalEyeScreened && externalEyeFindings.length > 0 && (
            <p className="external-gate-summary" role="status">
              تم تسجيل {externalEyeFindings.length} ملاحظة خارجية. سيُرفع العلم السريري وفقاً للضوابط.
            </p>
          )}
        </div>

        <div className="tap-section">
          <div className="flex items-center justify-between gap-2">
            <h3 className="section-title">
              <Sparkles size={16} aria-hidden="true" />
              أعراض الإجهاد البصري
            </h3>
            <span className="pill pill--primary">{asthenopiaScore} من 5</span>
          </div>
          <div className="grid gap-3">
            {ASTHENOPIA_SIGNS.map((item) => {
              const selected =
                (item.key === 'squint' && symptomSquint) ||
                (item.key === 'tilt' && symptomTilt) ||
                (item.key === 'rub' && symptomRub) ||
                (item.key === 'close' && symptomClose) ||
                (item.key === 'headache' && symptomHeadache);
              const toggle = () => {
                if (item.key === 'squint') setSymptomSquint(!symptomSquint);
                if (item.key === 'tilt') setSymptomTilt(!symptomTilt);
                if (item.key === 'rub') setSymptomRub(!symptomRub);
                if (item.key === 'close') setSymptomClose(!symptomClose);
                if (item.key === 'headache') setSymptomHeadache(!symptomHeadache);
              };
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={toggle}
                  className="rounded-2xl p-3.5 border-2 transition-all flex items-center justify-between text-right"
                  style={{
                    borderColor: 'var(--m3-border)',
                    backgroundColor: selected ? 'color-mix(in srgb, var(--m3-warn) 14%, transparent)' : 'transparent',
                  }}
                >
                  <span>{item.label}</span>
                  {selected && <CheckCircle2 size={18} style={{ color: 'var(--m3-warn)' }} />}
                </button>
              );
            })}
          </div>
        </div>

        <details className="m3-details advanced-details">
          <summary>
            <span className="flex items-center gap-2">
              <Sliders size={16} aria-hidden="true" />
              ضبط القيم والتحقق اليدوي
            </span>
            <span className="text-[10px] font-semibold text-slate-400">للمراجع فقط</span>
          </summary>
          <div className="details-body">
            <div className="slider-row">
              <div className="slider-row__head">
                <span>عدم التماثل — Hirschberg</span>
                <output>{hirschbergRecorded ? `${formatMM(hirschbergMM)} mm` : 'غير مسجل'}</output>
              </div>
              <input
                type="range"
                className="m3-range"
                min={0}
                max={3}
                step={0.05}
                value={hirschbergMM}
                onChange={(event) => {
                  setHirschbergMM(Number(event.target.value));
                  setHirschbergRecorded(true);
                  setAIQualityFlag(3);
                }}
                aria-label="قيمة Hirschberg بالمليمتر"
              />
              <div className="flex justify-between text-[10px] text-[var(--m3-muted)] mono">
                <span>0.0</span><span>1.0</span><span>3.0 mm</span>
              </div>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                <span>مسافة الجفن العلوي — MRD₁</span>
                <output>{mrd1Recorded ? `${mrd1MM.toFixed(1)} mm` : 'غير مسجل'}</output>
              </div>
              <input
                type="range"
                className="m3-range"
                min={0.5}
                max={6}
                step={0.1}
                value={mrd1MM}
                onChange={(event) => {
                  setMrd1MM(Number(event.target.value));
                  setMrd1Recorded(true);
                  setAIQualityFlag(3);
                }}
                aria-label="قيمة MRD1 بالمليمتر"
              />
              <div className="flex justify-between text-[10px] text-[var(--m3-muted)] mono">
                <span>0.5</span><span>2.5</span><span>6.0 mm</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => runAutoDetection(userImage, bypassAuto)}
                disabled={!userImage}
                className="m3-btn m3-btn--secondary m3-btn--sm"
              >
                <Sparkles size={14} aria-hidden="true" />
                إعادة الكشف التلقائي
              </button>
              <span className="field-hint">HVID = 11.7 mm</span>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                <span>مصدر القياس — AI_Quality_Flag</span>
                <output>
                  {aiQualityFlag === 1 && 'تلقائي (1)'}
                  {aiQualityFlag === 2 && 'محاولة ثانية (2)'}
                  {aiQualityFlag === 3 && 'تحديد يدوي (3)'}
                  {!aiQualityFlag && 'غير مسجل'}
                </output>
              </div>
              <div className="segmented w-fit">
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={aiQualityFlag === 1}
                  onClick={() => setAIQualityFlag(1)}
                >
                  1 — تلقائي
                </button>
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={aiQualityFlag === 2}
                  onClick={() => setAIQualityFlag(2)}
                >
                  2 — إعادة
                </button>
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={aiQualityFlag === 3}
                  onClick={() => setAIQualityFlag(3)}
                >
                  3 — يدوي
                </button>
              </div>
              <p className="field-hint">
                يجب أن تعكس هذه القيمة طريقة القراءة الفعلية: تلقائي، إعادة تصوير، أو تحديد يدوي على الصورة.
              </p>
            </div>
          </div>
        </details>

        <div className={`notice mt-3 ${triageOcularFlag === 0 && hirschbergRecorded && mrd1Recorded ? 'notice--pass' : 'notice--warn'}`}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            {(!hirschbergRecorded || !mrd1Recorded) && 'لم تكتمل قيم Hirschberg و MRD₁ بعد. التقط صورة واضحة أو استخدم التحديد اليدوي.'}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 0 && 'القياسات ضمن الحدود المبدئية. تابع إلى تحليل النتائج.'}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 1 && `اشتباه حَوَل — ${prismDiopters} PD تقديري.`}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 2 && `قيمة MRD₁ أقل من الحد (${mrd1MM.toFixed(1)} mm).`}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 3 && 'اشتباه حَوَل مع تدلي جفن — يحتاج تقييماً سريرياً.'}
          </span>
        </div>

        <button type="button" onClick={onProceedToCDSS} className="m3-btn m3-btn--primary m3-btn--block mt-3">
          المتابعة إلى التحليل السريري
          <ChevronDown size={16} className="-rotate-90" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
};
