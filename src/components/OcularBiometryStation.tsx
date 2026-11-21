import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Eye,
  Lock,
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
  QUALITY_MESSAGE_BLUR,
  QUALITY_MESSAGE_GLARE,
  STANDARD_PEDIATRIC_HVID_MM,
  analyzeOcularFrame,
  computeMRD1FromLandmarks,
  computeNetHirschberg,
  eyeAtAnalysisPoint,
  mergeOcularAnalyses,
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
type StabilityState = 'idle' | 'unstable' | 'stable';

type ExtendedTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string;
  exposureMode?: string;
  whiteBalanceMode?: string;
  /** Rear-camera torch (flash) — present on `MediaTrackSupportedConstraints` only. */
  torch?: boolean;
};

type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  /** True when the device exposes a hardware torch for this track. */
  torch?: boolean;
};

interface StabilityTracker {
  previous: Float32Array | null;
  previousMean: number;
  smoothedMotion: number;
  stableSince: number;
  state: StabilityState;
  locked: boolean;
  locking: boolean;
  lockedAt: number;
  unstableStreak: number;
  lockSuppressedUntil: number;
}

const BURST_FRAME_COUNT = 3;
const BURST_INTERVAL_MS = 150;
const STABILITY_SAMPLE_MS = 120;
const STABILITY_SETTLE_MS = 850;
const STABILITY_STABLE_MOTION = 0.018;
const STABILITY_UNSTABLE_MOTION = 0.04;
const STABILITY_UNSTABLE_STREAK = 6;
const CAMERA_LOCK_GRACE_MS = 1200;
const CAMERA_LOCK_SUPPRESS_MS = 3500;

const waitFor = (milliseconds: number): Promise<void> => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

/**
 * Grabs a full-sensor-resolution frame from the video element.
 * This deliberately never uses the CSS-scaled preview dimensions.
 */
const captureVideoFrame = (video: HTMLVideoElement): HTMLCanvasElement | null => {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const canvasToImage = (canvas: HTMLCanvasElement): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('تعذر تجهيز معاينة الصورة الملتقطة.'));
  image.src = canvas.toDataURL('image/png');
});

/**
 * Applies supported `advanced` track constraints. If a browser rejects the
 * combined set, each capability is retried alone so partial AE/AF support
 * still benefits from the lock instead of failing the whole capture flow.
 */
const applyAdvancedTrackConstraints = async (
  track: MediaStreamTrack,
  constraints: ExtendedTrackConstraintSet,
): Promise<string[]> => {
  const keys = Object.keys(constraints).filter((key) => (
    constraints[key as keyof ExtendedTrackConstraintSet] !== undefined
  ));
  if (keys.length === 0) return [];

  try {
    await track.applyConstraints({ advanced: [constraints] } as MediaTrackConstraints);
    return keys;
  } catch {
    const applied: string[] = [];
    for (const key of keys) {
      const value = constraints[key as keyof ExtendedTrackConstraintSet];
      if (value === undefined) continue;
      try {
        await track.applyConstraints({
          advanced: [{ [key]: value }],
        } as MediaTrackConstraints);
        applied.push(key);
      } catch {
        // Capability is advertised but the device rejects this mode.
      }
    }
    return applied;
  }
};

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
  /**
   * Receives the compressed diagnostic-clarity photo of the current child.
   * App.tsx stores the blob in IndexedDB (keyed by Child_ID) and uploads it to
   * Supabase Storage during the next cloud sync.
   */
  onEyePhotoCaptured?: (photo: { blob: Blob; dataUrl: string }) => void;
  onProceedToCDSS: () => void;
}

interface AuditPointSet {
  pupil: ImagePoint | null;
  reflex: ImagePoint | null;
  eyelid: ImagePoint | null;
}

interface OcularApplyResult {
  applied: boolean;
  mrdAvailable: boolean;
}

/**
 * WHO 2025 / AAPOS pediatric external-eye red flags.
 * Exactly five findings; every one of them is visible when the examiner opens
 * the "abnormal" list. `LEUKOCORIA`, `CORNEAL_HAZINESS`, `ANISOCORIA` and
 * `EYE_MISALIGNMENT` mandate an urgent (48 h) referral, `SCLERAL_REDNESS`
 * mandates a standard (2-week PHCC) referral.
 */
