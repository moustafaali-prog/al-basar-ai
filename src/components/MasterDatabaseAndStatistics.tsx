import React, { useRef, useState } from 'react';
import {
  Database,
  Download,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Award,
  Activity,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  Upload,
  X,
  Save,
} from 'lucide-react';
import { StudentScreeningRecord } from '../types';
import { generateSPSS_CSV, calculateDiagnosticMetrics, hasDocumentedReference } from '../utils/acuityMath';
import { analyzeRecordMerge, createRecordBackup, parseRecordBackup } from '../utils/recordMerge';
import { useFeedback } from './FeedbackProvider';

interface DatabaseProps {
  records: StudentScreeningRecord[];
  onUpdateRecord: (updated: StudentScreeningRecord) => void;
  onImportRecords: (incoming: StudentScreeningRecord[]) => void;
  onClearRecords: () => void;
}

export const MasterDatabaseAndStatistics: React.FC<DatabaseProps> = ({
  records,
  onUpdateRecord,
  onImportRecords,
  onClearRecords,
}) => {
  const { notify, confirmAction } = useFeedback();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<string>('ALL');
  const [filterSync, setFilterSync] = useState<'ALL' | 'pending' | 'synced'>('ALL');
  const [showMatrices, setShowMatrices] = useState(false);
  const [editingGoldRecord, setEditingGoldRecord] = useState<StudentScreeningRecord | null>(null);
  const [goldStatus, setGoldStatus] = useState<'99' | '1' | '0'>('99');
  const [goldMethod, setGoldMethod] = useState('');
  const [goldExaminer, setGoldExaminer] = useState('');
  const [goldDate, setGoldDate] = useState('');
  const [goldCriteria, setGoldCriteria] = useState('');
  const [goldMasked, setGoldMasked] = useState<'YES' | 'NO' | 'UNKNOWN'>('UNKNOWN');
  // Visit-2 audit fields (one-tap selectors)
  const [followUpStatus, setFollowUpStatus] = useState<'0' | '1' | '2' | '3'>('0');
  const [spectaclesFitted, setSpectaclesFitted] = useState<'0' | '1'>('0');

  // Filtered records
  const filtered = records.filter((r) => {
    const matchSearch =
      (r.Child_ID ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.School_Name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.Examiner_ID ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchUrgency =
      filterUrgency === 'ALL' || r.Referral_Urgency === filterUrgency;
    const matchSync =
      filterSync === 'ALL' || (r._syncStatus ?? 'pending') === filterSync;
    return matchSearch && matchUrgency && matchSync;
  });

  // Calculate live statistical & diagnostic indicators
  const metrics = calculateDiagnosticMetrics(records);
  const pendingSyncCount = records.filter((r) => (r._syncStatus ?? 'pending') === 'pending').length;
  const syncedCount = records.length - pendingSyncCount;
  const referredCount = records.filter((r) => r.Final_Triage_Referral === 1 || String(r.Final_Triage_Referral) === '1').length;
  const referralRate = metrics.totalN > 0 ? Math.round((referredCount / metrics.totalN) * 100) : 0;

  // WHO (2025) Table 1 M&E indicators (Visit-2 audit)
  const formatRate = (rate: number | null) => (rate === null ? 'N/A' : `${rate.toFixed(1)}%`);
  const screeningReferralRate = metrics.totalN > 0 ? (referredCount / metrics.totalN) * 100 : null;
  const phccAttended = records.filter((r) => r.FollowUp_Status === 1);
  const phccConfirmed = phccAttended.filter((r) => r.Gold_Standard_Confirmed === 1).length;
  const phccConfirmedRate = phccAttended.length > 0 ? (phccConfirmed / phccAttended.length) * 100 : null;
  const confirmedPositive = records.filter((r) => r.Gold_Standard_Confirmed === 1).length;
  const spectaclesFittedCount = records.filter((r) => r.Spectacles_Prescribed_Fitted === 1).length;
  const spectacleFittingRate = confirmedPositive > 0 ? (spectaclesFittedCount / confirmedPositive) * 100 : null;
  const followUpDocumented = records.filter(
    (r) => r.Final_Triage_Referral === 1 && (r.FollowUp_Status === 1 || r.FollowUp_Status === 2 || r.FollowUp_Status === 3)
  );
  const trueLossCount = followUpDocumented.filter((r) => r.FollowUp_Status === 3).length;
  const referralLossRate = followUpDocumented.length > 0 ? (trueLossCount / followUpDocumented.length) * 100 : null;

  const FOLLOW_UP_LABELS: Record<number, string> = {
    0: 'غير محال',
    1: 'راجع مركز حكومي',
    2: 'راجع عيادة خاصة',
    3: 'متسرب حقيقي',
  };
  const followUpLabel = (value: number) => FOLLOW_UP_LABELS[value] ?? '—';

  const handleDownloadCSV = () => {
    if (records.length === 0) {
      notify('لا توجد سجلات لتصديرها بعد.', 'info');
      return;
    }
    const csvContent = generateSPSS_CSV(records);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AlBasar_MasterRecords_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('بدأ تنزيل ملف CSV للسجلات.', 'success');
  };

  const handleDownloadBackup = () => {
    if (!records.length) {
      notify('لا توجد سجلات لنسخها احتياطياً.', 'info');
      return;
    }
    const blob = new Blob([JSON.stringify(createRecordBackup(records), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AlBasar_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const incoming = parseRecordBackup(await file.text());
      const analysis = analyzeRecordMerge(records, incoming);
      if (analysis.conflicts.length) {
        notify(`أُلغي الدمج لوجود تعارض في معرفات: ${analysis.conflicts.slice(0, 5).join('، ')}${analysis.conflicts.length > 5 ? '…' : ''}. لم تُعدّل أي بيانات.`, 'error');
        return;
      }
      if (!analysis.additions.length) {
        notify(`لا توجد سجلات جديدة. تم التعرف على ${analysis.exactDuplicates} نسخة مطابقة.`, 'info');
        return;
      }
      const accepted = await confirmAction({
        title: 'مراجعة دمج النسخة الاحتياطية',
        message: `ستُضاف ${analysis.additions.length} سجلات جديدة، وستُتجاوز ${analysis.exactDuplicates} سجلات مطابقة. لم يظهر تعارض في معرفات المشاركين. هل تريد المتابعة؟`,
        confirmLabel: 'دمج السجلات',
      });
      if (accepted) onImportRecords(analysis.additions);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذر قراءة ملف النسخة الاحتياطية.', 'error');
    }
  };

  const openGoldEditor = (record: StudentScreeningRecord) => {
    setEditingGoldRecord(record);
    setGoldStatus(record.Gold_Standard_Confirmed === 0 || record.Gold_Standard_Confirmed === 1 ? String(record.Gold_Standard_Confirmed) as '0' | '1' : '99');
    setGoldMethod(record.Gold_Standard_Method ?? '');
    setGoldExaminer(record.Gold_Standard_Examiner_ID ?? '');
    setGoldDate(record.Gold_Standard_Date ?? '');
    setGoldCriteria(record.Gold_Standard_Criteria ?? '');
    setGoldMasked(record.Gold_Standard_Masked ?? 'UNKNOWN');
    setFollowUpStatus(
      [0, 1, 2, 3].includes(record.FollowUp_Status) ? String(record.FollowUp_Status) as '0' | '1' | '2' | '3' : '0'
    );
    setSpectaclesFitted(record.Spectacles_Prescribed_Fitted === 1 ? '1' : '0');
  };

  const handleSaveGoldStandard = () => {
    if (!editingGoldRecord) return;
    if (goldStatus !== '99' && (!goldMethod.trim() || !goldExaminer.trim() || !goldDate || !goldCriteria.trim())) {
      notify('أدخل طريقة المرجع ومعياره والفاحص وتاريخ التحقق قبل تسجيل النتيجة.', 'error');
      return;
    }
    if (goldDate && Number.isNaN(Date.parse(goldDate))) {
      notify('تحقق من تاريخ التحقق المرجعي.', 'error');
      return;
    }
    onUpdateRecord({
      ...editingGoldRecord,
      Gold_Standard_Confirmed: Number(goldStatus),
      Gold_Standard_Method: goldStatus === '99' ? '' : goldMethod.trim(),
      Gold_Standard_Examiner_ID: goldStatus === '99' ? '' : goldExaminer.trim(),
      Gold_Standard_Date: goldStatus === '99' ? '' : goldDate,
      Gold_Standard_Criteria: goldStatus === '99' ? '' : goldCriteria.trim(),
      Gold_Standard_Masked: goldStatus === '99' ? 'UNKNOWN' : goldMasked,
      FollowUp_Status: Number(followUpStatus),
      Spectacles_Prescribed_Fitted: Number(spectaclesFitted),
    });
    setEditingGoldRecord(null);
    notify('حُفظت نتيجة المرجع وحقول تدقيق الزيارة الثانية مع بيانات مصدرها.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="m3-card card-pad">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              السجل والملخص الإحصائي
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              كابا يقيس اتفاق الاختبارين عند حد WHO 2025: 6/12 (LogMAR ≥ 0.30). مؤشرات الدقة تقارن حدة البصر الرقمية وحدها بالمرجع الموثق، مع فواصل ثقة 95%.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportBackup}
            />
            <button
              onClick={handleDownloadBackup}
              className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 border border-slate-300 transition"
            >
              <Download className="w-3.5 h-3.5" />
              نسخة احتياطية JSON
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              استيراد ودمج
            </button>
            <button
              onClick={() => setShowMatrices(!showMatrices)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition border border-slate-300"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>{showMatrices ? 'إخفاء مصفوفات التوافق' : 'عرض مصفوفات التوافق 2×2'}</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير ملف CSV
            </button>

            <button
              onClick={onClearRecords}
              className="text-xs text-red-600 hover:bg-red-50 font-bold px-3 py-2 rounded-xl border border-red-200 transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح السجلات
            </button>
          </div>
        </div>

        {/* Diagnostic KPI Primary Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {/* Card 1: Sample Size & Referral Rate */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px] font-semibold mb-1">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              إجمالي العينة (N)
            </div>
            <div className="text-2xl font-black text-slate-800 font-mono">{metrics.totalN}</div>
            <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
              إشارة مراجعة من النموذج: {referralRate}% ({referredCount})
            </span>
          </div>

          {/* Card 2: Cohen's Kappa κ */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-800 text-[11px] font-semibold mb-1">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              كابا كوهين الثنائي (Cohen's κ)
            </div>
            <div className="text-2xl font-black text-blue-900 font-mono">
              {metrics.kappa !== null ? metrics.kappa.toFixed(3) : 'N/A'}
            </div>
            <span className="text-[10px] text-blue-700 font-medium block truncate mt-0.5" title={metrics.kappaInterpretation}>
              {metrics.kappaInterpretation.split('(')[0]}
            </span>
            <span className="text-[10px] text-slate-500 block">الأزواج المكتملة: {metrics.pairedN}</span>
          </div>

          {/* Card 3: Sensitivity against Gold Standard */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-800 text-[11px] font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              الحساسية مقابل المرجع
            </div>
            <div className="text-2xl font-black text-emerald-900 font-mono">
              {metrics.sensitivity !== null ? `${metrics.sensitivity}%` : 'N/A'}
            </div>
            <span className="text-[10px] text-emerald-700 block mt-0.5">
              TP/(TP+FN): {metrics.contingencySmartGold.tp}/{metrics.contingencySmartGold.tp + metrics.contingencySmartGold.fn}
            </span>
            <span className="text-[10px] text-slate-600 block">95% CI: {metrics.sensitivityCI95 ? `${metrics.sensitivityCI95[0]}–${metrics.sensitivityCI95[1]}%` : 'غير متاح'}</span>
          </div>

          {/* Card 4: Specificity against Gold Standard */}
          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-teal-800 text-[11px] font-semibold mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              النوعية مقابل المرجع
            </div>
            <div className="text-2xl font-black text-teal-900 font-mono">
              {metrics.specificity !== null ? `${metrics.specificity}%` : 'N/A'}
            </div>
            <span className="text-[10px] text-teal-700 block mt-0.5">
              TN/(TN+FP): {metrics.contingencySmartGold.tn}/{metrics.contingencySmartGold.tn + metrics.contingencySmartGold.fp}
            </span>
            <span className="text-[10px] text-slate-600 block">95% CI: {metrics.specificityCI95 ? `${metrics.specificityCI95[0]}–${metrics.specificityCI95[1]}%` : 'غير متاح'}</span>
          </div>

          {/* Card 5: Predictive Values (PPV / NPV) */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-purple-800 text-[11px] font-semibold mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              القيم التنبؤية (PPV / NPV)
            </div>
            <div className="text-sm font-black text-purple-950 font-mono pt-1">
              PPV: {metrics.ppv !== null ? `${metrics.ppv}%` : 'N/A'} ({metrics.contingencySmartGold.tp}/{metrics.contingencySmartGold.tp + metrics.contingencySmartGold.fp})
            </div>
            <div className="text-[11px] font-black text-purple-800 font-mono">
              NPV: {metrics.npv !== null ? `${metrics.npv}%` : 'N/A'} ({metrics.contingencySmartGold.tn}/{metrics.contingencySmartGold.tn + metrics.contingencySmartGold.fn})
            </div>
            <span className="text-[9px] text-purple-600 block mt-0.5">
              PPV 95% CI: {metrics.ppvCI95 ? `${metrics.ppvCI95[0]}–${metrics.ppvCI95[1]}%` : 'غير متاح'}
              <br />NPV 95% CI: {metrics.npvCI95 ? `${metrics.npvCI95[0]}–${metrics.npvCI95[1]}%` : 'غير متاح'}
              <br />دقة كلية: {metrics.accuracy !== null ? `${metrics.accuracy}%` : 'N/A'}
            </span>
          </div>

          {/* Card 6: Mean Time Saved */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-indigo-800 text-[11px] font-semibold mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              متوسط الوفر الزمني
            </div>
            <div className="text-2xl font-black text-indigo-900 font-mono">
              {metrics.meanTimeSavedSec !== null ? `${metrics.meanTimeSavedSec} ث` : 'N/A'}
            </div>
            <span className="text-[10px] text-indigo-600 block mt-0.5">
              {metrics.timedN} زوجاً زمنياً؛ الموجب يعني أن الرقمي أسرع
            </span>
          </div>
        </div>

        {/* WHO (2025) Table 1 Monitoring & Evaluation indicators (Visit-2 audit) */}
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck2 className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-emerald-900">مؤشرات الموقع الرسمية — WHO (2025) الجدول 1 · تدقيق الزيارة الثانية</h3>
          </div>
          <p className="text-[10px] text-emerald-800/80 mb-3">
            تُحدَّث مباشرة من حقول تدقيق الزيارة الثانية في محرر المرجع (حالة المتابعة، نتيجة المرجع، تجهيز النظارة).
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">1. معدل الإحالة من الفرز</div>
              <div className="text-xl font-black text-blue-900 font-mono">{formatRate(screeningReferralRate)}</div>
              <div className="text-[10px] text-slate-500 mt-1">{referredCount} محال من {metrics.totalN}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">المحالون (إشارة النموذج = 1) ÷ إجمالي المفحوصين</div>
            </div>
            <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">2. معدل التشخيص المؤكد في المركز الصحي الحكومي</div>
              <div className="text-xl font-black text-emerald-900 font-mono">{formatRate(phccConfirmedRate)}</div>
              <div className="text-[10px] text-slate-500 mt-1">{phccConfirmed} مؤكد من {phccAttended.length} مراجع</div>
              <div className="text-[9px] text-slate-400 mt-0.5">مرجع إيجابي موثق ÷ المراجعون للمركز الحكومي (حالة المتابعة = 1)</div>
            </div>
            <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">3. معدل تجهيز النظارة من مركز النظارات الحكومي</div>
              <div className="text-xl font-black text-indigo-900 font-mono">{formatRate(spectacleFittingRate)}</div>
              <div className="text-[10px] text-slate-500 mt-1">{spectaclesFittedCount} نظارة من {confirmedPositive} حالة مؤكدة</div>
              <div className="text-[9px] text-slate-400 mt-0.5">نظارة مجهزة (Spectacles = 1) ÷ الحالات المؤكدة إيجابياً (مرجع = 1)</div>
            </div>
            <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">4. معدل التسرب الحقيقي بعد شهر</div>
              <div className="text-xl font-black text-rose-900 font-mono">{formatRate(referralLossRate)}</div>
              <div className="text-[10px] text-slate-500 mt-1">{trueLossCount} متسرب من {followUpDocumented.length} موثق المتابعة</div>
              <div className="text-[9px] text-slate-400 mt-0.5">متسرب (حالة المتابعة = 3) ÷ المحالون الذين وُثّقت متابعتهم (1/2/3)</div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 -mt-3 mb-5">
          مكتمل الورقي: {metrics.paperCompleteN} • مكتمل الرقمي: {metrics.smartCompleteN} • مكتمل التحقق المرجعي الموثق: {metrics.goldEvaluatedN} ({metrics.verifiedRate ?? 0}%). لا تدخل القيم المرجعية القديمة التي تفتقد بيانات المصدر في حساب الدقة.
        </p>

        {/* Collapsible 2x2 Contingency & Diagnostic Validation Matrices */}
        {showMatrices && (
          <div className="bg-slate-900 text-white rounded-2xl p-5 mb-6 shadow-inner space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2 text-cyan-300">
                <Activity className="w-4 h-4" />
                مصفوفتا الاتفاق والتحقق المرجعي (2×2)
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                سجلات ذات نتيجة مرجعية مدخلة: {metrics.goldEvaluatedN} من أصل {metrics.totalN}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Matrix 1: Paper (6m) vs Smart Mobile (2m) */}
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700">
                <div className="flex justify-between items-center mb-2 font-bold text-slate-200">
                <span>1. الاتفاق: الورقي (6m) × الرقمي (2m)</span>
                  <span className="text-emerald-400 font-mono">κ = {metrics.kappa !== null ? metrics.kappa.toFixed(3) : 'N/A'}</span>
                </div>
                <table className="w-full text-center border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-1"></th>
                      <th className="p-1 bg-slate-800/50">إشارة بالنموذج (1)</th>
                      <th className="p-1 bg-slate-800/50">دون إشارة (0)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-700/50">
                      <td className="p-1.5 font-sans font-semibold text-slate-300 text-right">الورقي: إشارة بالنموذج (1)</td>
                      <td className="p-1.5 text-emerald-400 font-bold bg-emerald-950/30">{metrics.contingencyPaperSmart.bothRefer} (a)</td>
                      <td className="p-1.5 text-amber-300 bg-amber-950/20">{metrics.contingencyPaperSmart.paperOnly} (b)</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-sans font-semibold text-slate-300 text-right">الورقي: دون إشارة (0)</td>
                      <td className="p-1.5 text-cyan-300 bg-cyan-950/20">{metrics.contingencyPaperSmart.smartOnly} (c)</td>
                      <td className="p-1.5 text-emerald-400 font-bold bg-emerald-950/30">{metrics.contingencyPaperSmart.bothNormal} (d)</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                  <span>التطابق الملاحظ Po: {metrics.observedAgreement}%</span>
                  <span>التوافق بالصدفة Pe: {metrics.expectedAgreement}%</span>
                </div>
              </div>

              {/* Matrix 2: Smart Mobile (2m) vs Gold Standard */}
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700">
                <div className="flex justify-between items-center mb-2 font-bold text-slate-200">
                <span>2. تصنيف النموذج مقابل النتيجة المرجعية المدخلة</span>
                  <span className="text-cyan-300 font-mono">
                    Acc: {metrics.accuracy !== null ? `${metrics.accuracy}%` : '--'}
                  </span>
                </div>
                <table className="w-full text-center border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-1"></th>
                      <th className="p-1 bg-slate-800/50">المرجع: إيجابي (1)</th>
                      <th className="p-1 bg-slate-800/50">المرجع: سلبي (0)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-700/50">
                      <td className="p-1.5 font-sans font-semibold text-slate-300 text-right">إشارة النموذج: مراجعة (1)</td>
                      <td className="p-1.5 text-emerald-400 font-bold bg-emerald-950/30">{metrics.contingencySmartGold.tp} (TP)</td>
                      <td className="p-1.5 text-rose-300 bg-rose-950/20">{metrics.contingencySmartGold.fp} (FP)</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-sans font-semibold text-slate-300 text-right">إشارة النموذج: لا مراجعة (0)</td>
                      <td className="p-1.5 text-rose-300 bg-rose-950/20">{metrics.contingencySmartGold.fn} (FN)</td>
                      <td className="p-1.5 text-emerald-400 font-bold bg-emerald-950/30">{metrics.contingencySmartGold.tn} (TN)</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                  <span>حساسية: {metrics.sensitivity !== null ? `${metrics.sensitivity}%` : '--'}</span>
                  <span>نوعية: {metrics.specificity !== null ? `${metrics.specificity}%` : '--'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالكود، المدرسة، أو الفاحص..."
              className="w-full text-xs pr-9 pl-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none min-w-0 flex-1 sm:flex-none"
            >
              <option value="ALL">كافة مستويات الإحالة</option>
              <option value="MODEL_NO_FLAG">لا توجد إشارة (النموذج)</option>
              <option value="MODEL_REVIEW">مراجعة البروتوكول (النموذج)</option>
              <option value="MODEL_PRIORITY">أولوية أعلى (النموذج)</option>
              <option value="ROUTINE">سجل سابق: ROUTINE</option>
              <option value="PHCC_2WEEKS">سجل سابق: PHCC_2WEEKS</option>
              <option value="URGENT_48H">سجل سابق: URGENT_48H</option>
            </select>
            <select
              value={filterSync}
              onChange={(e) => setFilterSync(e.target.value as 'ALL' | 'pending' | 'synced')}
              className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none min-w-0 flex-1 sm:flex-none"
              aria-label="تصفية حسب حالة المزامنة"
            >
              <option value="ALL">كل حالات المزامنة</option>
              <option value="pending">بانتظار المزامنة</option>
              <option value="synced">تمت مزامنتها</option>
            </select>
          </div>
        </div>

        {/* Master Data Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold">كود التلميذ</th>
                  <th className="py-2.5 px-3 font-bold">المزامنة</th>
                  <th className="py-2.5 px-3 font-bold">الفاحص</th>
                  <th className="py-2.5 px-3 font-bold">الموافقة</th>
                  <th className="py-2.5 px-3 font-bold">التسلسل</th>
                  <th className="py-2.5 px-3 font-bold">ورقي (OD/OS)</th>
                  <th className="py-2.5 px-3 font-bold">زمن الورقي</th>
                  <th className="py-2.5 px-3 font-bold">رقمي (OD/OS)</th>
                  <th className="py-2.5 px-3 font-bold">تفاوت IOD</th>
                  <th className="py-2.5 px-3 font-bold">زمن الرقمي</th>
                  <th className="py-2.5 px-3 font-bold">الحول (Δ)</th>
                  <th className="py-2.5 px-3 font-bold">إشارة النموذج</th>
                  <th className="py-2.5 px-3 font-bold">متابعة الزيارة 2</th>
                  <th className="py-2.5 px-3 font-bold">نتيجة التحقق المرجعي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-center text-slate-400 font-sans">
                      لا توجد سجلات مطابقة للبحث حالياً.
                    </td>
                  </tr>
                ) : (
                  filtered.map((record) => (
                    <tr key={record.Child_ID} className="hover:bg-blue-50/40 transition">
                      <td className="py-2 px-3 font-bold text-blue-900">{record.Child_ID}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                            (record._syncStatus ?? 'pending') === 'synced'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                          title={(record._syncStatus ?? 'pending') === 'synced' ? 'تمت المزامنة مع سحابة المشرف' : 'بانتظار المزامنة'}
                        >
                          {(record._syncStatus ?? 'pending') === 'synced' ? '☁️ تمت' : '⏳ بانتظار'}
                        </span>
                      </td>
                      <td className="py-2 px-3">{record.Examiner_ID}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                            record.Parental_Consent === 1
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {record.Parental_Consent === 1 ? 'موقعة' : 'مرفوضة'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans text-[11px] text-slate-500">
                        {record.Crossover_Sequence.includes('ورقي') ? 'ورقي←رقمي' : 'رقمي←ورقي'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {record.Paper_Snellen_OD} / {record.Paper_Snellen_OS}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{record.Paper_Time_Sec} ث</td>
                      <td className="py-2 px-3 font-bold text-blue-800">
                        {record.Smart_Snellen_OD} / {record.Smart_Snellen_OS}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={
                            record.Smart_IOD_LogMAR >= 0.20 ? 'text-amber-600 font-bold' : ''
                          }
                        >
                          {record.Smart_IOD_LogMAR.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-emerald-700 font-bold">
                        {record.Smart_Time_Sec} ث
                      </td>
                      <td className="py-2 px-3">
                        {record.Hirschberg_Prism_Diopters}Δ
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                            record.Final_Triage_Referral === 1
                              ? record.Referral_Urgency === 'URGENT_48H' || record.Referral_Urgency === 'MODEL_PRIORITY'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {record.Final_Triage_Referral === 1 ? 'مراجعة (1)' : 'لا إشارة (0)'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            record.FollowUp_Status === 3
                              ? 'bg-rose-100 text-rose-800'
                              : record.FollowUp_Status === 1 || record.FollowUp_Status === 2
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {followUpLabel(record.FollowUp_Status)}
                          {record.Spectacles_Prescribed_Fitted === 1 ? ' 👓' : ''}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <button
                          onClick={() => openGoldEditor(record)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border transition ${
                            record.Gold_Standard_Confirmed === 1
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : record.Gold_Standard_Confirmed === 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="أدخل حقول تدقيق الزيارة الثانية والنتيجة المرجعية مع طريقة الفحص ومعياره والفاحص والتاريخ وحالة التعمية"
                        >
                          {record.Gold_Standard_Confirmed === 1 && (hasDocumentedReference(record) ? 'إيجابي موثق' : 'إيجابي قديم؛ بيانات المرجع ناقصة')}
                          {record.Gold_Standard_Confirmed === 0 && (hasDocumentedReference(record) ? 'سلبي موثق' : 'سلبي قديم؛ بيانات المرجع ناقصة')}
                          {(record.Gold_Standard_Confirmed === undefined ||
                            record.Gold_Standard_Confirmed === 99) &&
                            'غير متحقق (99) — إدخال التفاصيل'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <span>ملف CSV مرمّز بـ UTF-8 (BOM)؛ راجع قاموس المتغيرات وإعدادات الاستيراد قبل التحليل.</span>
          <span className="flex flex-wrap items-center justify-center gap-3">
            <span>إجمالي السجلات: {records.length}</span>
            <span className="text-amber-700">⏳ بانتظار المزامنة: {pendingSyncCount}</span>
            <span className="text-emerald-700">☁️ تمت مزامنتها: {syncedCount}</span>
          </span>
        </div>
      </div>

      {editingGoldRecord && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gold-standard-title"
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h3 id="gold-standard-title" className="text-base font-bold text-slate-900">تدقيق الزيارة الثانية وتوثيق المرجع التشخيصي</h3>
                <p className="mt-1 text-xs text-slate-600">المشارك: <span className="font-mono font-bold">{editingGoldRecord.Child_ID}</span>. سجّل حقول الزيارة الثانية بأزرار الاختيار السريع، ثم وثّق المرجع ببيانات البروتوكول المعتمد؛ لا يُفترض معيار تلقائي.</p>
              </div>
              <button type="button" onClick={() => setEditingGoldRecord(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <fieldset className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <legend className="px-1 text-xs font-bold text-emerald-900">حقول تدقيق الزيارة الثانية (أزرار سريعة)</legend>

                <span className="block text-xs font-bold text-slate-700 mb-1.5">حالة المتابعة بعد الإحالة (FollowUp_Status)</span>
                <div className="grid grid-cols-2 gap-2 mb-3" role="group" aria-label="حالة المتابعة">
                  {([
                    { value: '0', label: '0 · غير محال' },
                    { value: '1', label: '1 · راجع المركز الصحي الحكومي' },
                    { value: '2', label: '2 · راجع عيادة خاصة' },
                    { value: '3', label: '3 · متسرب حقيقي بعد شهر' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={followUpStatus === option.value}
                      onClick={() => setFollowUpStatus(option.value)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                        followUpStatus === option.value
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <span className="block text-xs font-bold text-slate-700 mb-1.5">نتيجة المرجع (Gold_Standard_Confirmed)</span>
                <div className="grid grid-cols-3 gap-2 mb-3" role="group" aria-label="نتيجة المرجع">
                  {([
                    { value: '99', label: '99 · لم يُجرَ' },
                    { value: '1', label: '1 · إيجابي' },
                    { value: '0', label: '0 · سلبي' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={goldStatus === option.value}
                      onClick={() => setGoldStatus(option.value)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                        goldStatus === option.value
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <span className="block text-xs font-bold text-slate-700 mb-1.5">تجهيز النظارة من المركز الحكومي (Spectacles_Prescribed_Fitted)</span>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="تجهيز النظارة">
                  {([
                    { value: '0', label: '0 · لم يستلم نظارة' },
                    { value: '1', label: '1 · تم وصف وتجهيز النظارة من المركز الحكومي' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={spectaclesFitted === option.value}
                      onClick={() => setSpectaclesFitted(option.value)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                        spectaclesFitted === option.value
                          ? 'border-indigo-700 bg-indigo-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {goldStatus !== '99' && (
                <>
                  <label className="block text-xs font-bold text-slate-700">طريقة الفحص المرجعي *
                    <input value={goldMethod} onChange={(event) => setGoldMethod(event.target.value)} maxLength={300} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="اكتب الطريقة كما وردت في البروتوكول" />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-700">معرف فاحص المرجع *
                      <input value={goldExaminer} onChange={(event) => setGoldExaminer(event.target.value)} maxLength={64} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono" />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">تاريخ التحقق *
                      <input type="date" value={goldDate} onChange={(event) => setGoldDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                  </div>
                  <label className="block text-xs font-bold text-slate-700">معيار تصنيف الحالة من البروتوكول *
                    <textarea value={goldCriteria} onChange={(event) => setGoldCriteria(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="دوّن المعيار المعتمد دون إنشاء عتبة جديدة" />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">هل كان فاحص المرجع محجوباً عن نتائج الفحص؟
                    <select value={goldMasked} onChange={(event) => setGoldMasked(event.target.value as 'YES' | 'NO' | 'UNKNOWN')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                      <option value="YES">نعم</option>
                      <option value="NO">لا</option>
                      <option value="UNKNOWN">غير معروف / غير موثق</option>
                    </select>
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setEditingGoldRecord(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">إلغاء</button>
              <button type="button" onClick={handleSaveGoldStandard} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800">
                <Save size={15} /> حفظ التوثيق
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
