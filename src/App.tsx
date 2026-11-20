/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserRound,
  Wifi,
  WifiOff,
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
import type { CloudAuthUser } from './utils/supabaseAuth';

type ClinicalStepId = 'protocol' | 'acuity' | 'biometry' | 'cdss';
type ActiveTab = ClinicalStepId;
type ChartMode = 'HOTV' | 'TUMBLING_E';

const CLINICAL_STEPS = [
  {
    id: 'protocol',
    num: 1,
    label: 'التلميذ',
    meta: 'التعريف والموافقة',
    description: 'سجّل هوية التلميذ وموافقة ولي الأمر، ثم أكمل أسئلة الفرز الأولي.',
    icon: UserCheck,
  },
  {
    id: 'acuity',
    num: 2,
    label: 'النظر',
    meta: 'لوحة العينين',
    description: 'اعرض الرموز على مسافة الفحص وسجّل استجابة كل عين على حدة.',
    icon: Eye,
  },
  {
    id: 'biometry',
    num: 3,
    label: 'صورة العين',
    meta: 'المنعكس والجفن',
    description: 'التقط صورة العينين، وراجع مؤشرات المحاذاة وعلامات العين الخارجية.',
    icon: Camera,
  },
  {
    id: 'cdss',
    num: 4,
    label: 'النتيجة',
    meta: 'الإحالة والبطاقة',
    description: 'راجع خلاصة الفرز، وسلّم إرشادات ولي الأمر، ثم احفظ الفحص.',
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
  const [adminPanel, setAdminPanel] = useState<'calib'|'database'|'sus'|'method'|'training'|'cloud'>('calib');

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
  const [crossoverSequence, setCrossoverSequence] = useState('ورقي (6m) ← رقمي (2m)');
  const [whoPreScreen, setWHOPreScreen] = useState<WHOPreScreenDraft>(EMPTY_WHO_PRE_SCREEN);
  const [paperExaminerId, setPaperExaminerId] = useState(INITIAL_SESSION_CONTEXT.paperExaminerId);
  const [smartExaminerId, setSmartExaminerId] = useState(INITIAL_SESSION_CONTEXT.smartExaminerId);
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
  const pendingCloudSync = useRef(false);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

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
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const timer = window.setTimeout(async () => {
      try {
        const { loadCloudAuthUser, subscribeToCloudAuth } = await import('./utils/supabaseAuth');
        const user = await loadCloudAuthUser();
        if (cancelled) return;
        setCloudUser(user);
        unsubscribe = await subscribeToCloudAuth((u) => {
          if (!cancelled) setCloudUser(u);
        });
        if (cancelled) unsubscribe?.();
      } catch {
        // Offline-first: ignore cloud session restoration errors.
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setLastClinicalTab(activeTab);
  }, [activeTab]);

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
      gradeLevel,
    });
  }, [
    schoolName,
    schoolSector,
    referralPHCC,
    examinerId,
    paperExaminerId,
    smartExaminerId,
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

  const syncLocalRecordsToCloud = async () => {
    if (!isOnline) {
      notify('وضع العمل بدون إنترنت. المزامنة متاحة عند الاتصال.', 'info');
      return;
    }
    if (!isSupabaseConfigured()) {
      notify('سحابة المشرف غير مُعدة. سجّل VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.', 'info');
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
        notify('لا توجد سجلات بانتظار المزامنة.', 'success');
        setIsSyncing(false);
        return;
      }
      let syncedCount = 0;
      const syncedIds = new Set<string>();
      const droppedColumns = new Set<string>();
      let lastError = '';

      for (const rec of pending) {
        // Photo handling: if local data URL exists, compress & upload then store public URL
        if (rec.Eye_Photo_URL && rec.Eye_Photo_URL.startsWith('data:')) {
          try {
            const { compressImageToBlob, photoFileName } = await import('./utils/imageCompress');
            const { loadCloudAuthUser } = await import('./utils/supabaseAuth');
            const user = await loadCloudAuthUser();
            const userId = user?.id ?? 'anon';
            const blob = await compressImageToBlob(rec.Eye_Photo_URL, 1024, 0.7);
            const path = photoFileName(userId, rec.Child_ID);
            const { error: upErr } = await client.storage.from('screening-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
            if (!upErr) {
              const { data } = client.storage.from('screening-photos').getPublicUrl(path);
              rec.Eye_Photo_URL = data.publicUrl;
            } else {
              console.warn('Photo upload failed', upErr);
            }
          } catch (e) {
            console.warn('Photo compress/upload skipped', e);
          }
        }

        try {
          const diag = await upsertScreeningRecord(rec);
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
        notify(
          `تمت مزامنة ${syncedCount} سجل مع سحابة المشرف.${failedCount > 0 ? ` تعذر مزامنة ${failedCount} سجل: ${lastError}` : ''}${droppedNote}`,
          failedCount > 0 || droppedColumns.size > 0 ? 'info' : 'success'
        );
      } else {
        notify(`فشلت المزامنة: ${lastError || 'تحقق من الاتصال وإعدادات Supabase.'}`, 'error');
      }
    } catch (e) {
      console.error(e);
      notify(`خطأ أثناء المزامنة: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

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
    pendingCloudSync.current = false;
    setCloudLoginOpen(true);
  };

  const handleCloudSignedIn = (user: CloudAuthUser) => {
    setCloudUser(user);
    setCloudLoginOpen(false);
    notify('تم تسجيل الدخول إلى سحابة المشرف.', 'success');
    if (pendingCloudSync.current) {
      pendingCloudSync.current = false;
      void syncLocalRecordsToCloud();
    }
  };

  const handleCloudSignOut = async () => {
    const accepted = await confirmAction({
      title: 'تسجيل الخروج من السحابة؟',
      message: 'ستبقى جميع السجلات محفوظة محلياً على هذا الجهاز. المزامنة السحابية تتطلب تسجيل الدخول مرة أخرى.',
      confirmLabel: 'تسجيل الخروج',
    });
    if (!accepted) return;
    try {
      const { signOutOfCloud } = await import('./utils/supabaseAuth');
      await signOutOfCloud();
    } catch {
      // حتى إذا فشل طلب الشبكة، نُمسح الجلسة محلياً
    }
    setCloudUser(null);
    notify('تم تسجيل الخروج من السحابة. الفحص المحلي مستمر.', 'info');
  };

  const generateNextId = (sourceRecords: StudentScreeningRecord[] = records) => {
    // Sequential protocol IDs (BAB-101, BAB-102, ...) derived from the saved
    // records; crossover is auto-counterbalanced by ID parity (SPIRIT Item 16).
    const nextId = generateParticipantId(sourceRecords.map((record) => record.Child_ID));
    const nextNumber = extractParticipantNumber(nextId) ?? 0;
    setChildId(nextId);
    setCrossoverSequence(crossoverSequenceForParticipantNumber(nextNumber || 1));
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
  };

  // Typing (or QR-scanning) a BAB-xxx code re-assigns the counterbalanced
  // crossover sequence from the numeric ID parity (SPIRIT Item 16).
  const handleChildIdChange = (id: string) => {
    setChildId(id);
    const number = extractParticipantNumber(id);
    if (number !== null) {
      setCrossoverSequence(crossoverSequenceForParticipantNumber(number));
    }
  };

  const handleCommitRecord = () => {
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
      asthenopiaScore
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
    setRecords(updated);

    notify(`حُفظ فحص التلميذ ${newRecord.Child_ID}. بدأ سجل تلميذ جديد.`, 'success');
    generateNextId(updated);
    setActiveTab('protocol');
  };

  const paperFirstSequence = 'ورقي (6m) ← رقمي (2m)';
  const digitalFirstSequence = 'رقمي (2m) ← ورقي (6m)';
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

  const proceedFromRegistration = () => {
    if (!registrationReady) {
      notify('أكمل الموافقة وبيانات المشارك والتسلسل المحدد قبل بدء المحطة الأولى.', 'error');
      return;
    }
    if (isDigitalFirst && !smartCompletedAt) {
      setActiveTab('acuity');
      return;
    }
    if (!paperStartedAt || !paperOd.trim() || !paperOs.trim()) {
      notify('ابدأ مؤقت الفحص الورقي وأدخل نتيجتي العينين قبل متابعة المسار.', 'error');
      return;
    }
    setPaperCompletedAt(new Date().toISOString());
    setActiveTab(isDigitalFirst ? 'biometry' : 'acuity');
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
        body: 'اضغط «كود تلقائي» أو امسح QR، ثم عبّئ الصف والعمر بلمسة واحدة. بيانات الجلسة ستبقى جاهزة للتلميذ التالي.',
      };
    }

    if (activeTab === 'protocol') {
      if (isDigitalFirst && !smartCompletedAt) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — المسار ${sequence}`,
          body: 'أكّد الموافقة والتعبئة السريعة، ثم انتقل إلى الفحص الرقمي (2م). لا تفتح اللوحة الورقية أولاً.',
        };
      }
      if (isDigitalFirst && smartCompletedAt && !paperCompletedAt) {
        return {
          tone: 'warn',
          title: `الخطوة الحالية: ${participant} — أكمل المحطة الورقية`,
          body: 'انتهى الفحص الرقمي المستقل. ابدأ الآن مؤقت المحطة الورقية، وسجّل OD ثم OS، ثم اضغط متابعة إلى فحص العين.',
        };
      }
      if (!paperCompletedAt) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — المسار ${sequence}`,
          body: 'ابدأ مؤقت المحطة الورقية، وسجّل العين اليمنى OD ثم اليسرى OS بلمسة واحدة، ثم انتقل إلى الفحص الذكي.',
        };
      }
      return {
        tone: 'pass',
        title: `الخطوة الحالية: ${participant} — المحطة الورقية مكتملة`,
        body: 'اضغط «متابعة إلى فحص البصر» لبدء القياس الرقمي المستقل.',
      };
    }

    if (activeTab === 'acuity') {
      if (!smartOd.trim()) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — العين اليمنى OD`,
          body: 'اعرض الرمز المناسب للصف، وسجّل استجابة الطفل. استخدم ملء الشاشة، أو اسحب على المسرح للاتجاه، أو أزرار الرد الكبيرة.',
        };
      }
      if (!smartOs.trim()) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — العين اليسرى OS`,
          body: 'أكمل العين اليسرى بنفس طريقة العين اليمنى. لا ترجع إلى نتيجة المحطة الورقية أثناء القياس.',
        };
      }
      if (!paperCompletedAt) {
        return {
          tone: 'warn',
          title: `الخطوة الحالية: ${participant} — عد للمحطة الورقية`,
          body: 'سُجّل الفحص الرقمي. ارجع إلى الخطوة 1 لإكمال المحطة الورقية المتبقية ثم تابع.',
        };
      }
      return {
        tone: 'pass',
        title: `الخطوة الحالية: ${participant} — اكتمل فحص النظر`,
        body: 'اضغط «متابعة إلى فحص العين» لالتقاط صورة العينين وتوثيق القياسات.',
      };
    }

    if (activeTab === 'biometry') {
      if (!hirschbergRecorded || !mrd1Recorded) {
        return {
          tone: 'primary',
          title: `الخطوة الحالية: ${participant} — صورة العين والقياسات`,
          body: 'افتح الكاميرا والتقط صورة، أو المس إحدى التوصيات السريرية الثلاث. سيُعتبر القياس مسجلاً تلقائياً بعد اللمس.',
        };
      }
      if (!externalEyeScreened) {
        return {
          tone: 'warn',
          title: `الخطوة الحالية: ${participant} — تأكيد العين الخارجية`,
          body: 'اضغط «العين الخارجية سليمة» إذا لم توجد قشور أو إفرازات أو احمرار أو عتامة، ثم اعرض النتيجة.',
        };
      }
      return {
        tone: 'pass',
        title: `الخطوة الحالية: ${participant} — جاهز للنتيجة`,
        body: 'راجع القياسات، ثم اضغط «عرض النتيجة والحفظ» للانتقال إلى بطاقة ولي الأمر.',
      };
    }

    return {
      tone: 'pass',
      title: `الخطوة الحالية: ${participant} — النتيجة والحفظ`,
      body: 'راجع النتيجة وبطاقة السبورة، حمّل البطاقة للأم عند الحاجة، ثم اضغط «حفظ السجل والانتقال للتلميذ التالي».',
    };
  })();

  return (
    <div className="app-shell" dir="rtl">
      <a href="#main-content" className="skip-link">تخطي إلى محتوى المحطة</a>

      <header className="topbar">
        <div className="topbar__inner" dir="rtl">
          <div className="brand">
            <div className="brand__mark"><Eye size={23} aria-hidden="true" /></div>
            <div className="brand__copy">
              <h1 className="brand__title">البصر <span>Al-Basar</span></h1>
            </div>
          </div>
          <div className="topbar__actions">
            <button
              type="button"
              onClick={() => setIsTrainingOpen(true)}
              className="topbar__quick topbar__quick--accent training-toggle"
              aria-label="فتح دليل تدريب الطلبة التفاعلي"
            >
              <span aria-hidden="true">🎓</span>
              <span className="topbar__quick-label">دليل تدريب الطلبة التفاعلي</span>
              <span className="topbar__quick-label topbar__quick-label--short">دليل التدريب</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="topbar__quick admin-toggle"
              aria-label="لوحة المشرف والبيانات"
            >
              <span aria-hidden="true">⚙️</span>
              <span className="topbar__quick-label topbar__quick-label--admin">لوحة المشرف والبيانات</span>
            </button>
            <button
              type="button"
              onClick={() => setCloudLoginOpen(true)}
              className="topbar__quick topbar__quick--cloud"
              aria-label="تسجيل الدخول والمزامنة السحابية"
            >
              <span aria-hidden="true">☁️</span>
              <span className="topbar__quick-label">تسجيل الدخول / المزامنة</span>
              <span className="topbar__quick-label topbar__quick-label--short">السحابة</span>
            </button>
          </div>
        </div>

        <div className="sync-status-bar" dir="rtl">
          <div className="sync-status-bar__inner">
            <div className="sync-status-bar__net">
              {isOnline ? (
                <span className="sync-status__pill sync-status__pill--online">
                  <Wifi size={16} aria-hidden="true" />
                  <span>🟢 متصل بالإنترنت</span>
                  <span className="sync-status__sub">
                    {cloudUser ? ' - متصل بـ Supabase' : ' - غير مسجل الدخول — اضغط هنا لتسجيل الدخول ومزامنة السجلات '}
                    {!cloudUser && (
                      <button type="button" className="sync-status__link" onClick={() => setCloudLoginOpen(true)} style={{background:'none',border:'none',color:'var(--m3-primary)',cursor:'pointer',padding:0}}>
                        [فتح نافذة تسجيل الدخول والمزامنة]
                      </button>
                    )}
                  </span>
                </span>
              ) : (
                <span className="sync-status__pill sync-status__pill--offline">
                  <WifiOff size={16} aria-hidden="true" />
                  <span>🔴 وضع العمل بدون إنترنت</span>
                </span>
              )}
            </div>
            <div className="sync-status-bar__actions">
              {cloudUser ? (
                <span className="sync-status__account">
                  <span className="sync-status__account-icon" aria-hidden="true">
                    <UserRound size={15} />
                  </span>
                  <span className="sync-status__account-email" title={cloudUser.email ?? ''}>
                    {cloudUser.email}
                  </span>
                  <button
                    type="button"
                    className="sync-status__signout"
                    onClick={handleCloudSignOut}
                    aria-label="تسجيل الخروج من سحابة المشرف"
                  >
                    <LogOut size={15} aria-hidden="true" />
                    <span>خروج</span>
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="sync-status__login"
                  onClick={() => setCloudLoginOpen(true)}
                >
                  <LogIn size={15} aria-hidden="true" />
                  <span>دخول الفاحص</span>
                </button>
              )}
              <button
                type="button"
                className="sync-status__btn"
                onClick={syncLocalRecordsToCloud}
                disabled={!isOnline || isSyncing}
                aria-busy={isSyncing}
              >
                <RefreshCw size={16} className={isSyncing ? 'spin' : ''} aria-hidden="true" />
                <span>{isSyncing ? 'جاري المزامنة…' : '🔄 مزامنة السجلات مع سحابة المشرف'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {isSupabaseConfigured() && isOnline && !cloudUser && showCloudBanner && (
        <div className="cloud-banner" dir="rtl">
          <span>☁️ لمزامنة سجلات الفحص تلقائياً مع قاعدة بيانات المشرف، اضغط هنا لتسجيل الدخول أو تفعيل المزامنة السحابية (أو تابع العمل أوفلاين محلياً).</span>
          <div className="cloud-banner__actions">
            <button className="m3-btn m3-btn--primary m3-btn--sm" onClick={() => { setCloudLoginOpen(true); setShowCloudBanner(false); }}>
              تسجيل الدخول
            </button>
            <button className="m3-btn m3-btn--ghost m3-btn--sm" onClick={() => setShowCloudBanner(false)}>إخفاء</button>
          </div>
        </div>
      )}

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

      <main className={`app-main${activeTab === 'acuity' ? ' app-main--acuity' : ''}`} id="main-content">
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
                  onPaperTestStarted={() => {
                    setPaperExaminerId((current) => current || examinerId || 'PAPER-EXAMINER');
                    setPaperStartedAt(new Date().toISOString());
                    setPaperCompletedAt('');
                  }}
                  showPaperStation={!isDigitalFirst || Boolean(smartCompletedAt)}
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
                  onCommitRecord={handleCommitRecord}
                  onProceedToDatabase={() => { setAdminPanel('database'); setAdminOpen(true); }}
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

      {adminOpen && (
        <div className="admin-drawer-overlay" onClick={() => setAdminOpen(false)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <div className="admin-drawer__header">
              <h2>لوحة المشرف والبيانات</h2>
              <button type="button" onClick={() => setAdminOpen(false)} aria-label="إغلاق">✕</button>
            </div>
            <nav className="admin-drawer__tabs">
              <button type="button" onClick={() => setAdminPanel('calib')} className={adminPanel === 'calib' ? 'active' : ''}>المعايرة</button>
              <button type="button" onClick={() => setAdminPanel('database')} className={adminPanel === 'database' ? 'active' : ''}>السجلات والإحصاء</button>
              <button type="button" onClick={() => setAdminPanel('sus')} className={adminPanel === 'sus' ? 'active' : ''}>تقييم التطبيق</button>
              <button type="button" onClick={() => setAdminPanel('method')} className={adminPanel === 'method' ? 'active' : ''}>المنهجية والدليل</button>
              <button type="button" onClick={() => setAdminPanel('training')} className={adminPanel === 'training' ? 'active' : ''}>🎓 تدريب الطلبة</button>
              <button type="button" onClick={() => { setAdminPanel('cloud'); setCloudLoginOpen(true); }} className={adminPanel === 'cloud' ? 'active' : ''}>☁️ السحابة والمزامنة</button>
            </nav>
            <div className="admin-drawer__content">
              {adminPanel === 'calib' && (
                <CalibrationModule calibration={calibration} onUpdateCalibration={handleUpdateCalibration} />
              )}
              {adminPanel === 'database' && (
                <MasterDatabaseAndStatistics
                  records={records}
                  onUpdateRecord={handleUpdateRecord}
                  onImportRecords={handleImportRecords}
                  onClearRecords={handleClearRecords}
                  onPullLatest={pullLatestFromCloud}
                />
              )}
              {adminPanel === 'sus' && <NurseSUSScale />}
              {adminPanel === 'method' && (
                <div className="admin-method">
                  <button type="button" onClick={() => setIsMethodologyOpen(true)} className="m3-btn m3-btn--primary">فتح دليل المنهجية والمعيار الذهبي</button>
                  <p style={{marginTop:'12px'}}>يمكنك أيضاً تحميل نسخة مستقلة من الدليل.</p>
                </div>
              )}
              {adminPanel === 'cloud' && (
                <div className="admin-method">
                  <div className="m3-card" style={{ padding: '18px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>☁️ السحابة والمزامنة</h3>
                    <p style={{ margin: '0 0 14px', color: 'var(--m3-muted)', fontSize: '12.5px', lineHeight: 1.8 }}>
                      الحالة: {cloudUser ? `متصل بـ Supabase (${cloudUser.email})` : 'غير مسجل الدخول — يمكنك المزامنة باستخدام مفتاح anon العام أو تسجيل الدخول.'}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={openCloudLogin} className="m3-btn m3-btn--primary">
                        فتح نافذة تسجيل الدخول والمزامنة
                      </button>
                      <button type="button" onClick={syncLocalRecordsToCloud} className="m3-btn" disabled={!isOnline || isSyncing}>
                        {isSyncing ? 'جاري المزامنة…' : '🔄 مزامنة الآن'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {adminPanel === 'training' && (
                <div className="admin-method">
                  <div className="m3-card" style={{ padding: '18px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>🎓 تدريب الطلبة الميداني</h3>
                    <p style={{ margin: '0 0 14px', color: 'var(--m3-muted)', fontSize: '12.5px', lineHeight: 1.8 }}>
                      محاكي تفاعلي بصوت د. مصطفى علي غازي الشمري: ست محطات مصوّرة، وخمس حالات
                      واقعية حسب منظمة الصحة العالمية 2025، ووضع اختبار للحل قبل كشفه.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsTrainingOpen(true)}
                      className="m3-btn m3-btn--primary"
                    >
                      فتح دليل التدريب التفاعلي
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {/* Cloud examiner sign-in, required only for syncing records */}
      <CloudAuthModal
        isOpen={cloudLoginOpen}
        isOnline={isOnline}
        onClose={() => { setCloudLoginOpen(false); pendingCloudSync.current = false; }}
        onSignedIn={handleCloudSignedIn}
        onContinueWithoutAccount={() => {
          setCloudLoginOpen(false);
          pendingCloudSync.current = false;
          notify('تم تفعيل المزامنة السريعة باستخدام مفتاح anon العام. لا حاجة لبريد إلكتروني.', 'info');
          void syncLocalRecordsToCloud();
        }}
      />

      <footer className="app-footer">
        <p><strong>منظومة البصر</strong> · تسجيل وفحص بصري أولي للمشروع البحثي. <a href={`${import.meta.env.BASE_URL}guide.html`} target="_blank" rel="noopener">الدليل المصور والتدريبي</a>.</p>
        <p>تُحفظ السجلات محلياً في هذا المتصفح. مخرجات النظام لا تمثل تشخيصاً طبياً ولا بديلاً عن التقييم السريري.</p>
      </footer>
    </div>
  );
}
