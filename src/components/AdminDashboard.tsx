import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Eye,
  Filter,
  ImageOff,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';

import type { StudentScreeningRecord } from '../types';
import { generateSPSS_CSV } from '../utils/acuityMath';
import { useFeedback } from './FeedbackProvider';

interface AdminDashboardProps {
  /** Every row the current (admin) session is allowed to read. */
  records: StudentScreeningRecord[];
  /** True while the live pull from Supabase is in flight. */
  isLoading?: boolean;
  /** Re-pull the whole dataset from Supabase. */
  onRefresh?: () => Promise<void> | void;
}

type PhotoMap = Record<string, string | null>;

const URGENCY_LABELS: Record<string, string> = {
  MODEL_NO_FLAG: 'لا توجد إشارة',
  MODEL_REVIEW: 'مراجعة البروتوكول',
  MODEL_PRIORITY: 'أولوية أعلى',
  ROUTINE: 'متابعة روتينية',
  PHCC_2WEEKS: 'خلال أسبوعين',
  URGENT_48H: 'خلال 48 ساعة',
};

/** Referral urgency that counts as "urgent" for the KPI strip. */
const isUrgent = (record: StudentScreeningRecord): boolean =>
  record.Referral_Urgency === 'URGENT_48H' ||
  record.Referral_Urgency === 'MODEL_PRIORITY';