const EYE_FINDINGS = [
  { id: 'LEUKOCORIA', short: 'انعكاس حدقي أبيض / غير طبيعي', tone: 'urgent' },
  { id: 'CORNEAL_HAZINESS', short: 'عتامة أو تندب القرنية', tone: 'urgent' },
  { id: 'SCLERAL_REDNESS', short: 'احمرار ملتحمة حاد أو إفرازات قيحية', tone: 'warn' },
  { id: 'ANISOCORIA', short: 'تفاوت واضح في حجم الحدقتين', tone: 'urgent' },
  { id: 'EYE_MISALIGNMENT', short: 'انحراف أو حول ظاهر بالعين المجردة', tone: 'urgent' },
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
    signedOffsetPx: null,
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
  const signedOffsetPx = points.pupil && points.reflex
    ? points.reflex.x - points.pupil.x
    : null;

  return {
    ...base,
    eye,
    pupil: points.pupil,
    reflex: points.reflex,
    upperLid: points.eyelid,
    offsetPx,
    signedOffsetPx,
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
  onEyePhotoCaptured,
  onProceedToCDSS,
}) => {
  const { notify } = useFeedback();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hadRetakeRef = useRef(false);
  const lidWarningShownRef = useRef(false);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraCapabilitiesRef = useRef<ExtendedTrackCapabilities | null>(null);
  const cameraLockedRef = useRef(false);
  const stabilityMonitorRef = useRef<number | null>(null);
  const stabilitySampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const burstActiveRef = useRef(false);
  const stabilityTrackerRef = useRef<StabilityTracker>({
    previous: null,
    previousMean: 0,
    smoothedMotion: 1,
    stableSince: 0,
    state: 'idle',
    locked: false,
    locking: false,
    lockedAt: 0,
    unstableStreak: 0,
    lockSuppressedUntil: 0,
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  /** Rear camera by default: higher resolution and the correct view for examining a child. */
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [isShutterActive, setIsShutterActive] = useState(false);
  const [stabilityState, setStabilityState] = useState<StabilityState>('idle');
  const [cameraLockLabel, setCameraLockLabel] = useState('');
  const [burstActive, setBurstActive] = useState(false);

  const [autoStatus, setAutoStatus] = useState<AutoStatus>('idle');
  const [autoMessage, setAutoMessage] = useState('');
  const [qualityState, setQualityState] = useState<QualityState>('idle');
  const [qualityMessage, setQualityMessage] = useState('');

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
    if (stabilityMonitorRef.current !== null) {
      window.clearTimeout(stabilityMonitorRef.current);
      stabilityMonitorRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const stopStabilityMonitor = useCallback(() => {
    if (stabilityMonitorRef.current !== null) {
      window.clearTimeout(stabilityMonitorRef.current);
      stabilityMonitorRef.current = null;
    }
    stabilitySampleCanvasRef.current = null;
    stabilityTrackerRef.current = {
      previous: null,
      previousMean: 0,
      smoothedMotion: 1,
      stableSince: 0,
      state: 'idle',
      locked: false,
      locking: false,
      lockedAt: 0,
      unstableStreak: 0,
      lockSuppressedUntil: 0,
    };
    setStabilityState('idle');
  }, []);

  const stopCamera = useCallback(() => {
    stopStabilityMonitor();
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    cameraTrackRef.current = null;
    cameraCapabilitiesRef.current = null;
    cameraLockedRef.current = false;
    setCameraLockLabel('');
    setTorchOn(false);
    setTorchSupported(false);
    setCameraActive(false);
    setCameraError('');
  }, [stopStabilityMonitor]);

  /**
   * Applies HVID-normalized geometry to the two validated ocular fields.
   * The measured values are always clamped into the admissible pediatric range.
   */
  const applyMetricsFromAudit = useCallback((
    points: Record<EyeKey, AuditPointSet>,
    source: OcularFrameAnalysis,
    manual: boolean,
  ): OcularApplyResult => {
    const od = toEyeLandmarks('OD', points.OD, source.landmarks.OD);
    const os = toEyeLandmarks('OS', points.OS, source.landmarks.OS);

    if (od.offsetPx === null && os.offsetPx === null) {
      return { applied: false, mrdAvailable: false };
    }

    const net = computeNetHirschberg({ OD: od, OS: os }, source.mmPerPx);
    const mrdCandidates = [
      computeMRD1FromLandmarks(od, source.mmPerPx),
      computeMRD1FromLandmarks(os, source.mmPerPx),
    ].filter((value): value is number => value !== null);

    // MRD₁ is only committed when a lid margin was actually detected or tapped.
    // Never fabricate a lid distance from a missing landmark.
    const mrdAvailable = mrdCandidates.length > 0;
    const validated = validateOcularRanges(
      net.hirschbergAsymMm,
      mrdAvailable ? Math.min(...mrdCandidates) : mrd1MM,
    );

    setHirschbergMM(validated.hirschbergMM);
    setHirschbergRecorded(true);

    if (mrdAvailable) {
      setMrd1MM(validated.mrd1MM);
      setMrd1Recorded(true);
    } else if (!mrd1Recorded && !lidWarningShownRef.current) {
      lidWarningShownRef.current = true;
      notify('لم يتم تحديد حد الجفن العلوي — المس نقطة «حد الجفن» أو اضبط MRD₁ من الضبط اليدوي.', 'info');
    }

    setAIQualityFlag(manual ? 3 : (hadRetakeRef.current ? 2 : 1));

    if (validated.issues.length > 0) {
      notify(validated.issues.join(' '), 'info');
    }

    return { applied: true, mrdAvailable };
  }, [mrd1MM, mrd1Recorded, notify, setAIQualityFlag, setHirschbergMM, setHirschbergRecorded, setMrd1MM, setMrd1Recorded]);

  /**
   * Commits one analysed frame.
   *
   * The blur / glare checks are **soft advisories only**: the photo is always
   * kept and the measurements are always committed so a classroom capture is
   * never thrown away by an automatic score. The examiner can still refine the
   * pupil / reflex markers with one tap on the overlay.
   */
  const commitAnalysisResult = useCallback((
    result: OcularFrameAnalysis,
    options: { manual?: boolean; burstCount?: number } = {},
  ): boolean => {
    const manual = options.manual ?? false;
    const burstCount = options.burstCount ?? result.burstCount ?? 1;
    const nextPoints = pointsFromAnalysis(result);
    setAnalysis(result);
    setAuditPoints(nextPoints);

    // Soft quality advisory — never a gate.
    const advisory = result.isBlurred
      ? QUALITY_MESSAGE_BLUR
      : result.hasGlare
        ? QUALITY_MESSAGE_GLARE
        : '';
    setQualityState(advisory ? (result.isBlurred ? 'blur' : 'glare') : 'clear');
    setQualityMessage(advisory);
    if (advisory) notify(advisory, 'info');

    const outcome = applyMetricsFromAudit(nextPoints, result, manual);

    if (!outcome.applied) {
      setAutoStatus('error');
      setAutoMessage('لم نتمكن من التعرف على الحدقة والانعكاس تلقائياً — المس الصورة لتحديد النقاط يدوياً.');
      setHirschbergRecorded(false);
      setMrd1Recorded(false);
      setAIQualityFlag(0);
      notify('استخدم التحديد اليدوي على الصورة لتحديد الحدقة والانعكاس.', 'info');
      return false;
    }

    setAutoStatus('done');
    setAutoMessage(manual
      ? '⚡ تم اعتماد القياسات من التحديد اليدوي.'
      : burstCount > 1
        ? !outcome.mrdAvailable
          ? `✅ تم دمج ${burstCount} إطارات وحساب Hirschberg. لم يتم التعرف على حد الجفن — اضبط MRD₁ يدوياً.`
          : `✅ تم دمج ${burstCount} إطارات كاملة الدقة (متوسط مكاني) واعتماد القيم. راجعها قبل المتابعة.`
        : !outcome.mrdAvailable
          ? '✅ تم حساب Hirschberg تلقائياً. لم يتم التعرف على حد الجفن — اضبط MRD₁ يدوياً.'
          : hadRetakeRef.current
            ? '✅ تم تحليل الصورة وإعادة ضبط القيم (محاولة ثانية).'
            : '✅ تم تحليل الصورة تلقائياً واعتماد القيم. راجعها قبل المتابعة.');
    notify(
      burstCount > 1
        ? `تم دمج ${burstCount} إطارات كاملة الدقة وتحديث القياسات البصرية. راجع القيم قبل المتابعة.`
        : 'تم تحديث القياسات البصرية. راجع القيم قبل المتابعة.',
      'success',
    );
    return true;
  }, [
    applyMetricsFromAudit,
    notify,
    setAIQualityFlag,
    setHirschbergRecorded,
    setMrd1Recorded,
  ]);

  const runAutoDetection = useCallback((
    image: HTMLImageElement | null = userImage,
    manual = false,
  ) => {
    if (!image) {
      notify('يرجى التقاط صورة أو اختيار صورة أولاً.', 'info');
      return;
    }

    setAutoStatus('scanning');
    setAutoMessage('');

    try {
      const result = analyzeOcularFrame(image);
      commitAnalysisResult(result, { manual });
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
    commitAnalysisResult,
    notify,
    setAIQualityFlag,
    setHirschbergRecorded,
    setMrd1Recorded,
    userImage,
  ]);

  /**
   * Produces the diagnostic-clarity JPEG (1024 px / q 0.85 => ~80–150 KB) and
   * hands it to App.tsx, which stores it in IndexedDB keyed by the Child_ID and
   * uploads it to Supabase Storage on the next sync. The blob never enters
   * localStorage, so the offline record store stays small.
   */
  const emitCompressedPhoto = useCallback(async (source: HTMLCanvasElement | HTMLImageElement) => {
    if (!onEyePhotoCaptured) return;
    try {
      const { compressImageToBlob, blobToDataUrl } = await import('../utils/imageCompress');
      const blob = await compressImageToBlob(source, 1024, 0.85);
      const dataUrl = await blobToDataUrl(blob);
      onEyePhotoCaptured({ blob, dataUrl });
    } catch (error) {
      console.warn('Eye photo compression failed', error);
    }
  }, [onEyePhotoCaptured]);

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
    lidWarningShownRef.current = false;
    void emitCompressedPhoto(image);
    window.setTimeout(() => runAutoDetection(image), 60);
  }, [emitCompressedPhoto, runAutoDetection, setAIQualityFlag, setHirschbergRecorded, setMrd1Recorded]);

  const configureCameraTrack = useCallback(async (stream: MediaStream, facing: 'user' | 'environment') => {
    const track = stream.getVideoTracks()[0] ?? null;
    cameraTrackRef.current = track;
    cameraCapabilitiesRef.current = null;
    cameraLockedRef.current = false;
    setCameraLockLabel('');
    setTorchOn(false);
    if (!track) {
      setTorchSupported(false);
      return;
    }

    let capabilities: ExtendedTrackCapabilities = {};
    try {
      capabilities = (track.getCapabilities?.() ?? {}) as ExtendedTrackCapabilities;
    } catch {
      capabilities = {};
    }
    cameraCapabilitiesRef.current = capabilities;

    // Keep AE/AF/WB continuous while the examiner frames the child. The lock
    // is applied only after the stability detector confirms a settled view.
    const continuous: ExtendedTrackConstraintSet = {};
    if (capabilities.focusMode?.includes('continuous')) continuous.focusMode = 'continuous';
    if (capabilities.exposureMode?.includes('continuous')) continuous.exposureMode = 'continuous';
    if (capabilities.whiteBalanceMode?.includes('continuous')) continuous.whiteBalanceMode = 'continuous';
    if (Object.keys(continuous).length > 0) {
      await applyAdvancedTrackConstraints(track, continuous);
    }

    // Torch / flash: only the rear camera exposes it, and it removes the corneal
    // reflex washout that ruins the Hirschberg measurement in dim classrooms.
    const supportsTorch = capabilities.torch === true;
    setTorchSupported(supportsTorch);
    if (supportsTorch && facing === 'environment') {
      const applied = await applyAdvancedTrackConstraints(track, { torch: true });
      setTorchOn(applied.includes('torch'));
    }
  }, []);

  /** One-tap torch toggle (rear camera only). */
  const toggleTorch = useCallback(async () => {
    const track = cameraTrackRef.current;
    if (!track || track.readyState !== 'live') return;
    const next = !torchOn;
    const applied = await applyAdvancedTrackConstraints(track, { torch: next });
    if (applied.includes('torch')) {
      setTorchOn(next);
    } else {
      setTorchSupported(false);
      setTorchOn(false);
    }
  }, [torchOn]);

  const setCameraLock = useCallback(async (locked: boolean): Promise<boolean> => {
    const track = cameraTrackRef.current;
    if (!track || track.readyState !== 'live') {
      cameraLockedRef.current = false;
      setCameraLockLabel('');
      return false;
    }
    const capabilities = cameraCapabilitiesRef.current;
    if (!capabilities) return false;

    const constraints: ExtendedTrackConstraintSet = {};
    if (locked) {
      if (capabilities.focusMode?.includes('single-shot')) constraints.focusMode = 'single-shot';
      else if (capabilities.focusMode?.includes('manual')) constraints.focusMode = 'manual';
      if (capabilities.exposureMode?.includes('manual')) constraints.exposureMode = 'manual';
      else if (capabilities.exposureMode?.includes('single-shot')) constraints.exposureMode = 'single-shot';
    } else {
      if (capabilities.focusMode?.includes('continuous')) constraints.focusMode = 'continuous';
      if (capabilities.exposureMode?.includes('continuous')) constraints.exposureMode = 'continuous';
    }

    if (Object.keys(constraints).length === 0) {
      cameraLockedRef.current = false;
      setCameraLockLabel('');
      return false;
    }

    const appliedKeys = await applyAdvancedTrackConstraints(track, constraints);
    if (!locked) {
      cameraLockedRef.current = false;
      setCameraLockLabel('');
      return appliedKeys.length > 0;
    }

    const focusLocked = appliedKeys.includes('focusMode');
    const exposureLocked = appliedKeys.includes('exposureMode');
    const label = focusLocked && exposureLocked ? 'AF/AE' : focusLocked ? 'AF' : exposureLocked ? 'AE' : '';
    cameraLockedRef.current = Boolean(label);
    setCameraLockLabel(label);
    return Boolean(label);
  }, []);

  /**
   * Frame-to-frame luminance differencing on a tiny 80×45 sample. It detects
   * camera shake and exposure jumps without touching the full-resolution
   * capture path, then locks AE/AF when the scene has been stable long enough.
   */
  const startStabilityMonitor = useCallback(() => {
    stopStabilityMonitor();
    const video = videoRef.current;
    if (!video) return;

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 80;
    sampleCanvas.height = 45;
    stabilitySampleCanvasRef.current = sampleCanvas;
    const tracker = stabilityTrackerRef.current;
    tracker.state = 'unstable';
    tracker.smoothedMotion = 1;
    setStabilityState('unstable');

    function schedule() {
      if (stabilitySampleCanvasRef.current !== sampleCanvas) return;
      stabilityMonitorRef.current = window.setTimeout(tick, STABILITY_SAMPLE_MS);
    }

    function tick() {
      stabilityMonitorRef.current = null;
      const activeVideo = videoRef.current;
      const canvas = stabilitySampleCanvasRef.current;
      if (!activeVideo || !canvas) return;
      if (activeVideo.readyState < 2 || activeVideo.videoWidth === 0) {
        schedule();
        return;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        schedule();
        return;
      }

      context.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const luma = new Float32Array(canvas.width * canvas.height);
      let sum = 0;
      for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
        const value = (0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2]) / 255;
        luma[pixel] = value;
        sum += value;
      }
      const mean = sum / luma.length;
      const now = performance.now();
      const state = stabilityTrackerRef.current;

      if (state.previous && state.previous.length === luma.length) {
        let absoluteDifference = 0;
        for (let index = 0; index < luma.length; index += 1) {
          absoluteDifference += Math.abs(luma[index] - state.previous[index]);
        }
        const frameDelta = absoluteDifference / luma.length;
        const exposureDelta = Math.max(0, Math.abs(mean - state.previousMean) - 0.02);
        const motion = frameDelta + exposureDelta * 0.8;
        state.smoothedMotion = state.smoothedMotion * 0.55 + motion * 0.45;

        const threshold = state.state === 'stable'
          ? STABILITY_UNSTABLE_MOTION
          : STABILITY_STABLE_MOTION;
        const stableNow = state.smoothedMotion < threshold;

        if (stableNow) {
          state.unstableStreak = 0;
          if (state.stableSince === 0) state.stableSince = now;
          const settled = now - state.stableSince >= STABILITY_SETTLE_MS;
          if (state.state !== 'stable' && settled && !burstActiveRef.current) {
            state.state = 'stable';
            setStabilityState('stable');
            if (!state.locked && !state.locking && now >= state.lockSuppressedUntil) {
              state.locking = true;
              void setCameraLock(true).then((applied) => {
                state.locking = false;
                if (applied) {
                  state.locked = true;
                  state.lockedAt = performance.now();
                } else {
                  state.lockSuppressedUntil = performance.now() + CAMERA_LOCK_SUPPRESS_MS;
                }
              });
            }
          }
        } else {
          state.stableSince = 0;
          state.unstableStreak += 1;
          if (
            state.state === 'stable'
            && state.unstableStreak >= STABILITY_UNSTABLE_STREAK
            && now - state.lockedAt >= CAMERA_LOCK_GRACE_MS
          ) {
            state.state = 'unstable';
            setStabilityState('unstable');
            if (state.locked) {
              state.locked = false;
              state.lockSuppressedUntil = now + CAMERA_LOCK_SUPPRESS_MS;
              void setCameraLock(false);
            }
          }
        }
      }

      state.previous = luma;
      state.previousMean = mean;
      schedule();
    }

    stabilityMonitorRef.current = window.setTimeout(tick, 40);
  }, [setCameraLock, stopStabilityMonitor]);

  const startCamera = async (facing: 'user' | 'environment' = cameraFacingMode) => {
    if (cameraStarting || burstActiveRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'تعذر الوصول إلى الكاميرا على هذا المتصفح. استخدم زر رفع الصورة بدلاً منها.';
      setCameraError(message);
      notify(message, 'error');
      return;
    }

    stopStabilityMonitor();
    if (videoRef.current?.srcObject) {
      const existing = videoRef.current.srcObject as MediaStream;
      existing.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    cameraTrackRef.current = null;
    cameraCapabilitiesRef.current = null;
    cameraLockedRef.current = false;
    setCameraLockLabel('');

    setCameraStarting(true);
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
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
      await configureCameraTrack(stream, facing);
      setCameraActive(true);
      setCameraFacingMode(facing);
      startStabilityMonitor();
    } catch {
      stopStabilityMonitor();
      const video = videoRef.current;
      if (video?.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      cameraTrackRef.current = null;
      cameraCapabilitiesRef.current = null;
      cameraLockedRef.current = false;
      setCameraLockLabel('');
      const message = 'تعذر فتح الكاميرا. تحقق من الصلاحيات أو استخدم رفع الصورة.';
      setCameraError(message);
      notify(message, 'error');
    } finally {
      setCameraStarting(false);
    }
  };

  /** One-tap switch between the rear and the front camera. */
  const toggleCameraFacing = () => {
    const next: 'user' | 'environment' = cameraFacingMode === 'environment' ? 'user' : 'environment';
    void startCamera(next);
  };

  /**
   * 3-frame full-resolution burst (0 / 150 / 300 ms). Each frame is analysed
   * independently and the landmark coordinates are spatially median-fused.
   */
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      notify('انتظر ثانية حتى تبدأ معاينة الكاميرا.', 'info');
      return;
    }
    if (burstActiveRef.current) return;

    burstActiveRef.current = true;
    setBurstActive(true);
    setIsShutterActive(true);
    window.setTimeout(() => setIsShutterActive(false), 220);
    setAutoStatus('scanning');
    setAutoMessage(`جارٍ التقاط ${BURST_FRAME_COUNT} إطارات كاملة الدقة ودمجها مكانياً...`);

    try {
      if (!cameraLockedRef.current) {
        const lockedNow = await setCameraLock(true);
        if (lockedNow) await waitFor(180);
      }

      const frames: HTMLCanvasElement[] = [];
      for (let index = 0; index < BURST_FRAME_COUNT; index += 1) {
        if (index > 0) await waitFor(BURST_INTERVAL_MS);
        const frame = captureVideoFrame(video);
        if (frame) frames.push(frame);
      }
      if (frames.length === 0) {
        throw new Error('تعذر التقاط إطار صالح من الكاميرا. أعد المحاولة أو استخدم رفع الصورة.');
      }

      setAutoMessage(`جارٍ تحليل ${frames.length} إطارات واستخراج الحدقة والانعكاس...`);
      await waitFor(0);
      const analyses = frames.map((frame) => analyzeOcularFrame(frame));
      const merged = mergeOcularAnalyses(analyses);
      const sharpestIndex = analyses.reduce(
        (bestIndex, current, index) => (
          current.sharpness > analyses[bestIndex].sharpness ? index : bestIndex
        ),
        0,
      );
      const preview = await canvasToImage(frames[sharpestIndex]);

      stopCamera();
      if (userImage) hadRetakeRef.current = true;
      setUserImage(preview);
      setAnalysis(merged);
      setAuditPoints(pointsFromAnalysis(merged));
      setQualityState('idle');
      setQualityMessage('');
      setAIQualityFlag(0);
      setHirschbergRecorded(false);
      setMrd1Recorded(false);
      lidWarningShownRef.current = false;
      setAutoStatus('scanning');
      setAutoMessage(`تم دمج ${frames.length} إطارات — جارٍ تطبيق بوابة الجودة...`);
      await waitFor(0);
      // The photo is always captured with a single tap: compress the sharpest
      // full-resolution frame straight away, before any quality advisory.
      void emitCompressedPhoto(frames[sharpestIndex]);
      commitAnalysisResult(merged, { burstCount: frames.length });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'تعذر التقاط الصورة. حاول مرة أخرى أو استخدم رفع الصورة.';
      setAutoStatus('error');
      setAutoMessage(message);
      setQualityState('idle');
      notify(message, 'error');
    } finally {
      setIsShutterActive(false);
      burstActiveRef.current = false;
      setBurstActive(false);
      void setCameraLock(false);
    }
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
    hadRetakeRef.current = false;
    lidWarningShownRef.current = false;
    setAIQualityFlag(0);
    setHirschbergRecorded(false);
    setMrd1Recorded(false);
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
    const outcome = applyMetricsFromAudit(nextPoints, source, true);

    if (outcome.applied) {
      setQualityState('clear');
      setQualityMessage('');
      setAutoStatus('done');
      const pointLabel = auditType === 'pupil' ? 'الحدقة' : auditType === 'reflex' ? 'الانعكاس' : 'الجفن';
      setAutoMessage(outcome.mrdAvailable
        ? `تم ضبط نقطة ${pointLabel} يدوياً — AI_Quality_Flag = 3.`
        : `تم ضبط نقطة ${pointLabel} يدوياً — AI_Quality_Flag = 3. حدد نقطة «حد الجفن» أو اضبط MRD₁ يدوياً.`);
    } else {
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

  const hasSuspicion = hirschbergRecorded && mrd1Recorded && (hirschbergMM >= 1.0 || mrd1MM < 2.5);
  const alignmentState = !hirschbergRecorded || !mrd1Recorded ? 'idle' : hasSuspicion ? 'warn' : 'pass';
  const prismDiopters = convertHirschbergToPrism(hirschbergMM);

  const renderEyeAuditHud = (eye: EyeKey) => {
    const points = auditPoints[eye];
    return (
      <g key={eye}>
        {points.pupil && (
          <g>
            <line
              x1={points.pupil.x - 12}
              y1={points.pupil.y}
              x2={points.pupil.x + 12}
              y2={points.pupil.y}
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={points.pupil.x}
              y1={points.pupil.y - 12}
              x2={points.pupil.x}
              y2={points.pupil.y + 12}
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={points.pupil.x}
              cy={points.pupil.y}
              r="5"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <text x={points.pupil.x + 16} y={points.pupil.y - 12} fill="#fecaca" fontSize="12" fontWeight="800" stroke="#450a0a" strokeWidth="2.5" paintOrder="stroke">
              {eye}
            </text>
          </g>
        )}
        {points.reflex && (
          <g>
            <circle
              cx={points.reflex.x}
              cy={points.reflex.y}
              r="8"
              fill="rgba(34,211,238,0.16)"
              stroke="#22d3ee"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={points.reflex.x} cy={points.reflex.y} r="2.7" fill="#22d3ee" />
          </g>
        )}
        {points.eyelid && (
          <g>
            <line
              x1={points.eyelid.x - 11}
              y1={points.eyelid.y}
              x2={points.eyelid.x + 11}
              y2={points.eyelid.y}
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="3 2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
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
              تقييم الحدقة والانعكاس القرني وتدلي الجفن.
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
              <div className="capture-viewfinder-controls">
                <button
                  type="button"
                  className="capture-control-btn"
                  onClick={toggleCameraFacing}
                  disabled={cameraStarting || burstActive}
                  aria-label="تبديل الكاميرا بين الخلفية والأمامية"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  🔄 تبديل الكاميرا (خلفية / أمامية)
                </button>
                {torchSupported && (
                  <button
                    type="button"
                    className={`capture-control-btn capture-control-btn--torch${torchOn ? ' is-active' : ''}`}
                    onClick={() => void toggleTorch()}
                    disabled={burstActive}
                    aria-pressed={torchOn}
                    aria-label="تشغيل أو إيقاف فلاش الكاميرا"
                  >
                    <Zap size={15} aria-hidden="true" />
                    {torchOn ? 'الفلاش مُفعّل' : 'تشغيل الفلاش'}
                  </button>
                )}
              </div>
              <span className="capture-guide-label">
                ضع وجه الطفل داخل الدائرتين — ابتعد 40–60 سم
              </span>
              <div className="camera-status-cluster">
                <span
                  className={`stability-badge${stabilityState === 'stable' ? ' is-stable' : ' is-unstable'}${burstActive ? ' is-bursting' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {burstActive
                    ? `⏺ جارٍ التقاط ${BURST_FRAME_COUNT} إطارات كاملة الدقة...`
                    : stabilityState === 'stable'
                      ? '🟢 ثابت وجاهز للتقاط'
                      : '🔴 حرّك الهاتف بثبات...'}
                </span>
                {cameraLockLabel && (
                  <span className="camera-lock-badge" title="تم تثبيت التركيز والتعرض لتقليل التغيّر أثناء الالتقاط">
                    <Lock size={11} aria-hidden="true" />
                    {cameraLockLabel} مقفول
                  </span>
                )}
              </div>
              <span className="capture-hint">
                <CheckCircle2 size={14} aria-hidden="true" />
                حافظ على ثبات الكاميرا وأزل الانعكاسات المباشرة
              </span>
            </>
          ) : userImage ? (
            <div
              className="precision-frame"
              ref={previewRef}
              onPointerDown={handlePreviewPointerDown}
              role="group"
              aria-label="معاينة العين مع طبقة التدقيق البصري. المس الصورة لتعديل نقطة الحدقة أو الانعكاس أو حد الجفن."
            >
              <img src={userImage.src} alt="صورة العين الملتقطة للتحليل" draggable={false} />
              <svg className="precision-hud" viewBox={`0 0 ${ANALYSIS_WIDTH} ${ANALYSIS_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                {(['OD', 'OS'] as EyeKey[]).map(renderEyeAuditHud)}
              </svg>
              <span className="precision-tap-hint" aria-hidden="true">
                المس لتعديل الحدقة (أحمر) أو الانعكاس (سماوي)
              </span>
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
            onClick={() => (cameraActive ? void capturePhoto() : void startCamera())}
            className={`m3-btn m3-btn--primary m3-btn--block${cameraActive && stabilityState === 'stable' && !burstActive ? ' capture-ready' : ''}`}
            disabled={cameraStarting || burstActive}
            aria-busy={burstActive}
          >
            {burstActive ? <span className="capture-inline-spinner" aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
            {cameraStarting
              ? 'جارٍ تشغيل الكاميرا…'
              : cameraActive
                ? burstActive
                  ? `جارٍ دمج ${BURST_FRAME_COUNT} إطارات كاملة الدقة…`
                  : stabilityState === 'stable'
                    ? `التقاط ${BURST_FRAME_COUNT} إطارات (ثابت الآن)`
                    : 'التقاط الصورة الآن'
                : userImage
                  ? 'إعادة التصوير'
                  : 'فتح الكاميرا'}
          </button>

          {cameraActive && !burstActive && (
            <p className="capture-burst-note">
              <Sparkles size={13} aria-hidden="true" />
              ٣ إطارات خلال ٣٠٠ مللي ثانية لخفض اهتزاز اليد.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            <label className="m3-btn m3-btn--outline cursor-pointer flex-1">
              <Upload size={17} aria-hidden="true" />
              رفع صورة
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            {!cameraActive && (
              <button
                type="button"
                className="m3-btn m3-btn--outline"
                onClick={toggleCameraFacing}
                disabled={cameraStarting}
              >
                <RefreshCw size={16} aria-hidden="true" />
                🔄 تبديل الكاميرا (خلفية / أمامية)
              </button>
            )}
            {userImage && (
              <button type="button" className="m3-btn m3-btn--outline" onClick={resetImage}>
                <RefreshCw size={16} aria-hidden="true" />
                مسح الصورة
              </button>
            )}
          </div>
        </div>

        {qualityMessage ? (
          <div className="notice notice--warn quality-banner mt-3" role="status">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>تلميح جودة الصورة (غير معطّل)</strong>
              <p>{qualityMessage}</p>
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
          التحليل محلي بالكامل — تُحفظ الصورة محلياً وتُرفع إلى حسابك أثناء المزامنة.
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
              تُحدّث القيم فور تعديل نقاط الصورة.
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
              <strong>✅ العينان سليمتان ظاهرياً</strong>
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
              {EYE_FINDINGS.map((finding) => {
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
              تم تسجيل {externalEyeFindings.length} ملاحظة خارجية.
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
              تعديل يدوي متقدم
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
                onClick={() => runAutoDetection(userImage, false)}
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
                اختر طريقة القراءة الفعلية.
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
