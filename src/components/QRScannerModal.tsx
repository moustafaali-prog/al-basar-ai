import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Upload, CheckCircle2, AlertCircle, RefreshCw, QrCode } from 'lucide-react';
import jsQR from 'jsqr';
import { useFeedback } from './FeedbackProvider';

export interface ScannedStudentData {
  childId?: string;
  schoolName?: string;
  schoolSector?: string;
  gradeLevel?: number;
  ageYears?: number;
  gender?: string;
  parentalConsent?: number;
  referralPHCC?: string;
  examinerId?: string;
}

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: ScannedStudentData, rawText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const { notify } = useFeedback();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanStatus, setScanStatus] = useState<string>('جارٍ تهيئة كاميرا المسح...');
  const [lastScannedResult, setLastScannedResult] = useState<ScannedStudentData | null>(null);

  const validateQRData = (data: ScannedStudentData, rawText: string): ScannedStudentData => {
    if (rawText.length > 4096) throw new Error('محتوى QR طويل وغير صالح.');
    const cleanText = (value: unknown, label: string, maxLength: number): string | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`قيمة ${label} غير صالحة.`);
      const result = String(value).trim();
      if (!result || result.length > maxLength || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`تحقق من طول أو محتوى ${label}.`);
      return result;
    };
    const childId = cleanText(data.childId, 'معرف المشارك', 64);
    const schoolName = cleanText(data.schoolName, 'اسم المدرسة', 120);
    const schoolSector = cleanText(data.schoolSector, 'القطاع', 40);
    const gender = cleanText(data.gender, 'الجنس', 16);
    const referralPHCC = cleanText(data.referralPHCC, 'المركز الصحي', 120);
    const examinerId = cleanText(data.examinerId, 'معرف الفاحص', 64);
    if (schoolSector && !['حكومي حضري', 'حكومي ريفي', 'أهلي'].includes(schoolSector)) throw new Error('قيمة القطاع في QR غير معروفة؛ أدخلها يدوياً.');
    if (gender && !['ذكر', 'أنثى'].includes(gender)) throw new Error('قيمة الجنس في QR غير معروفة؛ أدخلها يدوياً.');

    const gradeLevel = data.gradeLevel;
    const ageYears = data.ageYears;
    const parentalConsent = data.parentalConsent;
    if (gradeLevel !== undefined && (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 6)) throw new Error('الصف في QR يجب أن يكون عدداً صحيحاً من 1 إلى 6.');
    if (ageYears !== undefined && (!Number.isInteger(ageYears) || ageYears < 5 || ageYears > 14)) throw new Error('العمر في QR خارج النطاق المسجل (5–14 سنة).');
    if (parentalConsent !== undefined && parentalConsent !== 0 && parentalConsent !== 1) throw new Error('قيمة الموافقة في QR يجب أن تكون 0 أو 1.');

    return { childId, schoolName, schoolSector, gradeLevel, ageYears, gender, parentalConsent, referralPHCC, examinerId };
  };

  // Parse QR content flexibly, then validate every field before placing it in the form.
  const parseQRContent = (text: string): ScannedStudentData => {
    const trimmed = text.trim();
    if (trimmed.length > 4096) throw new Error('محتوى QR طويل وغير صالح.');

    // 1. Try parsing JSON
    try {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const obj = JSON.parse(trimmed);
        return validateQRData({
          childId: obj.childId || obj.id || obj.Child_ID || obj.code,
          schoolName: obj.schoolName || obj.school || obj.School_Name,
          schoolSector: obj.schoolSector || obj.sector || obj.School_Sector,
          gradeLevel: obj.gradeLevel || obj.grade || obj.Grade_Level ? Number(obj.gradeLevel || obj.grade || obj.Grade_Level) : undefined,
          ageYears: obj.ageYears || obj.age || obj.Age_Years ? Number(obj.ageYears || obj.age || obj.Age_Years) : undefined,
          gender: obj.gender || obj.Gender,
          parentalConsent: obj.parentalConsent !== undefined ? Number(obj.parentalConsent) : (obj.consent !== undefined ? Number(obj.consent) : undefined),
          referralPHCC: obj.referralPHCC || obj.phcc || obj.Referral_PHCC,
          examinerId: obj.examinerId || obj.examiner || obj.Examiner_ID,
        }, trimmed);
      }
    } catch (e) {
      // not JSON
    }

    // 2. Try parsing URL query parameters (e.g. https://albasar.iq/card?id=BAB-109&school=...)
    try {
      if (trimmed.includes('?') && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('&'))) {
        const queryPart = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed;
        const params = new URLSearchParams(queryPart);
        return validateQRData({
          childId: params.get('id') || params.get('childId') || undefined,
          schoolName: params.get('school') || params.get('schoolName') || undefined,
          schoolSector: params.get('sector') || params.get('schoolSector') || undefined,
          gradeLevel: params.get('grade') ? Number(params.get('grade')) : undefined,
          ageYears: params.get('age') ? Number(params.get('age')) : undefined,
          gender: params.get('gender') || undefined,
          parentalConsent: params.get('consent') ? Number(params.get('consent')) : undefined,
          referralPHCC: params.get('phcc') || undefined,
          examinerId: params.get('examiner') || undefined,
        }, trimmed);
      }
    } catch (e) {
      // not URL params
    }

    // 3. Try pipe or semicolon separated format:
    // BAB-105|مدرسة الفيحاء الابتدائية|حكومي حضري|2|7|ذكر|1|مركز صحي الحلة الثاني
    if (trimmed.includes('|') || trimmed.includes(';')) {
      const parts = trimmed.includes('|') ? trimmed.split('|') : trimmed.split(';');
      const cleanParts = parts.map((p) => p.trim());
      return validateQRData({
        childId: cleanParts[0] || undefined,
        schoolName: cleanParts[1] || undefined,
        schoolSector: cleanParts[2] || undefined,
        gradeLevel: cleanParts[3] ? Number(cleanParts[3]) : undefined,
        ageYears: cleanParts[4] ? Number(cleanParts[4]) : undefined,
        gender: cleanParts[5] || undefined,
        parentalConsent: cleanParts[6] !== undefined ? Number(cleanParts[6]) : undefined,
        referralPHCC: cleanParts[7] || undefined,
      }, trimmed);
    }

    // 4. Default plain text fallback (e.g. "BAB-105" or barcode number)
    return validateQRData({
      childId: trimmed,
    }, trimmed);
  };

  // Play a pleasant feedback beep using Web Audio API
  const playSuccessBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch (e) {
      // AudioContext may be muted or blocked by browser policy
    }
  };

  // Scan video frame continuously
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        // QR detected!
        playSuccessBeep();
        let parsed: ScannedStudentData;
        try {
          parsed = parseQRContent(code.data);
        } catch (error) {
          stopCamera();
          notify(error instanceof Error ? error.message : 'محتوى رمز QR غير صالح.', 'error');
          return;
        }
        setLastScannedResult(parsed);
        setScanStatus(`تم التعرف بنجاح على بطاقة التلميذ: ${parsed.childId || code.data}`);

        // Stop scanning
        stopCamera();

        // Callback with slight delay for visual feedback
        setTimeout(() => {
          onScanSuccess(parsed, code.data);
          onClose();
        }, 600);
        return;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  }, [onScanSuccess, onClose]);

  // Start device camera
  const startCamera = useCallback(async () => {
    setHasCameraError(null);
    setScanStatus('جارٍ تشغيل الكاميرا...');

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
        setIsScanning(true);
        setScanStatus('وجّه الكاميرا نحو باركود أو بطاقة التلميذ المدرسية...');
        animFrameIdRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCameraError(
        'تعذر فتح الكاميرا المباشرة (قد تكون الصلاحيات محجوبة أو الكاميرا مستخدمة في تطبيق آخر). يمكنك رفع صورة الباركود.'
      );
      setIsScanning(false);
    }
  }, [facingMode, scanFrame]);

  // Stop device camera
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Handle open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setLastScannedResult(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Scan from uploaded image file
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          playSuccessBeep();
          let parsed: ScannedStudentData;
          try {
            parsed = parseQRContent(code.data);
          } catch (error) {
            notify(error instanceof Error ? error.message : 'محتوى رمز QR غير صالح.', 'error');
            return;
          }
          setLastScannedResult(parsed);
          setScanStatus(`تم استخراج البيانات من الصورة: ${parsed.childId || code.data}`);
          setTimeout(() => {
            onScanSuccess(parsed, code.data);
            onClose();
          }, 500);
        } else {
          notify('لم يتم العثور على رمز QR صالح. تحقق من وضوح الصورة أو أدخل البيانات يدوياً.', 'error');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle front/rear camera
  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };


  if (!isOpen) return null;

  return (
    <div
      className="feedback-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-dialog-title">
        <header className="qr-dialog__header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center w-11 h-11 rounded-2xl bg-[var(--m3-primary-soft)] text-[var(--m3-primary)] shrink-0">
              <QrCode size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="qr-dialog-title" className="qr-dialog__title">قارئ بطاقة التلميذ</h2>
              <p className="qr-dialog__sub">امسح الباركود لتعبئة الكود والمدرسة تلقائياً.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="icon-action shrink-0" aria-label="إغلاق نافذة المسح">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="qr-dialog__body">
          <div className="qr-viewport">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {isScanning && !hasCameraError && (
              <div className="qr-reticle" aria-hidden="true">
                <div className="qr-frame">
                  <span className="qr-corner qr-corner--tr" />
                  <span className="qr-corner qr-corner--tl" />
                  <span className="qr-corner qr-corner--br" />
                  <span className="qr-corner qr-corner--bl" />
                  <span className="qr-scanline" />
                </div>
              </div>
            )}

            {hasCameraError && (
              <div className="qr-camera-error">
                <AlertCircle size={30} aria-hidden="true" />
                <p>{hasCameraError}</p>
                <button type="button" onClick={startCamera} className="m3-btn m3-btn--primary m3-btn--sm">
                  <RefreshCw size={14} aria-hidden="true" />
                  إعادة المحاولة
                </button>
              </div>
            )}

            {isScanning && (
              <button type="button" onClick={toggleFacingMode} className="qr-camera-switch">
                <RefreshCw size={13} aria-hidden="true" />
                تبديل الكاميرا
              </button>
            )}

            {!hasCameraError && (
              <div className={`qr-status${lastScannedResult ? ' is-success' : ''}`} role="status">
                {lastScannedResult ? <CheckCircle2 size={14} aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
                <span>{scanStatus}</span>
              </div>
            )}
          </div>

          <div className="qr-actions">
            <label className="m3-btn m3-btn--outline m3-btn--block cursor-pointer">
              <Upload size={17} aria-hidden="true" />
              مسح من صورة محفوظة
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            {isScanning ? (
              <button type="button" onClick={stopCamera} className="m3-btn m3-btn--ghost m3-btn--block">
                إيقاف الكاميرا
              </button>
            ) : (
              <button type="button" onClick={startCamera} className="m3-btn m3-btn--primary m3-btn--block">
                <Camera size={17} aria-hidden="true" />
                تشغيل الكاميرا
              </button>
            )}
          </div>
        </div>

        <footer className="qr-dialog__footer">
          <button type="button" onClick={onClose} className="m3-btn m3-btn--ghost">
            إلغاء وإغلاق
          </button>
        </footer>
      </section>
    </div>
  );
};
