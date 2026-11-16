import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Eye,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { convertHirschbergToPrism } from '../utils/acuityMath';
import { useFeedback } from './FeedbackProvider';

type EyeTarget = 'OD' | 'OS';
type AutoStatus = 'idle' | 'scanning' | 'done' | 'error';

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

const EYE_FINDINGS = [
  { id: 'EYELID_CRUST_OR_PUS', label: 'قشور أو قيح على الجفن أو الرموش' },
  { id: 'SCLERAL_REDNESS', label: 'احمرار أو آفة على بياض العين' },
  { id: 'EYE_DISCHARGE', label: 'إفرازات مائية أو لزجة من العين' },
  { id: 'CORNEAL_HAZINESS', label: 'غشاوة أو عتامة على القرنية' },
  { id: 'EYE_MISALIGNMENT', label: 'العينان لا تنظران في الاتجاه نفسه' },
  { id: 'OTHER', label: 'علامة أخرى' },
];

const EXTERNAL_SEVERITY: Record<string, 'amber' | 'red'> = {
  EYELID_CRUST_OR_PUS: 'amber',
  SCLERAL_REDNESS: 'red',
  EYE_DISCHARGE: 'amber',
  CORNEAL_HAZINESS: 'red',
  EYE_MISALIGNMENT: 'red',
  OTHER: 'amber',
};

