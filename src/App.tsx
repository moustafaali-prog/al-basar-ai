/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Fingerprint,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Ruler,
  Share,
  Smartphone,
  Sparkles,
  UserCheck,
  Wrench,
} from 'lucide-react';

import {
  CalibrationData,
  StudentScreeningRecord,
  WHOPreScreenDraft,
  WHOPreScreenResponses,
} from './types';
import {
  LOGMAR_MAP,
  REFERRAL_LOGMAR_CUTOFF,
  UNTTESTABLE_LOGMAR,
  classifyClinicalDecision,
  worseEyeLogMAR,
} from './utils/acuityMath';
import {
  PARTICIPANT_ID_LAST,
  crossoverSequenceForParticipantNumber,
  extractParticipantNumber,
  generateParticipantId,
  normalizeParticipantId,
} from './utils/recordIdentity';
import { analyzeRecordMerge } from './utils/recordMerge';
import {
  defaultAgeForGrade,
  readSessionContext,
  writeSessionContext,
} from './utils/sessionContext';
import {
  clearScreeningDraft,
  loadScreeningDraft,
  saveScreeningDraft,
  type ActiveScreeningDraft,
} from './utils/screeningDraft';
import {
  deleteEyePhoto,
  getEyePhoto,
  saveEyePhoto,
} from './utils/eyePhotoStore';

import { CalibrationModule } from './components/CalibrationModule';
import { RegistrationAndPaperStation } from './components/RegistrationAndPaperStation';
import { AdaptiveAcuityStation } from './components/AdaptiveAcuityStation';
import { OcularBiometryStation } from './components/OcularBiometryStation';
import { CDSSAndEmpathySimulator } from './components/CDSSAndEmpathySimulator';
import { MasterDatabaseAndStatistics } from './components/MasterDatabaseAndStatistics';
import { NurseSUSScale } from './components/NurseSUSScale';
import { MethodologyAndGoldStandardModal } from './components/MethodologyAndGoldStandardModal';
import { InteractiveStudentTrainingModal } from './components/InteractiveStudentTrainingModal';
import { useFeedback } from './components/FeedbackProvider';
import { isSupabaseConfigured } from './utils/supabaseConfig';
import { CloudAuthModal } from './components/CloudAuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { ExaminerRecordsPanel } from './components/ExaminerRecordsPanel';
import { CloudSettingsPanel } from './components/CloudSettingsPanel';
import type { CloudAuthUser } from './utils/supabaseAuth';
import {
  clearExaminerProfile,
  getOrCreateDeviceId,
  isSessionLocked,
  loadExaminerProfile,
  purgeLegacyAdminPin,
  saveExaminerProfile,
  setSessionLocked,
  type ExaminerProfile,
} from './utils/examinerProfile';
import {
  clearBiometricCredential,
  getBiometricBinding,
  hasBiometricCredential,
} from './utils/biometricAuth';
import { useInstallPrompt } from './utils/useInstallPrompt';
import { useHardwareBackButton } from './utils/useHardwareBackButton';

type ClinicalStepId = 'protocol' | 'acuity' | 'biometry' | 'cdss';
type ActiveTab = ClinicalStepId;
type ChartMode = 'HOTV' | 'TUMBLING_E';

const CLINICAL_STEPS = [
  {
    id: 'protocol',
    num: 1,
    label: 'التلميذ',
    tabLabel: 'تسجيل',
    meta: 'التعريف والموافقة',
    description: 'سجّل هوية التلميذ وموافقة ولي الأمر.',
    icon: UserCheck,
  },
  {
    id: 'acuity',
    num: 2,
    label: 'النظر',
    tabLabel: 'البصر',
    meta: 'لوحة العينين',
    description: 'اعرض الرموز وسجّل استجابة كل عين.',
    icon: Eye,
  },
  {
    id: 'biometry',
    num: 3,
    label: 'صورة العين',
    tabLabel: 'الكاميرا',
    meta: 'المنعكس والجفن',
    description: 'التقط صورة العينين وراجع المحاذاة.',
    icon: Camera,
  },
  {
    id: 'cdss',
    num: 4,
    label: 'النتيجة',
    tabLabel: 'النتيجة',
    meta: 'الإحالة والبطاقة',
    description: 'راجع النتيجة وسلّم الإرشادات ثم احفظ.',
    icon: Activity,
  },
] as const;

const EMPTY_WHO_PRE_SCREEN: WHOPreScreenDraft = {
  childAssent: '',
  diabetes: '',
  eyePainOrSevereItch: '',
  parentVisionConcern: '',
  parentHearingConcern: '',
  teacherVisionConcern: '',
  learningConcern: '',
  spectacles: '',
  hearingAids: '',
};

/** Loaded once per page load so a school morning keeps its school/nurse context. */
const INITIAL_SESSION_CONTEXT = readSessionContext();

