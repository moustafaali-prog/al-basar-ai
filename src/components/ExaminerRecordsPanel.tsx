import React, { useMemo } from 'react';
import { Download, Users } from 'lucide-react';

import type { StudentScreeningRecord } from '../types';
import { generateSPSS_CSV } from '../utils/acuityMath';
import { useFeedback } from './FeedbackProvider';

interface ExaminerRecordsPanelProps {
  /** Every record stored on this device (local + already-synced). */
  records: StudentScreeningRecord[];
  /** The signed-in Supabase account id, when there is one. */
  ownerId?: string | null;
  /** The stable device identifier of this handset. */
  deviceId?: string | null;
}

/**
 * The examiner's own dataset.
 *
 * An examiner only ever sees the rows this device produced (or the rows this
 * account owns). The cloud-side equivalent is enforced by PostgreSQL RLS —
 * this panel is only the client-side mirror of that rule.
 */
export const ExaminerRecordsPanel: React.FC<ExaminerRecordsPanelProps> = ({
  records,
  ownerId,
  deviceId,
}) => {
  const { notify } = useFeedback();

  const ownRecords = useMemo(
    () =>
      records.filter((record) => {
        if (ownerId && record.Owner_ID) return record.Owner_ID === ownerId;
        if (deviceId && record.Device_ID) return record.Device_ID === deviceId;
        // A record with no attribution at all was produced on this device.
        return !record.Owner_ID && !record.Device_ID;
      }),
    [records, ownerId, deviceId],
  );

  const handleDownload = () => {
    if (ownRecords.length === 0) {
      notify('لا توجد سجلات لتصديرها بعد.', 'info');
      return;
    }
    const csv = generateSPSS_CSV(ownRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AlBasar_MyRecords_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`تم تصدير ${ownRecords.length} سجل خاص بك إلى ملف CSV (UTF-8 BOM).`, 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Users size={16} className="text-blue-600" aria-hidden="true" />
          سجلاتي على هذا الجهاز
          <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-800">
            {ownRecords.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={ownRecords.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50 transition"
        >
          <Download size={14} aria-hidden="true" />
          تنزيل سجلاتي (CSV / SPSS)
        </button>
      </div>

      {ownRecords.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
          لا توجد سجلات بعد على هذا الجهاز. ابدأ الفحص من تبويب «تسجيل».
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[55vh]">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold">كود التلميذ</th>
                  <th className="py-2.5 px-3 font-bold">المدرسة</th>
                  <th className="py-2.5 px-3 font-bold">الفاحص</th>
                  <th className="py-2.5 px-3 font-bold">الإحالة</th>
                  <th className="py-2.5 px-3 font-bold">المزامنة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {ownRecords.map((record) => (
                  <tr key={record.Child_ID} className="hover:bg-blue-50/40 transition">
                    <td className="py-2 px-3 font-bold text-blue-900">{record.Child_ID}</td>
                    <td className="py-2 px-3 font-sans">{record.School_Name || '—'}</td>
                    <td className="py-2 px-3 font-sans">
                      {record.Examiner_Full_Name || record.Examiner_ID || '—'}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                          record.Final_Triage_Referral === 1
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {record.Final_Triage_Referral === 1 ? 'مُحال' : 'لا توجد إحالة'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans text-[10px]">
                      <span
                        className={`rounded px-2 py-0.5 font-bold ${
                          (record._syncStatus ?? 'pending') === 'synced'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {(record._syncStatus ?? 'pending') === 'synced' ? '☁️ تمت' : '⏳ بانتظار'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        هذه السجلات تخصك أنت فقط. لا يستطيع أي فاحص آخر قراءتها من السحابة — الحماية مفروضة
        بسياسات RLS على مستوى قاعدة البيانات، لا في واجهة التطبيق.
      </p>
    </div>
  );
};