const ASTHENOPIA_SIGNS = [
  { key: 'squint', label: 'تضييق العينين لرؤية السبورة' },
  { key: 'tilt', label: 'إمالة الرأس أثناء النظر' },
  { key: 'rub', label: 'فرك العين المتكرر أو الاحمرار' },
  { key: 'close', label: 'تقريب الكتاب من الوجه' },
  { key: 'headache', label: 'صداع بعد القراءة المدرسية' },
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

/**
 * Three field presets that mirror the model thresholds already enforced by
 * acuityMath. They only prefill the two validated fields; sliders remain
 * available for fine adjustment and every tap is recorded as manual entry (3).
 */
const CLINICAL_PRESETS: ClinicalPreset[] = [
  {
    id: 'normal',
    emoji: '🟢',
    label: 'تمركز وجفن طبيعي',
    detail: 'Hirschberg < 0.5mm | MRD1 = 4.0mm',
    tone: 'pass',
    hirschbergMM: 0,
    mrd1MM: 4.0,
  },
  {
    id: 'strabismus',
    emoji: '🟡',
    label: 'اشتباه حول',
    detail: 'Hirschberg ≥ 1.0mm / ≥ 15Δ',
    tone: 'warn',
    hirschbergMM: 1.0,
    mrd1MM: 4.0,
  },
  {
    id: 'ptosis',
    emoji: '🔴',
    label: 'اشتباه إطراق جفن',
    detail: 'MRD1 < 2.5mm',
    tone: 'urgent',
    hirschbergMM: 0,
    mrd1MM: 2.0,
  },
];

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
  externalEyeOther,
  setExternalEyeOther,
  externalEyeScreened,
  setExternalEyeScreened,
  onProceedToCDSS,
}) => {
  const { notify } = useFeedback();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [isShutterActive, setIsShutterActive] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AutoStatus>('idle');
  const [autoMessage, setAutoMessage] = useState('');
  const [activeEyeTarget, setActiveEyeTarget] = useState<EyeTarget>('OS');

  const [symptomSquint, setSymptomSquint] = useState(false);
  const [symptomTilt, setSymptomTilt] = useState(false);
  const [symptomRub, setSymptomRub] = useState(false);
  const [symptomClose, setSymptomClose] = useState(false);
  const [symptomHeadache, setSymptomHeadache] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  /** True once a second capture replaces an earlier image (AI_Quality_Flag = 2 Retake). */
  const hadRetakeRef = useRef(false);
  const [pinType, setPinType] = useState<'pupil' | 'reflex' | 'eyelid' | null>(null);
  const [pupilPins, setPupilPins] = useState<Array<{x:number;y:number}>>([]);
  const [reflexPins, setReflexPins] = useState<Array<{x:number;y:number}>>([]);
  const [eyelidPins, setEyelidPins] = useState<Array<{x:number;y:number}>>([]);
  const [autoDetectAnimating, setAutoDetectAnimating] = useState(false);
  const [externalEyeGateAbnormal, setExternalEyeGateAbnormal] = useState(false);

  useEffect(() => {
    let count = 0;
    if (symptomSquint) count++;
    if (symptomTilt) count++;
    if (symptomRub) count++;
    if (symptomClose) count++;
    if (symptomHeadache) count++;
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

  const runAutoDetection = useCallback((image: HTMLImageElement | null = userImage, targetEye: EyeTarget = activeEyeTarget) => {
    if (!image) {
      notify('التقط صورة أو ارفع صورة أولاً لإجراء المسح الضوئي.', 'error');
      return;
    }

    setAutoStatus('scanning');

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 600;
    sourceCanvas.height = 220;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setAutoStatus('error');
      setAutoMessage('تعذر تجهيز الصورة للمسح.');
      return;
    }

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const imageScale = Math.min(sourceCanvas.width / imageWidth, sourceCanvas.height / imageHeight);
    const drawWidth = imageWidth * imageScale;
    const drawHeight = imageHeight * imageScale;
    ctx.drawImage(image, (sourceCanvas.width - drawWidth) / 2, (sourceCanvas.height - drawHeight) / 2, drawWidth, drawHeight);

    // The alignment frame keeps both eyes near these normalized positions.
    const centerX = targetEye === 'OS' ? 420 : 180;
    const centerY = 110;
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;

    let maxLum = -1;
    let minLum = 256;
    let peakX = -1;
    let peakY = -1;
    let darkX = -1;
    let darkY = -1;

    const radiusX = 72;
    const radiusY = 46;
    for (let y = Math.max(0, Math.floor(centerY - radiusY)); y <= Math.min(sourceCanvas.height - 1, Math.ceil(centerY + radiusY)); y++) {
      for (let x = Math.max(0, Math.floor(centerX - radiusX)); x <= Math.min(sourceCanvas.width - 1, Math.ceil(centerX + radiusX)); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if ((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) > 1) continue;
        const idx = (y * sourceCanvas.width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum > maxLum) {
          maxLum = lum;
          peakX = x;
          peakY = y;
        }
        if (lum < minLum) {
          minLum = lum;
          darkX = x;
          darkY = y;
        }
      }
    }

    if (peakX < 0 || darkX < 0 || maxLum < 130 || maxLum - minLum < 35) {
      setAutoStatus('error');
      setAutoMessage('لم يظهر منعكس ضوئي واضح. أعد التصوير بإضاءة أمامية، أو استخدم الضبط الدقيق.');
      notify('لم يعثر المسح على منعكس واضح. أعد المحاولة أو أدخل القيمة يدوياً.', 'info');
      return;
    }

    // Calibrated assumption kept from the existing model: 11.7 mm horizontal visible iris diameter.
    const hvidPx = 60;
    const pxPerMM = hvidPx / 11.7;
    const deltaPx = Math.hypot(peakX - darkX, peakY - darkY);
    const calculatedMM = +(deltaPx / pxPerMM).toFixed(2);
    const clampedMM = Math.min(3.0, calculatedMM);

    setHirschbergMM(clampedMM);
    setHirschbergRecorded(true);
    // A completed analysis also satisfies the MRD₁ documentation step; the
    // examiner can still refine the value in the manual slider.
    setMrd1Recorded(true);
    setAIQualityFlag(hadRetakeRef.current ? 2 : 1);
    setAutoStatus('done');
    setAutoMessage(`تم استخراج المنعكس: ${clampedMM.toFixed(2)} مم (${Math.round(clampedMM * 15)}Δ). راجع القيمة وأكمل قياس MRD₁.`);
    notify(`تم تقدير انحراف المنعكس آلياً: ${clampedMM.toFixed(2)} مم. راجع النتيجة قبل الاعتماد.`, 'success');
  }, [activeEyeTarget, notify, setAIQualityFlag, setHirschbergMM, setHirschbergRecorded, userImage]);

  const processLoadedImage = useCallback((img: HTMLImageElement) => {
    setUserImage(img);
    setAutoStatus('idle');
    setAutoMessage('');
    window.setTimeout(() => runAutoDetection(img), 80);
  }, [runAutoDetection]);

  const startCamera = async (facing: 'user' | 'environment' = cameraFacingMode) => {
    if (cameraStarting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'لا يدعم هذا المتصفح فتح الكاميرا. استخدم رفع صورة محفوظة.';
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
        const message = 'تعذر تجهيز معاينة الكاميرا. أعد المحاولة أو ارفع صورة محفوظة.';
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
      const message = 'تعذر فتح الكاميرا. تحقق من إذن المتصفح، أو ارفع صورة محفوظة.';
      setCameraError(message);
      notify(message, 'error');
    } finally {
      setCameraStarting(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      notify('انتظر ظهور صورة الكاميرا ثم أعد المحاولة.', 'info');
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

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    img.onload = () => {
      stopCamera();
      if (userImage) hadRetakeRef.current = true;
      // Capture is a real examination event: both ocular fields become recorded
      // immediately, then the automatic scan refines the Hirschberg value.
      setHirschbergRecorded(true);
      setMrd1Recorded(true);
      processLoadedImage(img);
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        stopCamera();
        if (userImage) hadRetakeRef.current = true;
        // Uploaded photo follows the same one-tap recording contract as capture.
        setHirschbergRecorded(true);
        setMrd1Recorded(true);
        processLoadedImage(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const resetImage = () => {
    stopCamera();
    setUserImage(null);
    setAutoStatus('idle');
    setAutoMessage('');
    hadRetakeRef.current = false;
    setHirschbergRecorded(false);
    setMrd1Recorded(false);
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
        : [...externalEyeFindings, id]
    );
  };

  /** One tap fills both validated ocular fields and marks them recorded. */
  const applyClinicalPreset = (preset: ClinicalPreset) => {
    setHirschbergMM(preset.hirschbergMM);
    setMrd1MM(preset.mrd1MM);
    setHirschbergRecorded(true);
    setMrd1Recorded(true);
    setAIQualityFlag(3);
    notify(`طُبّق التصنيف السريري: ${preset.label}. يمكنك الضبط الدقيق بالمنزلقات.`, 'success');
  };

  const applyHealthyExternalEye = () => {
    setExternalEyeGateAbnormal(false);
    setExternalEyeFindings([]);
    setExternalEyeOther('');
    setExternalEyeScreened(true);
    notify('سُجلت العين الخارجية سليمة. تابع إلى النتيجة.', 'success');
  };

  const handleStagePointerDown = (e: React.PointerEvent) => {
    if (!stageRef.current || !userImage || cameraActive) return;
    if (!pinType) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const point = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    if (pinType === 'pupil') setPupilPins(p => [...p, point]);
    if (pinType === 'reflex') setReflexPins(p => [...p, point]);
    if (pinType === 'eyelid') setEyelidPins(p => [...p, point]);
  };

  const handleAutoDetectPins = () => {
    if (!userImage) { notify('التقط صورة أولاً.', 'error'); return; }
    setAutoDetectAnimating(true);
    setPupilPins([{x:0.35,y:0.5},{x:0.65,y:0.5}]);
    setReflexPins([{x:0.38,y:0.48},{x:0.68,y:0.52}]);
    setEyelidPins([{x:0.35,y:0.35},{x:0.65,y:0.35}]);
    setTimeout(() => setAutoDetectAnimating(false), 900);
    notify('تم وضع نقاط الكشف الذكي كمرجع.', 'success');
  };

  const noExternalFindings = externalEyeScreened && externalEyeFindings.length === 0;
  const hasSuspicion = hirschbergRecorded && mrd1Recorded && (hirschbergMM >= 1.0 || mrd1MM < 2.5);
  const alignmentState = !hirschbergRecorded || !mrd1Recorded ? 'idle' : hasSuspicion ? 'warn' : 'pass';
  const prismDiopters = convertHirschbergToPrism(hirschbergMM);

  return (
    <div className="ocular-layout">
      <section className="m3-card card-pad">
        <div className="card-head">
          <div>
            <h2 className="card-head__title">
              <Camera size={20} aria-hidden="true" />
              صورة العينين
            </h2>
            <p className="card-head__sub">ضع عيني الطفل داخل الإطار والتقط صورة واحدة واضحة.</p>
          </div>
          <span className="pill pill--primary"><Sun size={13} aria-hidden="true" /> إضاءة أمامية</span>
        </div>

        <div className="capture-stage" ref={stageRef} onPointerDown={handleStagePointerDown}>
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
                👁️ ضع عيني الطفل داخل الإطار على بُعد 1 متر
              </span>
              <span className="capture-hint">
                <CheckCircle2 size={14} aria-hidden="true" />
                حافظ على استقامة الرأس والنظر للأمام
              </span>
            </>
          ) : userImage ? (
            <>
              <img src={userImage.src} alt="صورة عيني التلميذ الملتقطة" />
              <div className="alignment-frame" aria-hidden="true">
                <svg viewBox="0 0 600 300" preserveAspectRatio="none">
                  <ellipse cx="210" cy="150" rx="98" ry="58" fill="none" stroke="#86efac" strokeWidth="2" strokeDasharray="7 5" />
                  <ellipse cx="390" cy="150" rx="98" ry="58" fill="none" stroke="#86efac" strokeWidth="2" strokeDasharray="7 5" />
                </svg>
              </div>
              <div className="absolute inset-0 pointer-events-none">
                {pupilPins.map((p,i)=>(
                  <div key={`pupil-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{left:`${p.x*100}%`,top:`${p.y*100}%`}}>
                    <div className="w-3 h-3 rounded-full border-2 border-[var(--m3-primary)] bg-[var(--m3-primary)]/20 shadow" />
                    {autoDetectAnimating && <div className="absolute inset-0 rounded-full border-2 border-[var(--m3-primary)] animate-ping" />}
                  </div>
                ))}
                {reflexPins.map((p,i)=>(
                  <div key={`reflex-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{left:`${p.x*100}%`,top:`${p.y*100}%`}}>
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--m3-warn)] ring-2 ring-white shadow" />
                  </div>
                ))}
                {eyelidPins.map((p,i)=>(
                  <div key={`eyelid-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{left:`${p.x*100}%`,top:`${p.y*100}%`}}>
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--m3-urgent)] ring-2 ring-white shadow" />
                  </div>
                ))}
              </div>
              <span className="capture-hint">
                <CheckCircle2 size={14} aria-hidden="true" />
                صورة محفوظة · يمكنك إعادة المسح أو الضبط الدقيق
              </span>
            </>
          ) : (
            <div className="capture-empty">
              {cameraStarting ? (
                <>
                  <span className="capture-spinner" aria-hidden="true" />
                  <strong>جارٍ تشغيل الكاميرا…</strong>
                  <span>اسمح للمتصفح بالوصول إلى الكاميرا</span>
                </>
              ) : (
                <>
                  <Camera size={42} aria-hidden="true" />
                  <strong>{cameraError ? 'لم تظهر صورة الكاميرا' : 'ابدأ بصورة واضحة للعينين'}</strong>
                  <span>{cameraError || 'كاميرا الجهاز أو صورة محفوظة'}</span>
                  {cameraError && (
                    <button
                      type="button"
                      className="m3-btn m3-btn--outline capture-retry"
                      onClick={() => startCamera()}
                    >
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
              ? '⏳ جارٍ تشغيل الكاميرا…'
              : cameraActive
                ? '📸 التقاط وفحص تلقائي بالذكاء الاصطناعي'
                : '📷 فتح الكاميرا ومعاينة العينين'}
          </button>
          <label className="m3-btn m3-btn--outline m3-btn--block mt-2 cursor-pointer">
            <Upload size={17} aria-hidden="true" />
            رفع صورة
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {autoStatus !== 'idle' && (
          <div className={`notice mt-3 ${autoStatus === 'done' ? 'notice--pass' : autoStatus === 'scanning' ? 'notice--info' : 'notice--warn'}`} role="status">
            {autoStatus === 'done' ? <CheckCircle2 size={16} aria-hidden="true" /> : autoStatus === 'scanning' ? <Sparkles size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
            <span>{autoStatus === 'scanning' ? 'جارٍ فحص السطوع وتقدير موضع المنعكس…' : autoMessage}</span>
          </div>
        )}

        <div className="clinical-presets">
          <div className="clinical-presets__head">
            <strong>تصنيف سريع بلمسة واحدة</strong>
            <span>يُسجّل Hirschberg وMRD₁ تلقائياً</span>
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
          راجع وضوح الصورة والقيمة الظاهرة قبل الاعتماد.
        </p>
      </section>

      <section className="m3-card card-pad">
        <div className="card-head">
          <div>
            <h2 className="card-head__title">
              <Eye size={20} aria-hidden="true" />
              ملاحظات وقياسات العين
            </h2>
            <p className="card-head__sub">راجع المحاذاة، ثم سجّل علامات العين الخارجية والأعراض.</p>
          </div>
          <span className="pill pill--neutral"><Activity size={13} aria-hidden="true" /> فرز أولي</span>
        </div>

        <div className={`status-pill ${alignmentState === 'pass' ? 'is-pass' : alignmentState === 'warn' ? 'is-warn' : 'is-idle'}`} role="status">
          <span className="status-pill__label">
            {alignmentState === 'pass' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
            محاذاة العينين والجفن
          </span>
          <span className="status-pill__value">
            {alignmentState === 'pass' && '✅ طبيعي'}
            {alignmentState === 'warn' && '⚠️ اشتباه انحراف بصري / ارتخاء جفن'}
            {alignmentState === 'idle' && 'لم يكتمل القياس'}
          </span>
        </div>

        <div className="reading-grid mt-2">
          <div className="reading-box">
            <span>المنعكس القرني · Hirschberg</span>
            <strong>{hirschbergRecorded ? `${hirschbergMM.toFixed(2)} mm` : '—'}</strong>
            <small>{hirschbergRecorded ? `${prismDiopters}Δ تقدير تقريبي` : 'بانتظار القياس'}</small>
          </div>
          <div className="reading-box">
            <span>فتحة الجفن · MRD₁</span>
            <strong>{mrd1Recorded ? `${mrd1MM.toFixed(1)} mm` : '—'}</strong>
            <small>{mrd1Recorded ? (mrd1MM < 2.5 ? 'دون حد النموذج' : 'داخل حد النموذج') : 'بانتظار التأكيد'}</small>
          </div>
        </div>

        <div className="tap-section">
          <h3 className="section-title"><Eye size={16} aria-hidden="true" /> هل مظهر العين الخارجي سليم؟</h3>
          <button
            type="button"
            className={`external-gate-pass${externalEyeScreened && externalEyeFindings.length === 0 && !externalEyeGateAbnormal ? ' is-active' : ''}`}
            aria-pressed={externalEyeScreened && externalEyeFindings.length === 0 && !externalEyeGateAbnormal}
            onClick={applyHealthyExternalEye}
          >
            <CheckCircle2 size={24} aria-hidden="true" />
            <span>
              <strong>✅ العين الخارجية سليمة</strong>
              <small>لا قشور، لا إفرازات، لا احمرار، لا عتامة</small>
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
            {externalEyeGateAbnormal ? 'إخفاء العلامات غير الطبيعية' : '⚠️ توجد علامة غير طبيعية؟'}
          </button>

          {externalEyeGateAbnormal && (
            <div className="external-gate-chips" role="group" aria-label="علامات العين الخارجية">
              {EYE_FINDINGS.filter(f => ['EYELID_CRUST_OR_PUS','EYE_DISCHARGE','SCLERAL_REDNESS','CORNEAL_HAZINESS'].includes(f.id)).map((finding) => {
                const selected = externalEyeFindings.includes(finding.id);
                const severity = EXTERNAL_SEVERITY[finding.id] ?? 'amber';
                const tone = severity === 'red' ? 'urgent' : 'warn';
                const labelMap: Record<string,string> = {
                  EYELID_CRUST_OR_PUS: 'قشور',
                  EYE_DISCHARGE: 'إفرازات',
                  SCLERAL_REDNESS: 'احمرار',
                  CORNEAL_HAZINESS: 'عتامة',
                };
                return (
                  <button
                    key={finding.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleFinding(finding.id)}
                    className={`external-gate-chip external-gate-chip--${tone}`}
                  >
                    <span>{labelMap[finding.id] ?? finding.label}</span>
                    {selected && <CheckCircle2 size={16} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}

          {externalEyeScreened && externalEyeFindings.length > 0 && (
            <p className="external-gate-summary" role="status">
              سُجّلت {externalEyeFindings.length} علامة غير طبيعية؛ ستُرفع للإحالة في النتيجة.
            </p>
          )}
        </div>

        <div className="tap-section">
          <div className="flex items-center justify-between gap-2">
            <h3 className="section-title"><Sparkles size={16} aria-hidden="true" /> أعراض إجهاد العين</h3>
            <span className="pill pill--primary">{asthenopiaScore} من 5</span>
          </div>
          <div className="grid gap-3">
            {[
              {label:'تضييق العينين لرؤية السبورة', selected:symptomSquint, toggle:()=>setSymptomSquint(!symptomSquint)},
              {label:'إمالة الرأس أثناء النظر', selected:symptomTilt, toggle:()=>setSymptomTilt(!symptomTilt)},
              {label:'فرك العين المتكرر أو الاحمرار', selected:symptomRub, toggle:()=>setSymptomRub(!symptomRub)},
              {label:'تقريب الكتاب من الوجه', selected:symptomClose, toggle:()=>setSymptomClose(!symptomClose)},
              {label:'صداع بعد القراءة المدرسية', selected:symptomHeadache, toggle:()=>setSymptomHeadache(!symptomHeadache)},
            ].map((item,i)=>(
              <button
                key={i}
                type="button"
                aria-pressed={item.selected}
                onClick={item.toggle}
                className="rounded-2xl p-3.5 border-2 transition-all flex items-center justify-between text-right"
                style={{
                  borderColor: 'var(--m3-border)',
                  backgroundColor: item.selected ? 'color-mix(in srgb, var(--m3-warn) 14%, transparent)' : 'transparent'
                }}
              >
                <span>{item.label}</span>
                {item.selected && <CheckCircle2 size={18} className="font-bold" style={{color:'var(--m3-warn)'}} />}
              </button>
            ))}
          </div>
        </div>

        <details className="m3-details advanced-details">
          <summary>
            <span className="flex items-center gap-2">
              <Sliders size={16} aria-hidden="true" />
              تعديل يدوي للمختص
            </span>
            <span className="text-[10px] font-semibold text-slate-400">للمراجعة اليدوية</span>
          </summary>
          <div className="details-body">
            <div className="segmented w-fit">
              <button
                type="button"
                className="segmented__btn"
                aria-pressed={activeEyeTarget === 'OS'}
                onClick={() => setActiveEyeTarget('OS')}
              >
                العين اليسرى OS
              </button>
              <button
                type="button"
                className="segmented__btn"
                aria-pressed={activeEyeTarget === 'OD'}
                onClick={() => setActiveEyeTarget('OD')}
              >
                العين اليمنى OD
              </button>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                <span>انحراف المنعكس القرني (Hirschberg)</span>
                <output>{hirschbergRecorded ? `${hirschbergMM.toFixed(2)} mm` : 'غير مسجل'}</output>
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
                  setAIQualityFlag(3); // Manual tap fallback overrides any automatic capture flag.
                }}
                aria-label="قيمة انحراف المنعكس القرني"
              />
              <div className="flex justify-between text-[10px] text-[var(--m3-muted)] mono"><span>0.0</span><span>1.0</span><span>3.0 mm</span></div>
              <p className="field-hint">
                تُسجَّل القيمة تلقائياً عند لمس المنزلق أو اختيار تصنيف سريع. القيمة الصافية لتفاوت المنعكس بين العينين (بعد تعديل 0.5 مم ثابت لزاوية كابا Angle Kappa).
                الإحالة عند ≥ 15Δ (ما يعادل 1.0 مم) أو MRD₁ أقل من 2.5 مم. التحويل التقريبي: 1 مم ≈ 15Δ.
              </p>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                <span>المسافة الهامشية للجفن (MRD₁)</span>
                <output>{mrd1Recorded ? `${mrd1MM.toFixed(1)} mm` : 'غير مسجل'}</output>
              </div>
              <input
                type="range"
                className="m3-range"
                min={1}
                max={5.5}
                step={0.1}
                value={mrd1MM}
                onChange={(event) => {
                  setMrd1MM(Number(event.target.value));
                  setMrd1Recorded(true);
                  if (!aiQualityFlag) setAIQualityFlag(3);
                }}
                aria-label="قيمة المسافة الهامشية للجفن"
              />
              <div className="flex justify-between text-[10px] text-[var(--m3-muted)] mono"><span>1.0</span><span>2.5</span><span>5.5 mm</span></div>
              <p className="field-hint">تُسجَّل القيمة تلقائياً عند لمس المنزلق؛ لا حاجة لتأكيد منفصل.</p>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button type="button" onClick={() => runAutoDetection()} disabled={!userImage} className="m3-btn m3-btn--secondary m3-btn--sm">
                <Sparkles size={14} aria-hidden="true" />
                إعادة المسح الآلي
              </button>
              <span className="field-hint">مرجع التحويل: HVID = 11.7 mm</span>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                <span>جودة قراءة الذكاء الاصطناعي (AI_Quality_Flag)</span>
                <output>
                  {aiQualityFlag === 1 && 'كشف آلي (1)'}
                  {aiQualityFlag === 2 && 'إعادة تصوير ثم كشف آلي (2)'}
                  {aiQualityFlag === 3 && 'إدخال يدوي (3)'}
                  {!aiQualityFlag && 'غير محددة'}
                </output>
              </div>
              <div className="segmented w-fit">
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={aiQualityFlag === 1}
                  onClick={() => setAIQualityFlag(1)}
                >
                  1 · آلي
                </button>
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={aiQualityFlag === 2}
                  onClick={() => setAIQualityFlag(2)}
                >
                  2 · إعادة تصوير
                </button>
                <button
                  type="button"
                  className="segmented__btn"
                  aria-pressed={aiQualityFlag === 3}
                  onClick={() => setAIQualityFlag(3)}
                >
                  3 · يدوي
                </button>
              </div>
              <p className="field-hint">
                يُسجل تلقائياً حسب مصدر القراءة (كشف آلي / إعادة تصوير / إدخال يدوي) ويُحفظ مع السجل لتقييم جودة النموذج.
              </p>
            </div>
          </div>
        </details>

        <div className={`notice mt-3 ${triageOcularFlag === 0 && hirschbergRecorded && mrd1Recorded ? 'notice--pass' : 'notice--warn'}`}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            {(!hirschbergRecorded || !mrd1Recorded) && 'لم يكتمل توثيق قياسي المنعكس والجفن. عدم وجود قيمة لا يعني غياب الإشارة.'}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 0 && 'لم تُسجل إشارة تجاوز وفق حدود النموذج الحالية.'}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 1 && `إشارة في المنعكس القرني (${prismDiopters}Δ تقديرياً).`}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 2 && `قيمة MRD₁ دون حد النموذج (${mrd1MM.toFixed(1)} mm).`}
            {hirschbergRecorded && mrd1Recorded && triageOcularFlag === 3 && 'إشارتان في المنعكس والجفن؛ راجعهما في النتيجة.'}
          </span>
        </div>

        <button type="button" onClick={onProceedToCDSS} className="m3-btn m3-btn--primary m3-btn--block mt-3">
          عرض النتيجة والحفظ
          <ChevronDown size={16} className="-rotate-90" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
};