export default function App() {
  const { notify, confirmAction } = useFeedback();

  // Active screen state. Clinical steps are the 4-step wizard; admin views are secondary.
  const [activeTab, setActiveTab] = useState<ActiveTab>('protocol');
  const [lastClinicalTab, setLastClinicalTab] = useState<ClinicalStepId>('protocol');
  const [adminOpen, setAdminOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrScannerCloseSignal, setQrScannerCloseSignal] = useState(0);
  /** Compact account popover (lock / sign-out) in the top bar. */
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  /**
   * Supervisor drawer panels.
   *
   * - `dashboard` — the live, role-scoped data view (admin only).
   * - `tools`     — calibration / training / cloud plumbing (admin only).
   * - `calib`     — the examiner's screen-calibration tool.
   * - `records`   — the examiner's own records + CSV download.
   */
  const [adminPanel, setAdminPanel] = useState<'dashboard'|'tools'|'calib'|'records'|'sus'|'method'|'training'|'cloud'>('calib');

  // Methodology Modal State
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  // Interactive Student Field Training & WHO Scenario Simulator
  const [isTrainingOpen, setIsTrainingOpen] = useState(false);
  // Calibration State
  const [calibration, setCalibration] = useState<CalibrationData>(() => {
    const saved = localStorage.getItem('albasar_calibration_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CalibrationData;
        return {
          ...parsed,
          // Old calibration records were timestamped automatically. Require one physical
          // re-check on this device before presenting them as calibrated.
          isCalibrated: parsed.isCalibrated === true,
        };
      } catch (e) {
        // Fallback
      }
    }
    return {
      pxPerMM: 3.78,
      referenceType: 'CARD_85_6',
      referenceLengthMM: 85.6,
      sliderPixelWidth: 324,
      estimatedDPI: 96,
      lastCalibratedDate: '',
      isCalibrated: false,
      testingDistanceMeters: 2.0,
    };
  });

  const handleUpdateCalibration = (data: CalibrationData) => {
    setCalibration(data);
    localStorage.setItem('albasar_calibration_v3', JSON.stringify(data));
  };

  // Student Demographics & Protocol State
  const [childId, setChildId] = useState('');
  const [examinerId, setExaminerId] = useState(INITIAL_SESSION_CONTEXT.examinerId);
  const [parentalConsent, setParentalConsent] = useState<number>(0);
  const [schoolName, setSchoolName] = useState(INITIAL_SESSION_CONTEXT.schoolName);
  const [schoolSector, setSchoolSector] = useState(INITIAL_SESSION_CONTEXT.schoolSector);
  const [gradeLevel, setGradeLevel] = useState<number>(INITIAL_SESSION_CONTEXT.gradeLevel);
  const [ageYears, setAgeYears] = useState<number>(() =>
    defaultAgeForGrade(INITIAL_SESSION_CONTEXT.gradeLevel),
  );
  const [gender, setGender] = useState('');
  const [wearsGlasses, setWearsGlasses] = useState<number>(-1);
  const [crossoverSequence, setCrossoverSequence] = useState('PAPER_FIRST');
  const [whoPreScreen, setWHOPreScreen] = useState<WHOPreScreenDraft>(EMPTY_WHO_PRE_SCREEN);
  const [paperExaminerId, setPaperExaminerId] = useState(INITIAL_SESSION_CONTEXT.paperExaminerId);
  const [smartExaminerId, setSmartExaminerId] = useState(INITIAL_SESSION_CONTEXT.smartExaminerId);
  /**
   * The second examiner on duty (dual-examiner blinding). When set, the paper
   * and digital stations each offer a one-tap hand-over.
   */
  const [alternateExaminerId, setAlternateExaminerId] = useState(
    INITIAL_SESSION_CONTEXT.alternateExaminerId,
  );
  const [paperStartedAt, setPaperStartedAt] = useState('');
  const [paperCompletedAt, setPaperCompletedAt] = useState('');
  const [smartStartedAt, setSmartStartedAt] = useState('');
  const [smartCompletedAt, setSmartCompletedAt] = useState('');
  const [referralPHCC, setReferralPHCC] = useState(INITIAL_SESSION_CONTEXT.referralPHCC);

  // Station 1: Paper (6m)
  const [paperOd, setPaperOd] = useState('');
  const [paperOs, setPaperOs] = useState('');
  const [paperTimeSec, setPaperTimeSec] = useState<number>(0);

  // Station 2-A: Smart Mobile (2m)
  const [smartOd, setSmartOd] = useState('');
  const [smartOs, setSmartOs] = useState('');
  const [smartTimeSec, setSmartTimeSec] = useState<number>(0);

  // Station 2-B: Ocular Biometry & Hirschberg
  const [hirschbergMM, setHirschbergMM] = useState<number>(0.2);
  const [mrd1MM, setMrd1MM] = useState<number>(4.1);
  const [hirschbergRecorded, setHirschbergRecorded] = useState(false);
  const [mrd1Recorded, setMrd1Recorded] = useState(false);
  const [triageOcularFlag, setTriageOcularFlag] = useState<number>(0);
  const [aiQualityFlag, setAIQualityFlag] = useState<number>(0); // 1 = Auto, 2 = Retake, 3 = Manual Tap Fallback
  const [asthenopiaScore, setAsthenopiaScore] = useState<number>(0);
  const [externalEyeFindings, setExternalEyeFindings] = useState<string[]>([]);
  const [externalEyeOther, setExternalEyeOther] = useState('');
  const [externalEyeScreened, setExternalEyeScreened] = useState(false);
  /**
   * Compressed diagnostic-clarity photo of the current child's eyes.
   * The binary blob is stored in IndexedDB (keyed by Child_ID) so the local
   * record payload in localStorage never grows past a few kilobytes.
   */
  const [eyePhoto, setEyePhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null);

  // Database state
  const [records, setRecords] = useState<StudentScreeningRecord[]>(() => {
    const saved = localStorage.getItem('albasar_master_records_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Fallback
      }
    }
    return [];
  });

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Cloud auth is optional: local screening always works, cloud sync is opt-in.
  const [cloudUser, setCloudUser] = useState<CloudAuthUser | null>(null);
  const [cloudLoginOpen, setCloudLoginOpen] = useState<boolean>(false);
  /** True while the startup authentication gate is blocking the workflow. */
  const [authGateMode, setAuthGateMode] = useState<boolean>(false);
  /** True once the local session is unlocked (signed in, restored, or offline). */
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  /** True once the lazy auth bootstrap has finished (or Supabase is absent). */
  const [cloudAuthReady, setCloudAuthReady] = useState<boolean>(!isSupabaseConfigured());
  /** Password recovery flow active */
  const [passwordResetMode, setPasswordResetMode] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string>('');
  /** Locally persisted examiner identity (never contains a password). */
  const [examinerProfile, setExaminerProfile] = useState<ExaminerProfile | null>(() => loadExaminerProfile());
  /** True when this device has a biometric credential bound to an examiner. */
  const [biometricBound, setBiometricBound] = useState<boolean>(() => hasBiometricCredential());
  /** Records waiting for the next cloud sync. */
  const pendingSyncCount = records.filter((record) => record._syncStatus !== 'synced').length;

  /**
   * Server-trusted role.
   *
   * The role is **never** decided by the client: it is read from the Supabase
   * JWT (`app_metadata.role`), which only the Supabase dashboard or a
   * `service_role` key can set. A signed-out device is always an examiner.
   */
  const effectiveRole: 'admin' | 'examiner' =
    cloudUser?.role === 'admin' ? 'admin' : 'examiner';
  const isAdminSession = effectiveRole === 'admin';

  /* ---------------- Native PWA install experience ---------------- */
  const installPrompt = useInstallPrompt();

  /* ---------------- Hardware back button (Android) ---------------- */
  const closeOverlayFromBack = useCallback((id: string) => {
    if (id === 'auth') { setCloudLoginOpen(false); setAuthGateMode(false); setSessionActive(true); return; }
    if (id === 'admin') { setAdminOpen(false); return; }
    if (id === 'training') { setIsTrainingOpen(false); return; }
    if (id === 'methodology') { setIsMethodologyOpen(false); return; }
    if (id === 'qr-scanner') {
      setQrScannerOpen(false);
      setQrScannerCloseSignal((n) => n + 1);
      return;
    }
  }, []);

  const backButton = useHardwareBackButton(closeOverlayFromBack);
  /** Overlay ids that were open on the previous render (history bookkeeping). */
  const previousOverlaysRef = useRef<string[]>([]);

  /**
   * Keep the browser history in sync with the open overlays so the Android
   * hardware back button closes the top-most sheet instead of leaving the app.
   */
  useEffect(() => {
    const overlays: Array<[string, boolean]> = [
      ['auth', cloudLoginOpen],
      ['admin', adminOpen],
      ['training', isTrainingOpen],
      ['methodology', isMethodologyOpen],
      ['qr-scanner', qrScannerOpen],
    ];
    const openIds = overlays.filter(([, isOpen]) => isOpen).map(([id]) => id);
    const previous = previousOverlaysRef.current;
    previousOverlaysRef.current = openIds;

    // Register newly opened overlays.
    openIds.forEach((id) => {
      if (!previous.includes(id)) backButton.registerOpen(id);
    });
    // Unregister overlays that closed themselves.
    previous.forEach((id) => {
      if (!openIds.includes(id)) backButton.registerClose(id);
    });
  }, [cloudLoginOpen, adminOpen, isTrainingOpen, isMethodologyOpen, qrScannerOpen, backButton]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  // Dismiss the compact account popover on an outside click or Escape.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.topbar__account')) return;
      setAccountMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);

  // Auto-sync pending records when coming online and authenticated
  useEffect(() => {
    if (!isOnline) return;
    if (!isSupabaseConfigured() || !cloudAuthReady) return;
    if (!cloudUser) return;
    const hasPending = records.some(r => r._syncStatus !== 'synced');
    if (!hasPending) return;
    const t = setTimeout(() => {
      void syncLocalRecordsToCloud();
    }, 1200);
    return () => clearTimeout(t);
  }, [isOnline, cloudUser?.id, cloudAuthReady]);

  // Initialise cloud auth lazily after first paint — it does not block the offline-first UI.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setCloudAuthReady(true);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const timer = window.setTimeout(async () => {
      try {
        const { loadCloudAuthUser, refreshCloudSession, subscribeToCloudAuth } = await import('./utils/supabaseAuth');
        const user = await loadCloudAuthUser();
        if (cancelled) return;
        setCloudUser(user);
        unsubscribe = await subscribeToCloudAuth((u) => {
          if (!cancelled) setCloudUser(u);
        });

        // "Keep me signed in" restore: silently refresh the Supabase JWT in the
        // background so the restored session is never stale. A failure is
        // non-fatal — the local session keeps working offline.
        const profile = loadExaminerProfile();
        if (user && profile?.rememberMe && !isSessionLocked()) {
          try {
            const refreshed = await refreshCloudSession();
            if (!cancelled && refreshed) setCloudUser(refreshed);
          } catch {
            // keep the cached session
          }
        }
      } catch {
        // Offline-first: ignore cloud session restoration errors.
      } finally {
        if (!cancelled) setCloudAuthReady(true);
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);

  // Detect password recovery flow from Supabase redirect
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const search = new URLSearchParams(window.location.search);
    const type = params.get('type') || search.get('type');
    if (type === 'recovery') {
      setPasswordResetMode(true);
      // Clean URL to avoid re-trigger
      window.history.replaceState(null, '', window.location.pathname + window.location.hash.replace(/([&?])type=recovery/, ''));
    }
  }, []);

  useEffect(() => {
    setLastClinicalTab(activeTab);
  }, [activeTab]);

  /**
   * Startup gate.
   *
   * The app is usable in three ways, in priority order:
   *  1. **Silent restore** — the examiner enabled "keep me signed in", the
   *     device was not locked, and a cloud session still exists. The JWT is
   *     refreshed in the background and the examiner lands straight in the
   *     workflow.
   *  2. **Biometric unlock** — the examiner locked the app or signed out and
   *     a fingerprint / Face ID credential is bound to this device. The gate
   *     shows a prominent one-tap unlock that also works fully offline.
   *  3. **Explicit sign-in** — everything else.
   *
   * In every case a visible "continue locally" escape hatch keeps emergency
   * offline screening unblocked.
   */
  useEffect(() => {
    const profile = loadExaminerProfile();
    setExaminerProfile(profile);
    setBiometricBound(hasBiometricCredential());
    // The retired local supervisor PIN is replaced by the server-trusted role.
    purgeLegacyAdminPin();

    const locked = isSessionLocked();
    const canRestore = Boolean(profile?.rememberMe) && !locked;

    if (canRestore && profile) {
      // Restore the local session immediately — the cloud JWT refresh happens
      // in the background and never blocks the first paint. The role is left
      // at the least-privilege default until the server session confirms it.
      setSessionActive(true);
      setCloudUser({
        id: profile.userId || `local-${profile.deviceId}`,
        email: profile.email || null,
        fullName: profile.fullName || null,
        role: 'examiner',
      });
      if (profile.fullName) {
        setExaminerId((current) => (current.trim() ? current : profile.fullName));
      }
      return;
    }

    // No restorable session — show the gate (biometric button first when a
    // credential is bound to this device).
    const timer = window.setTimeout(() => {
      setAuthGateMode(true);
      setCloudLoginOpen(true);
    }, 420);
    return () => window.clearTimeout(timer);
  }, []);

  /** Auto-fill the examiner field in Step 1 with the signed-in triple name. */
  useEffect(() => {
    const fullName = examinerProfile?.fullName?.trim();
    if (!fullName) return;
    setExaminerId((current) => (current.trim() ? current : fullName));
  }, [examinerProfile]);

  /**
   * Sticky school session: every session-level field is written once and reused
   * for the next child. Per-child fields (ID, consent, acuity, ocular values)
   * stay out of this storage key.
   */
  useEffect(() => {
    writeSessionContext({
      schoolName,
      schoolSector,
      referralPHCC,
      examinerId,
      paperExaminerId,
      smartExaminerId,
      alternateExaminerId,
      gradeLevel,
    });
  }, [
    schoolName,
    schoolSector,
    referralPHCC,
    examinerId,
    paperExaminerId,
    smartExaminerId,
    alternateExaminerId,
    gradeLevel,
  ]);

  const persistRecords = (next: StudentScreeningRecord[]): boolean => {
    try {
      localStorage.setItem('albasar_master_records_v3', JSON.stringify(next));
      return true;
    } catch {
      notify('تعذر حفظ البيانات محلياً؛ لم تُعتمد التغييرات. تحقق من مساحة التخزين وصدّر نسخة احتياطية.', 'error');
      return false;
    }
  };

  /**
   * Push every pending record to Supabase. `compact` is used by the one-tap
   * top-bar button and keeps the feedback to a single short toast.
   */
  const syncLocalRecordsToCloud = async (compact = false) => {
    if (!isOnline) {
      notify(compact ? '⚠️ لا يوجد اتصال بالإنترنت.' : 'وضع العمل بدون إنترنت. المزامنة متاحة عند الاتصال.', 'info');
      return;
    }
    if (!isSupabaseConfigured()) {
      notify('سحابة المشرف غير مُعدة. راجع إعدادات Supabase في لوحة المشرف.', 'info');
      return;
    }

    /**
     * Cloud sync requires a real, signed-in Supabase session.
     *
     * The former implementation silently fell back to the public `anon` key.
     * Because the table carried table-wide SELECT/UPDATE grants, that made
     * every child's record readable and writable by anyone holding the
     * publishable key. Records captured offline now simply stay `pending` in
     * the device's local store until the examiner signs in.
     */
    if (!cloudUser || cloudUser.id.startsWith('local-')) {
      notify(
        compact
          ? '⚠️ سجّل الدخول أولاً لمزامنة السجلات — السجلات محفوظة محلياً بأمان.'
          : 'سجّل الدخول إلى حسابك أولاً: المزامنة السحابية تتطلب حساباً موثقاً، والسجلات تبقى محفوظة محلياً حتى ذلك الحين.',
        'info',
      );
      openCloudLogin();
      return;
    }

    const { getSupabaseClient, upsertScreeningRecord } = await import('./utils/supabaseClient');
    const client = getSupabaseClient();
    if (!client) {
      notify('تعذر تهيئة عميل Supabase.', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const pending = records.filter(r => r._syncStatus !== 'synced');
      if (pending.length === 0) {
        if (isAdminSession) {
          // A supervisor's own device usually has nothing to upload. Pull the
          // examination rows collected by every examiner instead of stopping.
          await pullLatestFromCloud();
        } else {
          notify(compact ? '✅ تمت المزامنة — لا توجد سجلات معلّقة.' : 'لا توجد سجلات بانتظار المزامنة.', 'success');
        }
        setIsSyncing(false);
        return;
      }
      let syncedCount = 0;
      const syncedIds = new Set<string>();
      const droppedColumns = new Set<string>();
      let lastError = '';

      for (const rec of pending) {
        /**
         * Photo handling: the compressed JPEG stays in IndexedDB (keyed by
         * Child_ID) so localStorage never grows. It is uploaded to the
         * **private** `screening-photos` bucket under `{auth.uid()}/…`, and
         * only the storage *object path* is persisted in `eye_photo_url`.
         * Every read resolves that path into a short-lived signed URL.
         */
        const storedPhoto = (rec.Eye_Photo_URL ?? '').trim();
        const isUnuploaded = !storedPhoto || storedPhoto.startsWith('data:');
        const isLegacyPublicUrl = storedPhoto.startsWith('http');
        if (isUnuploaded || isLegacyPublicUrl) {
          try {
            const { getEyePhoto } = await import('./utils/eyePhotoStore');
            const { compressImageToBlob, photoFileName } = await import('./utils/imageCompress');

            let blob = await getEyePhoto(rec.Child_ID);
            if (!blob && storedPhoto.startsWith('data:')) {
              blob = await compressImageToBlob(storedPhoto, 1024, 0.85);
            }

            if (blob) {
              const path = photoFileName(cloudUser.id, rec.Child_ID);
              const { error: upErr } = await client.storage
                .from('screening-photos')
                .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
              if (!upErr) {
                // Store the PATH, never a public URL — the bucket is private.
                rec.Eye_Photo_URL = path;
              } else {
                console.warn('Photo upload failed', upErr);
              }
            }
          } catch (e) {
            console.warn('Photo compress/upload skipped', e);
          }
        }

        try {
          // Always attribute the row to the currently signed-in examiner.
          // This prevents stale local Owner_ID values from breaking RLS.
          rec.Owner_ID = cloudUser.id;
          const diag = await upsertScreeningRecord(rec, cloudUser.id);
          diag.droppedColumns?.forEach((column) => droppedColumns.add(column));
          syncedIds.add(rec.Child_ID);
          syncedCount++;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.error('Supabase upsert error', rec.Child_ID, lastError);
        }
      }

      if (syncedCount > 0) {
        const next = records.map(r => syncedIds.has(r.Child_ID) ? { ...r, _syncStatus: 'synced' as const } : r);
        if (persistRecords(next)) setRecords(next);
        const failedCount = pending.length - syncedCount;
        const droppedNote = droppedColumns.size > 0
          ? ` حقول غير موجودة في جدول Supabase وتم تجاوزها: ${Array.from(droppedColumns).join('، ')}. نفّذ supabase/schema.sql لتفعيلها.`
          : '';
        if (compact) {
          notify(
            failedCount > 0
              ? `⚠️ تمت مزامنة ${syncedCount} سجل — تعذر مزامنة ${failedCount}.`
              : '✅ تمت المزامنة',
            failedCount > 0 || droppedColumns.size > 0 ? 'info' : 'success',
          );
        } else {
          notify(
            `تمت مزامنة ${syncedCount} سجل مع سحابة المشرف.${failedCount > 0 ? ` تعذر مزامنة ${failedCount} سجل: ${lastError}` : ''}${droppedNote}`,
            failedCount > 0 || droppedColumns.size > 0 ? 'info' : 'success'
          );
        }
      } else {
        notify(`فشلت المزامنة: ${lastError || 'تحقق من الاتصال وإعدادات Supabase.'}`, 'error');
      }

      if (isAdminSession) {
        // Refresh the supervisor dataset after an upload so newly synced
        // examiner rows appear in the live dashboard immediately.
        await pullLatestFromCloud();
      }
    } catch (e) {
      console.error(e);
      notify(`خطأ أثناء المزامنة: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Pull the latest rows from Supabase and merge them into the local offline
   * database. RLS decides which rows the current role may read.
   */
  const pullLatestFromCloud = async () => {
    if (!isOnline) {
      notify('وضع العمل بدون إنترنت. لا يمكن سحب أحدث السجلات.', 'info');
      return;
    }
    if (!isSupabaseConfigured()) {
      notify('سحابة المشرف غير مُعدة.', 'info');
      return;
    }
    setIsSyncing(true);
    try {
      const { fetchScreeningRecords } = await import('./utils/supabaseClient');
      const incoming = await fetchScreeningRecords();
      if (incoming.length === 0) {
        notify('لا توجد سجلات في السحابة.', 'info');
        return;
      }
      const merged = [...records];
      for (const rec of incoming) {
        const idx = merged.findIndex(r => r.Child_ID === rec.Child_ID);
        if (idx >= 0) merged[idx] = rec;
        else merged.push(rec);
      }
      if (persistRecords(merged)) setRecords(merged);
      notify(`تم سحب ${incoming.length} سجل من السحابة ودمجها محلياً.`, 'success');
    } catch (e) {
      console.error(e);
      notify(`فشل سحب السجلات من السحابة: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // When a supervisor opens the live dashboard, immediately pull records that
  // examiner devices have already synced instead of showing only this browser's
  // local dataset.
  useEffect(() => {
    if (!adminOpen || adminPanel !== 'dashboard' || !isAdminSession) return;
    if (!isOnline || !isSupabaseConfigured()) return;
    void pullLatestFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminOpen, adminPanel, isAdminSession]);

  const handleUpdateRecord = (updated: StudentScreeningRecord) => {
    const pendingRecord: StudentScreeningRecord = { ...updated, _syncStatus: 'pending' };
    const updatedList = records.map((r) => (r.Child_ID === updated.Child_ID ? pendingRecord : r));
    if (!persistRecords(updatedList)) return;
    setRecords(updatedList);
  };

  const handleImportRecords = (incoming: StudentScreeningRecord[]) => {
    const analysis = analyzeRecordMerge(records, incoming);
    if (analysis.conflicts.length) {
      notify(`تغيرت البيانات أثناء مراجعة الملف؛ أُلغي الدمج بسبب تعارض المعرفات: ${analysis.conflicts.slice(0, 5).join('، ')}.`, 'error');
      return;
    }
    const updated = [
      ...analysis.additions.map(r => ({ ...r, _syncStatus: 'pending' as const })),
      ...records,
    ];
    if (!persistRecords(updated)) return;
    setRecords(updated);
    notify(`اكتمل الدمج: أضيف ${analysis.additions.length} سجل محلياً.`, 'success');
  };

  const handleClearRecords = async () => {
    const accepted = await confirmAction({
      title: 'حذف السجلات المحلية؟',
      message: 'سيؤدي هذا إلى حذف جميع سجلات الفحص من هذا المتصفح. لا يمكن التراجع عن الحذف.',
      confirmLabel: 'حذف السجلات',
      danger: true,
    });
    if (accepted) {
      try {
        localStorage.removeItem('albasar_master_records_v3');
      } catch {
        notify('تعذر حذف السجلات من التخزين المحلي.', 'error');
        return;
      }
      setRecords([]);
      notify('حُذفت السجلات من التخزين المحلي لهذا المتصفح.', 'success');
    }
  };

  const openCloudLogin = () => {
    setAuthGateMode(false);
    setCloudLoginOpen(true);
  };

  const handleCloudSignedIn = (user: CloudAuthUser) => {
    setCloudUser(user);
    setSessionActive(true);
    setSessionLocked(false);
    const fullName = user.fullName?.trim();
    const email = user.email?.trim() ?? '';
    // The modal already persisted the identity (full name + device); reuse it
    // so the top-bar badge and the record attribution stay consistent. The
    // role is mirrored from the server JWT — never from client input.
    const persisted = loadExaminerProfile();
    const profile = persisted ?? saveExaminerProfile({
      fullName: fullName ?? '',
      email: email || '',
      deviceId: examinerProfile?.deviceId,
    });
    const withRole = saveExaminerProfile({
      fullName: profile.fullName,
      email: profile.email,
      deviceId: profile.deviceId,
      userId: user.id,
      rememberMe: profile.rememberMe,
      role: user.role,
    });
    setExaminerProfile(withRole);
    setBiometricBound(hasBiometricCredential());
    if (withRole.fullName) {
      setExaminerId((current) => (current.trim() ? current : withRole.fullName));
    }
    notify('تم تسجيل الدخول إلى سحابة المشرف.', 'success');

    // An admin session immediately loads the full dataset so the live
    // dashboard is never empty when it is opened.
    if (user.role === 'admin') {
      window.setTimeout(() => {
        void pullLatestFromCloud();
      }, 400);
    }
  };

  const handleCloseCloudLogin = () => {
    setCloudLoginOpen(false);
    setAuthGateMode(false);
    // Leaving the gate without signing in must never block the offline
    // workflow — the examiner keeps screening locally.
    setSessionActive(true);
  };

  /**
   * 🔒 Lock the app — WITHOUT revoking the Supabase session.
   *
   * The `refresh_token` stays alive, so the next unlock (biometric or
   * password) lands on a live, renewable session and cloud sync keeps
   * working. Only the UI is gated.
   */
  const handleLockApp = async () => {
    const binding = getBiometricBinding();
    const accepted = await confirmAction({
      title: 'قفل الجلسة على هذا الجهاز؟',
      message: binding
        ? 'يمكنك فتحه لاحقاً ببصمة الإصبع أو الوجه — بدون إنترنت. تبقى جلسة Supabase سارية وتستمر المزامنة فور فتح التطبيق.'
        : 'سيلزم إدخال البريد الإلكتروني والرمز السري عند فتح التطبيق. تبقى جلسة Supabase سارية وتستمر المزامنة فور فتح التطبيق.',
      confirmLabel: '🔒 قفل الجلسة',
    });
    if (!accepted) return;
    setSessionLocked(true);
    setSessionActive(false);
    setCloudLoginOpen(false);
    setAuthGateMode(true);
    // Re-open the gate so the biometric button is immediately reachable.
    window.setTimeout(() => setCloudLoginOpen(true), 60);
    notify('تم قفل الجلسة. افتحها بالبصمة أو بالرمز السري — المزامنة تبقى فعّالة.', 'info');
  };

  /**
   * 🚪 Full sign-out — revokes the Supabase session and clears the device
   * binding, so the next user on this handset starts from a clean gate.
   */
  const handleCloudSignOut = async () => {
    const accepted = await confirmAction({
      title: 'تبديل الحساب / خروج نهائي؟',
      message: 'سيتم إنهاء جلسة Supabase وإلغاء ربط البصمة على هذا الجهاز. تبقى السجلات المحلية محفوظة على الجهاز، وسيُطلب من الحساب التالي تسجيل الدخول قبل المزامنة.',
      confirmLabel: '🚪 خروج نهائي',
      danger: true,
    });
    if (!accepted) return;
    try {
      const { signOutOfCloud } = await import('./utils/supabaseAuth');
      await signOutOfCloud();
    } catch {
      // حتى إذا فشل طلب الشبكة، نُمسح الجلسة محلياً
    }
    setCloudUser(null);
    // The biometric binding belongs to the *device*, not to the account, and
    // must not be usable by the next user of this handset.
    try {
      clearBiometricCredential();
    } catch {
      // ignore storage failures
    }
    setBiometricBound(false);
    clearExaminerProfile();
    setExaminerProfile(null);
    setSessionLocked(false);
    setSessionActive(false);
    setAuthGateMode(true);
    setCloudLoginOpen(true);
    notify('تم تسجيل الخروج وإلغاء ربط البصمة. الفحص المحلي مستمر.', 'info');
  };

  const generateNextId = (sourceRecords: StudentScreeningRecord[] = records) => {
    /**
     * Device-scoped protocol IDs (`BAB-A4F-101`).
     *
     * The numeric tail keeps its SPIRIT Item 16 meaning (parity drives the
     * paper-first / digital-first crossover), while the 3-character device
     * prefix makes the code globally unique. Without it, two teams screening
     * different schools offline would both mint `BAB-101` and one team's
     * record would silently overwrite the other's on sync.
     */
    const deviceId = examinerProfile?.deviceId || getOrCreateDeviceId();
    const nextId = generateParticipantId(
      sourceRecords.map((record) => record.Child_ID),
      deviceId,
    );
    const nextNumber = extractParticipantNumber(nextId) ?? 0;
    setChildId(nextId);
    setCrossoverSequence('PAPER_FIRST');
    if (nextNumber > PARTICIPANT_ID_LAST) {
      notify(`تم استكمال إطار العينة المعتمد (BAB-${PARTICIPANT_ID_LAST}). راجع بروتوكول الدراسة قبل تسجيل مشاركين إضافيين.`, 'info');
    }
    setPaperStartedAt('');
    setPaperCompletedAt('');
    setSmartStartedAt('');
    setSmartCompletedAt('');
    setSmartOd('');
    setSmartOs('');
    setSmartTimeSec(0);
    setParentalConsent(0);
    // Grade and station examiner IDs are session-level and stay pre-filled.
    // Age is re-derived from the preserved grade so the next child starts with
    // a safe default, not a stale age.
    setAgeYears(defaultAgeForGrade(gradeLevel));
    setGender('');
    setWearsGlasses(-1);
    setWHOPreScreen(EMPTY_WHO_PRE_SCREEN);
    setHirschbergMM(0.2);
    setMrd1MM(4.1);
    setHirschbergRecorded(false);
    setMrd1Recorded(false);
    setTriageOcularFlag(0);
    setAIQualityFlag(0);
    setPaperOd('');
    setPaperOs('');
    setPaperTimeSec(0);
    setAsthenopiaScore(0);
    setExternalEyeFindings([]);
    setExternalEyeOther('');
    setExternalEyeScreened(false);
    setEyePhoto(null);
  };

  // Typing (or QR-scanning) a BAB-xxx code re-assigns the counterbalanced
  // crossover sequence from the numeric ID parity (SPIRIT Item 16).
  const handleChildIdChange = (id: string) => {
    setChildId(id);
    setCrossoverSequence('PAPER_FIRST');
  };

  const handleCommitRecord = async () => {
    if (parentalConsent !== 1) {
      notify('لا يمكن حفظ السجل قبل تأكيد الموافقة المطلوبة وفق بروتوكول الدراسة.', 'error');
      return;
    }

    if (!childId.trim() || !examinerId.trim() || !paperExaminerId.trim() || !smartExaminerId.trim() || !paperStartedAt || !paperCompletedAt || !smartStartedAt || !smartCompletedAt || paperTimeSec <= 0 || smartTimeSec <= 0 || !schoolName.trim() || !schoolSector || gradeLevel < 1 || gradeLevel > 6 || ageYears < 5 || ageYears > 14 || !gender || (wearsGlasses !== 0 && wearsGlasses !== 1) || !crossoverSequence) {
      notify('أكمل معرفات الفاحصين، أزمنة المحطتين، التسلسل المخصص، وبيانات المشارك والمدرسة قبل الحفظ.', 'error');
      setActiveTab('protocol');
      return;
    }

    // Each station must contain its own examiner-entered results before the record can be committed.
    if (!paperOd.trim() || !paperOs.trim()) {
      notify('أدخل نتيجة كلتا العينين في محطة الفحص الورقي قبل حفظ السجل.', 'error');
      setActiveTab('protocol');
      return;
    }

    if (records.some((record) => normalizeParticipantId(record.Child_ID) === normalizeParticipantId(childId))) {
      notify('كود التلميذ موجود مسبقاً. أدخل كوداً فريداً قبل الحفظ.', 'error');
      setActiveTab('protocol');
      return;
    }

    // Strict Blinding Check: Station 2 Smart Acuity MUST be completed independently.
    if (!smartOd.trim() || !smartOs.trim()) {
      notify('أكمل نتيجة كلتا العينين في المحطة الرقمية بشكل مستقل عن نتيجة المحطة الورقية.', 'error');
      setActiveTab('acuity');
      return;
    }

    if (!hirschbergRecorded || !mrd1Recorded) {
      notify('أكمل قياسي المنعكس القرني وMRD₁ أو أكّد إدخال كل قيمة من قياس فعلي قبل حفظ السجل.', 'error');
      setActiveTab('biometry');
      return;
    }

    const odLog = LOGMAR_MAP[smartOd] ?? 0;
    const osLog = LOGMAR_MAP[smartOs] ?? 0;
    const pLogOd = LOGMAR_MAP[paperOd] ?? 0;
    const pLogOs = LOGMAR_MAP[paperOs] ?? 0;

    const iod = Math.abs(odLog - osLog);
    // WHO (2025) binary referral cutoff: 6/12 => LogMAR >= 0.30 (code 88 always refers).
    const paperRef = Math.max(pLogOd, pLogOs) >= REFERRAL_LOGMAR_CUTOFF ? 1 : 0;

    const decision = classifyClinicalDecision(
      smartOd,
      smartOs,
      hirschbergMM,
      mrd1MM,
      asthenopiaScore,
      {
        paperOd,
        paperOs,
        externalEyeFindings,
        whoPreScreen: {
          diabetes: whoPreScreen.diabetes,
          eyePainOrSevereItch: whoPreScreen.eyePainOrSevereItch,
          childAssent: whoPreScreen.childAssent,
        },
      },
    );

    // WHO (2025) untestable-child rule: code 88 in any station forces the final referral flag.
    const untestableRecorded =
      pLogOd === UNTTESTABLE_LOGMAR || pLogOs === UNTTESTABLE_LOGMAR ||
      odLog === UNTTESTABLE_LOGMAR || osLog === UNTTESTABLE_LOGMAR;
    const finalTriageReferral = decision.referralCode === 1 || untestableRecorded ? 1 : 0;
    const referralUrgency =
      untestableRecorded && decision.urgency === 'MODEL_NO_FLAG'
        ? 'MODEL_PRIORITY' as const
        : decision.urgency;

    const whoPreScreenComplete = Object.values(whoPreScreen).every((value) => value !== '');
    const whoPreScreenResponses = whoPreScreenComplete
      ? (whoPreScreen as WHOPreScreenResponses)
      : undefined;

    const newRecord: StudentScreeningRecord = {
      Child_ID: childId.trim() || 'BAB-Unknown',
      Examiner_ID: examinerId.trim(),
      Examiner_Full_Name: examinerProfile?.fullName?.trim() || examinerId.trim(),
      Device_ID: examinerProfile?.deviceId?.trim() || getOrCreateDeviceId(),
      _syncStatus: 'pending',
      Paper_Examiner_ID: paperExaminerId.trim(),
      Paper_Started_At: paperStartedAt,
      Paper_Completed_At: paperCompletedAt,
      Smart_Examiner_ID: smartExaminerId.trim(),
      Smart_Started_At: smartStartedAt,
      Smart_Completed_At: smartCompletedAt,
      Parental_Consent: parentalConsent,
      Child_Assent: whoPreScreen.childAssent === 'YES' ? 'YES' : whoPreScreen.childAssent === 'NO' ? 'NO' : undefined,
      Examination_Date: new Date().toISOString(),
      School_Name: schoolName,
      School_Sector: schoolSector,
      Grade_Level: gradeLevel,
      Age_Years: ageYears,
      Gender: gender,
      Wears_Glasses: wearsGlasses,
      WHO_PreScreen: whoPreScreenResponses,
      WHO_Screening: {
        examinerId: smartExaminerId.trim(),
        startedAt: smartStartedAt,
        completedAt: smartCompletedAt,
        chartMethod: chartMode === 'HOTV' ? 'HOTV_MATCHING_CARD' : 'TUMBLING_E_DIRECTION',
        chartDistanceM: calibration.testingDistanceMeters ?? 2.0,
        odTopCorrect: null,
        odBottomCorrect: null,
        osTopCorrect: null,
        osBottomCorrect: null,
        odStatus: null,
        osStatus: null,
        externalEyeScreenCompleted: externalEyeScreened,
        externalEyeFindings,
        externalEyeOther,
      },
      Crossover_Sequence: crossoverSequence,
      Paper_Snellen_OD: paperOd,
      Paper_LogMAR_OD: +pLogOd.toFixed(2),
      Paper_Snellen_OS: paperOs,
      Paper_LogMAR_OS: +pLogOs.toFixed(2),
      Paper_LogMAR_Worse: +worseEyeLogMAR(pLogOd, pLogOs).toFixed(2),
      Paper_Time_Sec: paperTimeSec,
      Paper_Referral: paperRef,
      Smart_Snellen_OD: smartOd,
      Smart_Acuity_OD_Below_Test_Range: smartOd === 'أقل من 6/60',
      Smart_LogMAR_OD: +odLog.toFixed(2),
      Smart_Snellen_OS: smartOs,
      Smart_Acuity_OS_Below_Test_Range: smartOs === 'أقل من 6/60',
      Smart_LogMAR_OS: +osLog.toFixed(2),
      Smart_LogMAR_Worse: +worseEyeLogMAR(odLog, osLog).toFixed(2),
      Smart_IOD_LogMAR: +iod.toFixed(2),
      Smart_Time_Sec: smartTimeSec,
      Hirschberg_Asym_mm: +hirschbergMM.toFixed(2),
      Hirschberg_Prism_Diopters: Math.round(hirschbergMM * 15),
      MRD1_Min_mm: +mrd1MM.toFixed(2),
      Triage_Ocular_Flag: triageOcularFlag,
      AI_Quality_Flag: aiQualityFlag || 3,
      Asthenopia_Score: asthenopiaScore,
      Final_Triage_Referral: finalTriageReferral,
      Referral_Urgency: referralUrgency,
      Referral_PHCC: referralPHCC,
      FollowUp_Status: 0,
      Spectacles_Prescribed_Fitted: 0,
      Gold_Standard_Confirmed: 99,
    };

    const updated = [newRecord, ...records];
    if (!persistRecords(updated)) return;

    // The eye photo lives in IndexedDB (keyed by Child_ID), never in localStorage.
    if (eyePhoto) {
      try {
        const { saveEyePhoto } = await import('./utils/eyePhotoStore');
        const stored = await saveEyePhoto(newRecord.Child_ID, eyePhoto.blob);
        if (!stored) {
          console.warn('Eye photo could not be stored in IndexedDB for', newRecord.Child_ID);
        }
      } catch (error) {
        console.warn('Eye photo could not be stored in IndexedDB', error);
      }
    }

    setRecords(updated);

    notify(`حُفظ فحص التلميذ ${newRecord.Child_ID}. بدأ سجل تلميذ جديد.`, 'success');
    // Clear active draft after successful commit
    clearScreeningDraft();
    deleteEyePhoto('__active_draft__').catch(() => {});
    setEyePhoto(null);
    generateNextId(updated);
    setActiveTab('protocol');
  };

  const paperFirstSequence = 'PAPER_FIRST';
  const digitalFirstSequence = 'DIGITAL_FIRST';
  const isDigitalFirst = crossoverSequence === digitalFirstSequence;
  const isPaperFirst = crossoverSequence === paperFirstSequence;
  const anyStationStarted = Boolean(paperStartedAt || smartStartedAt);
  const bothStationsComplete = Boolean(paperCompletedAt && smartCompletedAt);
  const registrationReady = Boolean(
    childId.trim() && parentalConsent === 1 && examinerId.trim() &&
    schoolName.trim() && schoolSector &&
    gradeLevel >= 1 && gradeLevel <= 6 && ageYears >= 5 && ageYears <= 14 &&
    gender && (wearsGlasses === 0 || wearsGlasses === 1) &&
    (isPaperFirst || isDigitalFirst)
  );
  const stationReady = registrationReady;

  const derivedChartMode: ChartMode =
    (ageYears >= 5 && ageYears <= 8) || (gradeLevel >= 1 && gradeLevel <= 3)
      ? 'HOTV'
      : 'TUMBLING_E';
  const [chartMode, setChartMode] = useState<ChartMode>(derivedChartMode);
  useEffect(() => {
    if (!smartStartedAt) setChartMode(derivedChartMode);
  }, [derivedChartMode, smartStartedAt]);

  const draftHydratedRef = useRef(false);
  const liveDraftRef = useRef<ActiveScreeningDraft | null>(null);

  // Hydrate active screening draft on first mount before user interaction.
  useEffect(() => {
    const draft = loadScreeningDraft();
    if (!draft) return;
    draftHydratedRef.current = true;
    setChildId(draft.childId ?? '');
    setGradeLevel(draft.gradeLevel ?? INITIAL_SESSION_CONTEXT.gradeLevel ?? 1);
    setAgeYears(draft.ageYears ?? defaultAgeForGrade(INITIAL_SESSION_CONTEXT.gradeLevel ?? 1));
    setGender(draft.gender ?? '');
    setWearsGlasses(draft.wearsGlasses ?? -1);
    setParentalConsent(draft.parentalConsent ?? 0);
    setWHOPreScreen(draft.whoPreScreen ?? EMPTY_WHO_PRE_SCREEN);
    setPaperOd(draft.paperOd ?? '');
    setPaperOs(draft.paperOs ?? '');
    setPaperTimeSec(draft.paperTimeSec ?? 0);
    if (draft.paperStationStarted) setPaperStartedAt(new Date().toISOString());
    setSmartOd(draft.smartOd ?? '');
    setSmartOs(draft.smartOs ?? '');
    setSmartTimeSec(draft.smartTimeSec ?? 0);
    if (draft.smartStationStarted) setSmartStartedAt(new Date().toISOString());
    setChartMode(draft.chartMode ?? 'TUMBLING_E');
    setHirschbergMM(draft.hirschbergMM ?? 0.2);
    setHirschbergRecorded(draft.hirschbergRecorded ?? false);
    setMrd1MM(draft.mrd1MM ?? 4.1);
    setMrd1Recorded(draft.mrd1Recorded ?? false);
    setAIQualityFlag(draft.aiQualityFlag ?? 0);
    setTriageOcularFlag(draft.triageOcularFlag ?? 0);
    setAsthenopiaScore(draft.asthenopiaScore ?? 0);
    setExternalEyeFindings(draft.externalEyeFindings ?? []);
    setExternalEyeOther(draft.externalEyeOther ?? '');
    setExternalEyeScreened(draft.externalEyeScreened ?? false);
    const stepMap: Record<number, ClinicalStepId> = { 1: 'protocol', 2: 'acuity', 3: 'biometry', 4: 'cdss' };
    setActiveTab(stepMap[draft.activeStep] ?? 'protocol');
    if (draft.hasDraftPhoto) {
      getEyePhoto('__active_draft__').then((blob) => {
        if (blob) setEyePhoto({ blob, dataUrl: URL.createObjectURL(blob) });
      }).catch(() => {});
    }
    notify('💾 تم استعادة بيانات التلميذ الحالي', 'info');
  }, []);

  // Auto-save draft on any screening field change, and persist eye photo.
  useEffect(() => {
    if (!draftHydratedRef.current) return;
    const activeStep: 1 | 2 | 3 | 4 = activeTab === 'protocol' ? 1 : activeTab === 'acuity' ? 2 : activeTab === 'biometry' ? 3 : 4;
    const draft: ActiveScreeningDraft = {
      version: 1,
      updatedAt: Date.now(),
      activeStep,
      childId,
      gradeLevel,
      ageYears,
      gender,
      wearsGlasses,
      parentalConsent,
      whoPreScreen,
      paperOd,
      paperOs,
      paperTimeSec,
      paperStationStarted: Boolean(paperStartedAt),
      smartOd,
      smartOs,
      smartTimeSec,
      smartStationStarted: Boolean(smartStartedAt),
      chartMode,
      hirschbergMM,
      hirschbergRecorded,
      mrd1MM,
      mrd1Recorded,
      aiQualityFlag,
      triageOcularFlag,
      asthenopiaScore,
      externalEyeFindings,
      externalEyeOther,
      externalEyeScreened,
      hasDraftPhoto: Boolean(eyePhoto),
    };
    liveDraftRef.current = draft;
    saveScreeningDraft(draft);
    if (eyePhoto?.blob) {
      saveEyePhoto('__active_draft__', eyePhoto.blob).catch(() => {});
    } else {
      deleteEyePhoto('__active_draft__').catch(() => {});
    }
  }, [
    activeTab,
    childId,
    gradeLevel,
    ageYears,
    gender,
    wearsGlasses,
    parentalConsent,
    whoPreScreen,
    paperOd,
    paperOs,
    paperTimeSec,
    paperStartedAt,
    smartOd,
    smartOs,
    smartTimeSec,
    smartStartedAt,
    chartMode,
    hirschbergMM,
    hirschbergRecorded,
    mrd1MM,
    mrd1Recorded,
    aiQualityFlag,
    triageOcularFlag,
    asthenopiaScore,
    externalEyeFindings,
    externalEyeOther,
    externalEyeScreened,
    eyePhoto,
  ]);

  // Force synchronous flush on mobile app switch / lock
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && liveDraftRef.current) {
        saveScreeningDraft(liveDraftRef.current);
      }
    };
    const handlePageHide = () => {
      if (liveDraftRef.current) saveScreeningDraft(liveDraftRef.current);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  const canNavigateTo = (tabId: ClinicalStepId) => {
    if (anyStationStarted && !bothStationsComplete) return tabId === activeTab;
    if (tabId === 'protocol') return true;
    if (!registrationReady) return false;
    if (!isPaperFirst && !isDigitalFirst) return false;
    if (tabId === 'biometry' || tabId === 'cdss') return bothStationsComplete;
    if (isPaperFirst) {
      if (!paperCompletedAt) return false;
      if (!smartCompletedAt) return tabId === 'acuity';
      return tabId === 'acuity';
    }
    if (!smartCompletedAt) return tabId === 'acuity';
    if (!paperCompletedAt) return false;
    return tabId === 'acuity';
  };

  const navigateToTab = (tabId: ClinicalStepId) => {
    if (!canNavigateTo(tabId)) {
      notify('المحطة مقفلة حتى إكمال المحطة السابقة وفق التسلسل المسجل.', 'info');
      return;
    }
    setActiveTab(tabId);
  };

  /** Native-app feel: every step change starts the reader at the top. */
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, behavior });
    document.getElementById('main-content')?.scrollIntoView({ block: 'start', behavior });
  }, [activeTab]);

  const proceedFromRegistration = () => {
    if (!registrationReady) {
      notify('أكمل الموافقة وبيانات المشارك قبل بدء المحطة الأولى.', 'error');
      return;
    }
    if (!paperStartedAt || !paperOd.trim() || !paperOs.trim()) {
      notify('ابدأ مؤقت الفحص الورقي وأدخل نتيجتي العينين قبل متابعة المسار.', 'error');
      return;
    }
    setPaperCompletedAt(new Date().toISOString());
    setActiveTab('acuity');
  };

  const activeClinicalIndex = CLINICAL_STEPS.findIndex((item) => item.id === activeTab);
  const activeClinicalStep = activeClinicalIndex >= 0 ? CLINICAL_STEPS[activeClinicalIndex] : null;
  const isClinicalView = activeClinicalStep !== null;

  const stepCompleted: Record<ClinicalStepId, boolean> = {
    protocol: Boolean(paperCompletedAt),
    acuity: Boolean(smartCompletedAt),
    biometry: hirschbergRecorded && mrd1Recorded,
    cdss: false,
  };

  /** Two-letter monogram for the compact account avatar (e.g. "أم"). */
  const examinerInitials = (() => {
    const source = examinerProfile?.fullName?.trim() || examinerProfile?.email?.trim() || '';
    if (!source) return '؟';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
    return source.slice(0, 2);
  })();

  const canGoBack = isClinicalView && activeClinicalIndex > 0;
  const stepNextDisabled =
    activeTab === 'protocol'
      ? !registrationReady
      : activeTab === 'acuity'
        ? !smartOd || !smartOs
        : activeTab === 'biometry'
          ? !(hirschbergRecorded && mrd1Recorded)
          : activeTab === 'cdss'
            ? !paperOd || !paperOs || !smartOd || !smartOs || !hirschbergRecorded || !mrd1Recorded
            : false;

  const handleWizardBack = () => {
    if (!isClinicalView || activeClinicalIndex <= 0) return;
    const previousId = CLINICAL_STEPS[activeClinicalIndex - 1].id;
    if (previousId === 'protocol') {
      setActiveTab('protocol');
      return;
    }
    if (canNavigateTo(previousId)) {
      setActiveTab(previousId);
      return;
    }
    notify('أكمل المحطة الحالية أولاً قبل الرجوع إلى محطة لاحقة.', 'info');
  };

  const handleWizardNext = () => {
    if (!isClinicalView) return;
    if (activeTab === 'protocol') {
      proceedFromRegistration();
      return;
    }
    if (activeTab === 'acuity') {
      if (!smartOd.trim() || !smartOs.trim()) {
        notify('أكمل فحص العين اليمنى واليسرى قبل المتابعة.', 'error');
        return;
      }
      if (!paperCompletedAt) {
        notify('أنهِ المحطة الورقية المتبقية ثم تابع إلى فحص العين.', 'info');
        setActiveTab('protocol');
        return;
      }
      navigateToTab('biometry');
      return;
    }
    if (activeTab === 'biometry') {
      navigateToTab('cdss');
      return;
    }
    handleCommitRecord();
  };

  const nextLabel =
    activeTab === 'protocol'
      ? 'متابعة إلى فحص البصر'
      : activeTab === 'acuity'
        ? 'متابعة إلى فحص العين'
        : activeTab === 'biometry'
          ? 'عرض النتيجة'
          : 'حفظ وانتقال للتلميذ التالي';

  const coach = (() => {
    const participant = childId.trim() || 'التلميذ الجديد';
    const sequence = isDigitalFirst
      ? 'رقمي (2م) ← ورقي (6م)'
      : 'ورقي (6م) ← رقمي (2م)';

    if (!childId.trim()) {
      return {
        tone: 'neutral',
        title: 'الخطوة الحالية: ابدأ بتسجيل التلميذ',
        body: 'اضغط «كود تلقائي» أو امسح QR ثم أكمل بيانات التلميذ.',
      };
    }

    if (activeTab === 'protocol') {
      if (isDigitalFirst && !smartCompletedAt) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — المسار ${sequence}`,
          body: 'أكّد الموافقة ثم ابدأ الفحص الرقمي (2م).',
        };
      }
      if (isDigitalFirst && smartCompletedAt && !paperCompletedAt) {
        return {
          tone: 'warn',
          title: `الخطوة الحالية: ${participant} — أكمل المحطة الورقية`,
          body: 'انتهى الفحص الرقمي — ابدأ مؤقت المحطة الورقية.',
        };
      }
      if (!paperCompletedAt) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — المسار ${sequence}`,
          body: 'ابدأ المؤقت وسجّل OD ثم OS.',
        };
      }
      return {
        tone: 'pass',
        title: `الخطوة الحالية: ${participant} — المحطة الورقية مكتملة`,
        body: 'اضغط «متابعة إلى فحص البصر».',
      };
    }

    if (activeTab === 'acuity') {
      if (!smartOd.trim()) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — العين اليمنى OD`,
          body: 'اعرض الرمز المناسب للصف وسجّل استجابة الطفل.',
        };
      }
      if (!smartOs.trim()) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — العين اليسرى OS`,
          body: 'أكمل العين اليسرى دون الرجوع لنتيجة الورقية.',
        };
      }
      if (!paperCompletedAt) {
        return {
          tone: 'warn',
          title: `الخطوة الحالية: ${participant} — عد للمحطة الورقية`,
          body: 'ارجع للخطوة 1 لإكمال المحطة الورقية.',
        };
      }
      return {
        tone: 'pass',
        title: `الخطوة الحالية: ${participant} — اكتمل فحص النظر`,
        body: 'اضغط «متابعة إلى فحص العين».',
      };
    }

    if (activeTab === 'biometry') {
      if (!hirschbergRecorded || !mrd1Recorded) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — صورة العين والقياسات`,
          body: 'افتح الكاميرا والتقط صورة أو المس توصية سريرية.',
        };
      }
      if (!externalEyeScreened) {
        return {
          tone: 'warn',
          title: `الخطوة الحالية: ${participant} — تأكيد العين الخارجية`,
          body: 'أكد «العين الخارجية سليمة» أو سجّل الملاحظات.',
        };
      }
      return {
        tone: 'pass',
        title: `الخطوة الحالية: ${participant} — جاهز للنتيجة`,
        body: 'راجع القياسات ثم اعرض النتيجة.',
      };
    }

    return {
      tone: 'pass',
      title: `الخطوة الحالية: ${participant} — النتيجة والحفظ`,
      body: 'راجع النتيجة ثم احفظ السجل.',
    };
  })();

  const gateActive = authGateMode && cloudLoginOpen;

  return (
    <div
      className={`app-shell${gateActive ? ' is-gated' : ''}`}
      dir="rtl"
      data-session={sessionActive ? 'active' : 'locked'}
    >
      <a href="#main-content" className="skip-link">تخطي إلى محتوى المحطة</a>

      <header className="topbar">
        <div className="topbar__inner" dir="rtl">
          <div className="brand">
            <div className="brand__mark"><Eye size={21} aria-hidden="true" /></div>
            <div className="brand__copy">
              <h1 className="brand__title">البصر <span>Al-Basar</span></h1>
            </div>
          </div>

          <div className="topbar__actions">
            {/* 1 · One-tap sync with a pending-record badge */}
            <button
              type="button"
              onClick={() => void syncLocalRecordsToCloud(true)}
              className={`icon-action icon-action--sync${isOnline ? '' : ' is-offline'}`}
              aria-label={pendingSyncCount > 0
                ? `مزامنة ${pendingSyncCount} سجل معلّق`
                : 'مزامنة السجلات الآن'}
              title={pendingSyncCount > 0
                ? `${pendingSyncCount} سجل بانتظار المزامنة`
                : 'مزامنة السجلات الآن'}
              disabled={!isOnline || isSyncing}
              aria-busy={isSyncing}
            >
              <RefreshCw size={19} className={isSyncing ? 'spin' : ''} aria-hidden="true" />
              {pendingSyncCount > 0 && (
                <span className="icon-action__badge">{pendingSyncCount > 99 ? '99+' : pendingSyncCount}</span>
              )}
              {!isOnline && <span className="icon-action__offline-dot" aria-hidden="true" />}
            </button>

            {/* 2 · Account: initials + lock / sign-out, or sign-in for a guest */}
            {examinerProfile ? (
              <div className="topbar__account">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className={`icon-action icon-action--account${accountMenuOpen ? ' is-open' : ''}`}
                  aria-label="حساب الفاحص"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  title={examinerProfile.fullName || examinerProfile.email || 'حساب الفاحص'}
                >
                  <span className="topbar__avatar" aria-hidden="true">{examinerInitials}</span>
                  {biometricBound && (
                    <span className="icon-action__bio-dot" aria-hidden="true">
                      <Fingerprint size={11} />
                    </span>
                  )}
                </button>

                {accountMenuOpen && (
                  <div className="account-menu" role="menu" aria-label="إجراءات الحساب">
                    <div className="account-menu__head">
                      <span className="account-menu__name">
                        {examinerProfile.fullName || examinerProfile.email || 'حساب الفاحص'}
                      </span>
                      {biometricBound && (
                        <span className="account-menu__badge">🔐 دخول بالبصمة مفعّل</span>
                      )}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="account-menu__item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void handleLockApp();
                      }}
                    >
                      {biometricBound
                        ? <Fingerprint size={17} aria-hidden="true" />
                        : <Lock size={17} aria-hidden="true" />}
                      <span>🔒 قفل الجلسة (بالبصمة)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="account-menu__item"
                      onClick={async () => {
                        const confirmed = await confirmAction({
                          title: 'مسح المسودة والبدء من جديد؟',
                          message: 'سيتم حذف بيانات التلميذ الحالي غير المحفوظة والعودة خطوة 1. لا يمكن التراجع.',
                          confirmLabel: 'مسح المسودة',
                          danger: true,
                        });
                        if (!confirmed) return;
                        setAccountMenuOpen(false);
                        clearScreeningDraft();
                        await deleteEyePhoto('__active_draft__').catch(() => {});
                        setEyePhoto(null);
                        // Reset screening state
                        setChildId('');
                        setGradeLevel(INITIAL_SESSION_CONTEXT.gradeLevel ?? 1);
                        setAgeYears(defaultAgeForGrade(INITIAL_SESSION_CONTEXT.gradeLevel ?? 1));
                        setGender('');
                        setWearsGlasses(-1);
                        setParentalConsent(0);
                        setWHOPreScreen(EMPTY_WHO_PRE_SCREEN);
                        setPaperOd('');
                        setPaperOs('');
                        setPaperTimeSec(0);
                        setPaperStartedAt('');
                        setPaperCompletedAt('');
                        setSmartOd('');
                        setSmartOs('');
                        setSmartTimeSec(0);
                        setSmartStartedAt('');
                        setSmartCompletedAt('');
                        setHirschbergMM(0.2);
                        setHirschbergRecorded(false);
                        setMrd1MM(4.1);
                        setMrd1Recorded(false);
                        setAIQualityFlag(0);
                        setTriageOcularFlag(0);
                        setAsthenopiaScore(0);
                        setExternalEyeFindings([]);
                        setExternalEyeOther('');
                        setExternalEyeScreened(false);
                        setActiveTab('protocol');
                        notify('تم مسح المسودة والعودة للبداية.', 'info');
                      }}
                    >
                      <span>🗑️ مسح المسودة والبدء من جديد</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="account-menu__item account-menu__item--danger"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void handleCloudSignOut();
                      }}
                    >
                      <LogOut size={17} aria-hidden="true" />
                      <span>🚪 تبديل الحساب / خروج نهائي</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={openCloudLogin}
                className="icon-action icon-action--login"
                aria-label="تسجيل الدخول"
                title="تسجيل الدخول"
              >
                <LogIn size={19} aria-hidden="true" />
                <span className="icon-action__label">دخول</span>
              </button>
            )}

            {/* 3 · Role-aware drawer: 📊 الإدارة for an admin, 🧰 الأدوات for an examiner */}
            <button
              type="button"
              onClick={() => {
                setAdminPanel(isAdminSession ? 'dashboard' : 'calib');
                setAdminOpen(true);
              }}
              className={`icon-action icon-action--admin${isAdminSession ? ' is-admin' : ''}`}
              aria-label={isAdminSession ? 'لوحة الإدارة' : 'أدوات الفاحص'}
              title={isAdminSession ? '📊 الإدارة' : '🧰 الأدوات'}
            >
              {isAdminSession
                ? <LayoutDashboard size={19} aria-hidden="true" />
                : <Wrench size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div className="step-indicator">
        <div className="step-indicator__track">
          {CLINICAL_STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className={`step-dot ${activeTab === step.id ? 'is-active' : ''}`}>
                <span className="step-dot__num">{step.num}</span>
                <span className="step-dot__label">{step.label}</span>
              </div>
              {idx < CLINICAL_STEPS.length - 1 && <span className="step-sep">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <main
        className={`app-main${activeTab === 'acuity' ? ' app-main--acuity' : ''}`}
        id="main-content"
        inert={gateActive}
      >
          <> 
            <div className="page-intro">
              <div>
                <div className="page-intro__eyebrow">الخطوة {activeClinicalStep?.num ?? 1} من 4</div>
                <h1>{activeClinicalStep?.label ?? CLINICAL_STEPS[0].label}</h1>
                <p>{activeClinicalStep?.description ?? CLINICAL_STEPS[0].description}</p>
              </div>
              <div className="count-pill" aria-live="polite">{records.length} سجل محفوظ</div>
            </div>

            <div className={`coach-banner coach-banner--${coach.tone}`} role="status" aria-live="polite">
              <span className="coach-banner__icon" aria-hidden="true"><Sparkles size={19} /></span>
              <div className="coach-banner__copy">
                <strong>{coach.title}</strong>
                <span>{coach.body}</span>
              </div>
              <span className="coach-banner__badge">خطوة {activeClinicalStep?.num ?? 1} / 4</span>
            </div>

            <div className="station-content">
              {activeTab === 'protocol' && (
                <RegistrationAndPaperStation
                  childId={childId}
                  setChildId={handleChildIdChange}
                  examinerId={examinerId}
                  setExaminerId={setExaminerId}
                  parentalConsent={parentalConsent}
                  setParentalConsent={setParentalConsent}
                  schoolName={schoolName}
                  setSchoolName={setSchoolName}
                  schoolSector={schoolSector}
                  setSchoolSector={setSchoolSector}
                  gradeLevel={gradeLevel}
                  setGradeLevel={setGradeLevel}
                  ageYears={ageYears}
                  setAgeYears={setAgeYears}
                  gender={gender}
                  setGender={setGender}
                  wearsGlasses={wearsGlasses}
                  setWearsGlasses={setWearsGlasses}
                  whoPreScreen={whoPreScreen}
                  setWHOPreScreen={setWHOPreScreen}
                  crossoverSequence={crossoverSequence}
                  setCrossoverSequence={setCrossoverSequence}
                  paperExaminerId={paperExaminerId}
                  setPaperExaminerId={setPaperExaminerId}
                  examinerName={examinerProfile?.fullName || examinerId}
                  alternateExaminerId={alternateExaminerId}
                  setAlternateExaminerId={setAlternateExaminerId}
                  onPaperTestStarted={() => {
                    setPaperExaminerId((current) => current || examinerId || 'PAPER-EXAMINER');
                    setPaperStartedAt(new Date().toISOString());
                    setPaperCompletedAt('');
                  }}
                  showPaperStation={true}
                  isDigitalFirst={isDigitalFirst}
                  sequenceLocked={anyStationStarted}
                  smartCompleted={Boolean(smartCompletedAt)}
                  identityLocked={anyStationStarted}
                  stationReady={stationReady}
                  paperStationStarted={Boolean(paperStartedAt)}
                  paperOd={paperOd}
                  setPaperOd={setPaperOd}
                  paperOs={paperOs}
                  setPaperOs={setPaperOs}
                  paperTimeSec={paperTimeSec}
                  setPaperTimeSec={setPaperTimeSec}
                  referralPHCC={referralPHCC}
                  setReferralPHCC={setReferralPHCC}
                  onProceedToSmartStation={proceedFromRegistration}
                  onGenerateNextId={() => generateNextId()}
                  onQRScannerOpenChange={setQrScannerOpen}
                  qrScannerCloseSignal={qrScannerCloseSignal}
                />
              )}

              {activeTab === 'acuity' && (
                <AdaptiveAcuityStation
                  calibration={calibration}
                  smartOd={smartOd}
                  setSmartOd={setSmartOd}
                  smartOs={smartOs}
                  setSmartOs={setSmartOs}
                  smartTimeSec={smartTimeSec}
                  setSmartTimeSec={setSmartTimeSec}
                  smartExaminerId={smartExaminerId}
                  setSmartExaminerId={setSmartExaminerId}
                  examinerName={examinerProfile?.fullName || examinerId}
                  alternateExaminerId={alternateExaminerId}
                  smartExaminerLocked={Boolean(smartStartedAt)}
                  onSmartTestStarted={(eye) => {
                    setSmartExaminerId((current) => current || examinerId || 'SMART-EXAMINER');
                    if (eye === 'OD' || !smartStartedAt) setSmartStartedAt(new Date().toISOString());
                    setSmartCompletedAt('');
                  }}
                  onSmartTestCompleted={() => {
                    setSmartCompletedAt(new Date().toISOString());
                    if (isDigitalFirst) setActiveTab('protocol');
                  }}
                  onProceedToBiometry={() => navigateToTab('biometry')}
                  chartMode={chartMode}
                  onChartModeChange={setChartMode}
                />
              )}

              {activeTab === 'biometry' && (
                <OcularBiometryStation
                  hirschbergMM={hirschbergMM}
                  setHirschbergMM={(value) => {
                    setHirschbergMM(value);
                    setHirschbergRecorded(true);
                  }}
                  hirschbergRecorded={hirschbergRecorded}
                  setHirschbergRecorded={setHirschbergRecorded}
                  mrd1MM={mrd1MM}
                  setMrd1MM={(value) => {
                    setMrd1MM(value);
                    setMrd1Recorded(true);
                  }}
                  mrd1Recorded={mrd1Recorded}
                  setMrd1Recorded={setMrd1Recorded}
                  triageOcularFlag={triageOcularFlag}
                  setTriageOcularFlag={setTriageOcularFlag}
                  aiQualityFlag={aiQualityFlag}
                  setAIQualityFlag={setAIQualityFlag}
                  asthenopiaScore={asthenopiaScore}
                  setAsthenopiaScore={setAsthenopiaScore}
                  externalEyeFindings={externalEyeFindings}
                  setExternalEyeFindings={setExternalEyeFindings}
                  externalEyeOther={externalEyeOther}
                  setExternalEyeOther={setExternalEyeOther}
                  externalEyeScreened={externalEyeScreened}
                  setExternalEyeScreened={setExternalEyeScreened}
                  onEyePhotoCaptured={(photo) => setEyePhoto(photo)}
                  onProceedToCDSS={() => navigateToTab('cdss')}
                />
              )}

              {activeTab === 'cdss' && (
                <CDSSAndEmpathySimulator
                  childId={childId}
                  examinerId={examinerId}
                  parentalConsent={parentalConsent}
                  schoolName={schoolName}
                  schoolSector={schoolSector}
                  gradeLevel={gradeLevel}
                  ageYears={ageYears}
                  gender={gender}
                  wearsGlasses={wearsGlasses}
                  crossoverSequence={crossoverSequence}
                  paperOd={paperOd}
                  paperOs={paperOs}
                  paperTimeSec={paperTimeSec}
                  smartOd={smartOd}
                  smartOs={smartOs}
                  smartTimeSec={smartTimeSec}
                  hirschbergMM={hirschbergMM}
                  mrd1MM={mrd1MM}
                  hirschbergRecorded={hirschbergRecorded}
                  mrd1Recorded={mrd1Recorded}
                  triageOcularFlag={triageOcularFlag}
                  asthenopiaScore={asthenopiaScore}
                  referralPHCC={referralPHCC}
                  externalEyeFindings={externalEyeFindings}
                  whoPreScreen={whoPreScreen}
                  eyePhotoDataUrl={eyePhoto?.dataUrl}
                  onCommitRecord={() => { void handleCommitRecord(); }}
                  onProceedToDatabase={() => {
                    setAdminPanel(isAdminSession ? 'dashboard' : 'records');
                    setAdminOpen(true);
                  }}
                />
              )}
            </div>

            <div className="wizard-actions">
              <span className="wizard-actions__hint">
                {activeTab === 'cdss'
                  ? 'راجع النتيجة والإرشادات قبل حفظ السجل.'
                  : 'يمكنك الرجوع للخطوة السابقة دون فقدان البيانات.'}
              </span>
              <div className="wizard-actions__buttons">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  disabled={!canGoBack}
                  className="m3-btn m3-btn--outline"
                >
                  <ChevronRight size={17} aria-hidden="true" />
                  السابق
                </button>
                <button
                  type="button"
                  onClick={handleWizardNext}
                  disabled={stepNextDisabled}
                  className={`m3-btn ${activeTab === 'cdss' ? 'm3-btn--pass' : 'm3-btn--primary'}`}
                >
                  {nextLabel}
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mobile-step-actions" aria-label="التنقل بين خطوات الفحص">
              <button
                type="button"
                onClick={handleWizardBack}
                disabled={!canGoBack}
                className="m3-btn m3-btn--outline m3-btn--back"
              >
                <ChevronRight size={18} aria-hidden="true" />
                السابق
              </button>
              <button
                type="button"
                onClick={handleWizardNext}
                disabled={stepNextDisabled}
                className={`m3-btn ${activeTab === 'cdss' ? 'm3-btn--pass' : 'm3-btn--primary'}`}
              >
                {activeTab === 'cdss' ? 'حفظ الفحص' : nextLabel}
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            </div>
          </>
      </main>

      {/* ---------- Native install prompt (browser tab only) ---------- */}
      {installPrompt.visible && (
        <div className="install-banner" role="status">
          <span className="install-banner__icon" aria-hidden="true">
            <Smartphone size={19} />
          </span>
          <div className="install-banner__copy">
            <strong>📲 تثبيت التطبيق على الهاتف</strong>
            <small>
              {installPrompt.isIos
                ? 'في Safari: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».'
                : 'افتح التطبيق بملء الشاشة بدون شريط المتصفح.'}
            </small>
          </div>
          <div className="install-banner__actions">
            {!installPrompt.isIos && (
              <button
                type="button"
                className="m3-btn m3-btn--primary install-banner__btn"
                onClick={() => void installPrompt.install()}
              >
                {installPrompt.canInstall ? 'تثبيت' : 'غير متاح'}
              </button>
            )}
            {installPrompt.isIos && (
              <span className="install-banner__ios" aria-hidden="true"><Share size={16} /></span>
            )}
            <button
              type="button"
              className="install-banner__close"
              onClick={installPrompt.dismiss}
              aria-label="إخفاء رسالة التثبيت"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ---------- Native bottom tab bar (mobile) ---------- */}
      <nav className="bottom-tabs" aria-label="خطوات الفحص">
        {CLINICAL_STEPS.map((step) => {
          const StepIcon = step.icon;
          const isActive = activeTab === step.id;
          const isDone = stepCompleted[step.id];
          return (
            <button
              key={step.id}
              type="button"
              className={`bottom-tab${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              onClick={() => navigateToTab(step.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${step.num}. ${step.tabLabel}`}
            >
              <span className="bottom-tab__icon" aria-hidden="true">
                {isDone && !isActive ? <Check size={17} /> : <StepIcon size={19} />}
              </span>
              <span className="bottom-tab__label">{step.num}. {step.tabLabel}</span>
              {isActive && <span className="bottom-tab__indicator" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      {adminOpen && (
        <div className="admin-drawer-overlay" onClick={() => setAdminOpen(false)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <div className="admin-drawer__header">
              <h2>{isAdminSession ? '📊 لوحة الإدارة' : '🧰 الأدوات'}</h2>
              <button type="button" onClick={() => setAdminOpen(false)} aria-label="إغلاق">✕</button>
            </div>

            {isAdminSession ? (
              <>
                <nav className="admin-drawer__tabs">
                  <button
                    type="button"
                    onClick={() => setAdminPanel('dashboard')}
                    className={adminPanel === 'dashboard' ? 'active' : ''}
                  >
                    📊 لوحة البيانات
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOpen(false);
                      navigateToTab('protocol');
                    }}
                  >
                    🩺 وضع الفحص
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPanel('tools')}
                    className={adminPanel === 'tools' ? 'active' : ''}
                  >
                    🛠️ أدوات النظام والمعايرة
                  </button>
                </nav>
                <div className="admin-drawer__content">
                  {adminPanel === 'dashboard' && (
                    <AdminDashboard
                      records={records}
                      isLoading={isSyncing}
                      onRefresh={pullLatestFromCloud}
                    />
                  )}
                  {adminPanel === 'tools' && (
                    <div className="space-y-4">
                      <CalibrationModule calibration={calibration} onUpdateCalibration={handleUpdateCalibration} />
                      <div className="m3-card" style={{ padding: '18px' }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>🎓 تدريب الطلبة الميداني</h3>
                        <p style={{ margin: '0 0 14px', color: 'var(--m3-muted)', fontSize: '12.5px', lineHeight: 1.8 }}>
                          مركز تدريب تفاعلي: 8 وحدات مصوّرة، و7 حالات ميدانية، و12 تمرين قرار
                          يعمل بمحرك التطبيق نفسه، مع قراءة صوتية اختيارية.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsTrainingOpen(true)}
                          className="m3-btn m3-btn--primary"
                        >
                          فتح دليل التدريب التفاعلي
                        </button>
                      </div>
                      <div className="m3-card" style={{ padding: '18px' }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>📘 المنهجية والمعيار الذهبي</h3>
                        <p style={{ margin: '0 0 14px', color: 'var(--m3-muted)', fontSize: '12.5px', lineHeight: 1.8 }}>
                          مرجع البروتوكول، معايير التصنيف، وضوابط التوثيق لمتابعة الزيارة الثانية.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsMethodologyOpen(true)}
                          className="m3-btn m3-btn--primary"
                        >
                          فتح دليل المنهجية
                        </button>
                      </div>
                      <CloudSettingsPanel
                        isOnline={isOnline}
                        isSyncing={isSyncing}
                        cloudUser={cloudUser}
                        onOpenLogin={openCloudLogin}
                        onSync={() => void syncLocalRecordsToCloud()}
                        onPullLatest={() => void pullLatestFromCloud()}
                      />
                      <NurseSUSScale />
                      <details className="m3-card" style={{ padding: '18px' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '15px' }}>
                          📈 الإحصاء والتحقق (كابا · 2×2 · توثيق المرجع)
                        </summary>
                        <div style={{ marginTop: '14px' }}>
                          <MasterDatabaseAndStatistics
                            records={records}
                            onUpdateRecord={handleUpdateRecord}
                            onImportRecords={handleImportRecords}
                            onClearRecords={handleClearRecords}
                            onPullLatest={pullLatestFromCloud}
                          />
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <nav className="admin-drawer__tabs">
                  <button
                    type="button"
                    onClick={() => setAdminPanel('calib')}
                    className={adminPanel === 'calib' ? 'active' : ''}
                  >
                    📏 معايرة الشاشة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOpen(false);
                      setIsTrainingOpen(true);
                    }}
                  >
                    📘 دليل التدريب
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPanel('records')}
                    className={adminPanel === 'records' ? 'active' : ''}
                  >
                    📥 سجلاتي وتنزيلها
                  </button>
                </nav>
                <div className="admin-drawer__content">
                  {adminPanel === 'calib' && (
                    <CalibrationModule calibration={calibration} onUpdateCalibration={handleUpdateCalibration} />
                  )}
                  {adminPanel === 'records' && (
                    <ExaminerRecordsPanel
                      records={records}
                      ownerId={cloudUser?.id ?? null}
                      deviceId={examinerProfile?.deviceId ?? null}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Methodology & Gold Standard Documentation Modal */}
      <MethodologyAndGoldStandardModal
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
      />

      {/* Interactive Student Field Training & WHO 2025 Scenario Simulator */}
      <InteractiveStudentTrainingModal
        isOpen={isTrainingOpen}
        onClose={() => setIsTrainingOpen(false)}
      />

      {/* Startup authentication gate / examiner account modal */}
      <CloudAuthModal
        isOpen={cloudLoginOpen}
        isOnline={isOnline}
        isGate={authGateMode}
        onClose={handleCloseCloudLogin}
        onSignedIn={handleCloudSignedIn}
      />

      {passwordResetMode && (
        <div className="feedback-dialog-backdrop" style={{zIndex: 10000}}>
          <section className="auth-dialog auth-dialog--minimal" role="dialog" aria-modal="true">
            <header className="auth-dialog__header">
              <h2>إعادة تعيين الرمز السري</h2>
              <p>أدخل رمزاً سرياً جديداً لحسابك.</p>
            </header>
            <div className="auth-dialog__body">
              <label className="auth-field">
                <span>الرمز السري الجديد</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </label>
              {resetError && <p className="auth-dialog__error">{resetError}</p>}
              <button
                className="m3-btn m3-btn--primary m3-btn--block"
                onClick={async () => {
                  setResetError('');
                  if (newPassword.length < 6) {
                    setResetError('الرمز السري يجب أن يكون 6 أحرف على الأقل.');
                    return;
                  }
                  try {
                    const { getSupabaseClient } = await import('./utils/supabaseClient');
                    const client = getSupabaseClient();
                    if (!client) throw new Error('سحابة المشرف غير مهيأة.');
                    const { error } = await client.auth.updateUser({ password: newPassword });
                    if (error) throw error;
                    setPasswordResetMode(false);
                    setNewPassword('');
                    // Notify user
                    window.alert('تم تغيير الرمز السري بنجاح. سجّل الدخول بالرمز الجديد.');
                  } catch (err: any) {
                    setResetError(err.message || 'تعذر تغيير الرمز السري.');
                  }
                }}
              >
                حفظ الرمز السري الجديد
              </button>
              <button
                type="button"
                className="auth-dialog__skip"
                onClick={() => setPasswordResetMode(false)}
              >
                إلغاء
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="app-footer">
        <p><strong>منظومة البصر</strong> · تسجيل وفحص بصري أولي للمشروع البحثي. <a href={`${import.meta.env.BASE_URL}guide.html`} target="_blank" rel="noopener">الدليل المصور والتدريبي</a>.</p>
        <p>تُحفظ السجلات محلياً في هذا المتصفح. مخرجات النظام لا تمثل تشخيصاً طبياً ولا بديلاً عن التقييم السريري.</p>
      </footer>
    </div>
  );
}