/**
 * Live supervisor dashboard.
 *
 * Everything shown here is scoped by PostgreSQL RLS: an admin session reads
 * every row, an examiner session only its own. Eye images are resolved
 * through short-lived signed URLs because the `screening-photos` bucket is
 * private (IRB).
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  records,
  isLoading = false,
  onRefresh,
}) => {
  const { notify } = useFeedback();
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  const [examinerFilter, setExaminerFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [photoUrls, setPhotoUrls] = useState<PhotoMap>({});
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const schools = useMemo(
    () => Array.from(new Set(records.map((r) => (r.School_Name ?? '').trim()).filter(Boolean))).sort(),
    [records],
  );
  const examiners = useMemo(
    () => Array.from(new Set(records.map((r) => (r.Examiner_Full_Name || r.Examiner_ID || '').trim()).filter(Boolean))).sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        const needle = searchTerm.trim().toLowerCase();
        const matchSearch =
          !needle ||
          (r.Child_ID ?? '').toLowerCase().includes(needle) ||
          (r.School_Name ?? '').toLowerCase().includes(needle) ||
          (r.Examiner_ID ?? '').toLowerCase().includes(needle) ||
          (r.Examiner_Full_Name ?? '').toLowerCase().includes(needle);
        const matchSchool = schoolFilter === 'ALL' || (r.School_Name ?? '') === schoolFilter;
        const examinerLabel = (r.Examiner_Full_Name || r.Examiner_ID || '').trim();
        const matchExaminer = examinerFilter === 'ALL' || examinerLabel === examinerFilter;
        const matchUrgency =
          urgencyFilter === 'ALL' ||
          (urgencyFilter === 'REFERRED'
            ? r.Final_Triage_Referral === 1
            : r.Referral_Urgency === urgencyFilter);
        return matchSearch && matchSchool && matchExaminer && matchUrgency;
      }),
    [records, searchTerm, schoolFilter, examinerFilter, urgencyFilter],
  );

  const totalStudents = records.length;
  const examinerCount = new Set(
    records.map((r) => (r.Examiner_Full_Name || r.Examiner_ID || '').trim()).filter(Boolean),
  ).size;
  const urgentCount = records.filter(isUrgent).length;

  /**
   * Resolve the private-bucket image paths into short-lived signed URLs.
   * Only the rows currently visible in the table are resolved, so opening the
   * dashboard never issues hundreds of storage requests.
   */
  useEffect(() => {
    let cancelled = false;
    const paths = filtered
      .map((r) => (r.Eye_Photo_URL ?? '').trim())
      .filter((value) => value && !value.startsWith('data:') && !value.startsWith('http'));
    if (paths.length === 0) {
      setPhotoUrls({});
      return;
    }

    const resolve = async () => {
      const { createSignedPhotoUrl } = await import('../utils/supabaseClient');
      const next: PhotoMap = {};
      for (const path of paths) {
        if (cancelled) return;
        next[path] = await createSignedPhotoUrl(path, 3600);
      }
      if (!cancelled) setPhotoUrls(next);
    };

    void resolve().catch(() => {
      if (!cancelled) setPhotoUrls({});
    });
    return () => {
      cancelled = true;
    };
  }, [filtered]);

  const photoSrcFor = (record: StudentScreeningRecord): string | null => {
    const value = (record.Eye_Photo_URL ?? '').trim();
    if (!value) return null;
    if (value.startsWith('data:')) return value;
    if (value.startsWith('http')) return value;
    return photoUrls[value] ?? null;
  };

  const handleExport = (subset: StudentScreeningRecord[], label: string) => {
    if (subset.length === 0) {
      notify('لا توجد سجلات لتصديرها.', 'info');
      return;
    }
    const csv = generateSPSS_CSV(subset);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AlBasar_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`تم تصدير ${subset.length} سجل إلى ملف CSV (UTF-8 BOM).`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
            <Users size={15} aria-hidden="true" />
            إجمالي التلاميذ
          </div>
          <div className="mt-1 text-3xl font-black font-mono text-blue-950">{totalStudents}</div>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
            <BarChart3 size={15} aria-hidden="true" />
            عدد الفاحصين
          </div>
          <div className="mt-1 text-3xl font-black font-mono text-teal-950">{examinerCount}</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
            <AlertTriangle size={15} aria-hidden="true" />
            الإحالات العاجلة
          </div>
          <div className="mt-1 text-3xl font-black font-mono text-rose-950">{urgentCount}</div>
        </div>
      </div>

      {/* ---- Toolbar ---- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search size={16} className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث بالكود أو المدرسة أو الفاحص…"
            aria-label="بحث في السجلات"
            className="w-full text-xs pr-9 pl-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <select
            value={schoolFilter}
            onChange={(event) => setSchoolFilter(event.target.value)}
            aria-label="تصفية حسب المدرسة"
            className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none"
          >
            <option value="ALL">كل المدارس</option>
            {schools.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
          </select>
          <select
            value={examinerFilter}
            onChange={(event) => setExaminerFilter(event.target.value)}
            aria-label="تصفية حسب الفاحص"
            className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none"
          >
            <option value="ALL">كل الفاحصين</option>
            {examiners.map((examiner) => (
              <option key={examiner} value={examiner}>{examiner}</option>
            ))}
          </select>
          <select
            value={urgencyFilter}
            onChange={(event) => setUrgencyFilter(event.target.value)}
            aria-label="تصفية حسب حالة الإحالة"
            className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none"
          >
            <option value="ALL">كل حالات الإحالة</option>
            <option value="REFERRED">مُحال فقط</option>
            {Object.entries(URGENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onRefresh?.()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          {isLoading ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          {isLoading ? 'جارٍ السحب…' : 'تحديث البيانات الحية'}
        </button>
        <button
          type="button"
          onClick={() => handleExport(filtered, 'Filtered')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 transition"
        >
          <Download size={14} aria-hidden="true" />
          تصدير النتائج المفلترة (CSV)
        </button>
        <button
          type="button"
          onClick={() => handleExport(records, 'AllRecords')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <Download size={14} aria-hidden="true" />
          تصدير كل السجلات (CSV)
        </button>
      </div>

      {/* ---- Records table ---- */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-xs text-center border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-bold">كود التلميذ</th>
                <th className="py-2.5 px-3 font-bold">المدرسة</th>
                <th className="py-2.5 px-3 font-bold">الفاحص</th>
                <th className="py-2.5 px-3 font-bold">حالة الإحالة</th>
                <th className="py-2.5 px-3 font-bold">صورة العين</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                    {records.length === 0
                      ? 'لا توجد سجلات في السحابة بعد. ابدأ الفحص ثم اضغط «تحديث البيانات الحية».'
                      : 'لا توجد سجلات مطابقة للمرشحات الحالية.'}
                  </td>
                </tr>
              ) : (
                filtered.map((record) => {
                  const src = photoSrcFor(record);
                  return (
                    <tr key={record.Child_ID} className="hover:bg-blue-50/40 transition">
                      <td className="py-2 px-3 font-bold font-mono text-blue-900">{record.Child_ID}</td>
                      <td className="py-2 px-3 font-sans">{record.School_Name || '—'}</td>
                      <td className="py-2 px-3 font-sans">
                        {record.Examiner_Full_Name || record.Examiner_ID || '—'}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                            isUrgent(record)
                              ? 'bg-rose-100 text-rose-800'
                              : record.Final_Triage_Referral === 1
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {record.Final_Triage_Referral === 1
                            ? (URGENCY_LABELS[record.Referral_Urgency] ?? record.Referral_Urgency)
                            : 'لا توجد إحالة'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {src ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPath(record.Eye_Photo_URL ?? null)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                            title="عرض صورة العين (رابط موقّع صالح ساعة)"
                          >
                            <Eye size={13} aria-hidden="true" />
                            معاينة
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <ImageOff size={13} aria-hidden="true" />
                            غير متاحة
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        المعروض {filtered.length} من {totalStudents} سجل. ملف CSV مُرمّز بـ UTF-8 (BOM) وجاهز للاستيراد في SPSS.
        صور العيون تُعرض عبر روابط موقّعة صالحة لمدة ساعة واحدة، والحاوية خاصة بالكامل.
      </p>

      {/* ---- Signed-image preview ---- */}
      {previewPath && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewPath(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">صورة العين</h3>
              <button
                type="button"
                onClick={() => setPreviewPath(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق المعاينة"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {(() => {
              const record = filtered.find((r) => (r.Eye_Photo_URL ?? '') === previewPath);
              const src = record ? photoSrcFor(record) : photoUrls[previewPath] ?? null;
              return src ? (
                <img
                  src={src}
                  alt={`صورة عين التلميذ ${record?.Child_ID ?? ''}`}
                  className="max-h-[65vh] w-full rounded-xl object-contain"
                />
              ) : (
                <p className="py-6 text-center text-xs text-slate-500">
                  تعذّر إنشاء رابط موقّع لهذه الصورة.
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
