import React, { useState } from 'react';
import { Award, CheckCircle2, RotateCcw, Download, UserPlus, Trash2, Users, Save } from 'lucide-react';
import { SUSEvaluationRecord } from '../types';
import { generateSUS_CSV } from '../utils/acuityMath';
import { useFeedback } from './FeedbackProvider';

const SUS_QUESTIONS = [
  '1. أرغب في استخدام هذه المنظومة الذكية بشكل مستمر في فحوصات الصحة المدرسية السنوية.',
  '2. وجدت أن المنظومة معقدة بدون مسوغ سريري في خطوات الفحص الميداني.',
  '3. رأيت أن واجهة المنظومة كانت سهلة الاستخدام وسلسة للغاية داخل قاعات الصف.',
  '4. أعتقد أنني سأحتاج إلى مساعدة خبير تقني دائم لأتمكن من تشغيل هذا النظام.',
  '5. وجدت أن الوظائف المدمجة (المعايرة، فحص النظر، فرز الحول، وبطاقة الأم) متناسقة بشكل ممتاز.',
  '6. شعرت بوجود تناقض أو عدم اتساق أثناء الانتقال بين محطات الفحص.',
  '7. أتصور أن ممرضي وممرضات الصحة المدرسية سيتعلمون تشغيل هذا التطبيق بسرعة فائقة.',
  '8. وجدت أن المنظومة مربكة أو مرهقة عند التعامل مع تلاميذ الصف الأول الصغار.',
  '9. شعرت بثقة سريرية وعلمية عالية أثناء توجيه التلميذ لقرار الإحالة الصحيحة.',
  '10. توجب عليّ تعلم العديد من المفاهيم البرمجية المعقدة قبل أن أتمكن من بدء الفحص.',
];

const SUS_STORAGE_KEY = 'albasar_sus_evaluations_v3';

function createEvaluationId(): string {
  const token = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `SUS-${token}`;
}

function loadEvaluations(): SUSEvaluationRecord[] {
  try {
    const saved = localStorage.getItem(SUS_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SUSEvaluationRecord =>
      Boolean(entry && typeof entry === 'object' &&
        typeof entry.id === 'string' && typeof entry.examinerId === 'string' &&
        typeof entry.examinerName === 'string' && Array.isArray(entry.answers) && entry.answers.length === 10 &&
        entry.answers.every((answer: unknown) => Number.isInteger(answer) && Number(answer) >= 1 && Number(answer) <= 5) &&
        Number.isFinite(entry.susScore) && entry.susScore >= 0 && entry.susScore <= 100)
    );
  } catch {
    return [];
  }
}

export const NurseSUSScale: React.FC = () => {
  const { notify, confirmAction } = useFeedback();
  // Evaluations database state
  const [evaluations, setEvaluations] = useState<SUSEvaluationRecord[]>(() => {
    return loadEvaluations();
  });

  // Current Evaluator Form State
  const [examinerId, setExaminerId] = useState('');
  const [examinerName, setExaminerName] = useState('');
  const [phccOrHospital, setPhccOrHospital] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(0));

  const handleScoreChange = (index: number, val: number) => {
    const updated = [...answers];
    updated[index] = val;
    setAnswers(updated);
  };

  const calculateSUS = (ans: number[]): { score: number | null; grade: string; acceptability: string } => {
    if (ans.length !== 10 || ans.some((val) => !Number.isInteger(val) || val < 1 || val > 5)) {
      return { score: null, grade: 'بانتظار الإجابة', acceptability: 'أكمل البنود العشرة لحساب الدرجة' };
    }
    let rawSum = 0;
    ans.forEach((val, idx) => {
      const qNum = idx + 1;
      if (qNum % 2 === 1) {
        rawSum += val - 1;
      } else {
        rawSum += 5 - val;
      }
    });

    const score = +(rawSum * 2.5).toFixed(1);
    return { score, grade: 'درجة وصفية', acceptability: 'لا توجد عتبات تفسير محلية موثقة' };
  };

  const currentCalc = calculateSUS(answers);

  // Save new evaluation
  const handleSaveEvaluation = () => {
    if (currentCalc.score === null || !examinerId.trim() || !examinerName.trim()) {
      notify('أدخل كود الفاحص واسمه وأجب عن البنود العشرة قبل حفظ التقييم.', 'error');
      return;
    }
    const newRecord: SUSEvaluationRecord = {
      id: createEvaluationId(),
      examinerId: examinerId.trim(),
      examinerName: examinerName.trim(),
      phccOrHospital: phccOrHospital.trim(),
      role: role.trim(),
      evaluationDate: new Date().toISOString(),
      answers: [...answers],
      susScore: currentCalc.score,
      grade: currentCalc.grade,
      acceptability: currentCalc.acceptability,
      notes: notes.trim(),
    };

    const updated = [newRecord, ...evaluations];
    try {
      localStorage.setItem(SUS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      notify('تعذر حفظ التقييم في هذا المتصفح. صدّر البيانات الحالية أو تحقق من مساحة التخزين.', 'error');
      return;
    }
    setEvaluations(updated);

    notify(`حُفظ التقييم ${newRecord.susScore} من 100 محلياً.`, 'success');
    setNotes('');
    setAnswers(Array(10).fill(0));
  };

  const handleDeleteEvaluation = async (id: string) => {
    const accepted = await confirmAction({
      title: 'حذف هذا التقييم؟',
      message: 'سيُحذف التقييم من هذا المتصفح فقط، ولا يمكن التراجع عن ذلك.',
      confirmLabel: 'حذف التقييم',
      danger: true,
    });
    if (accepted) {
      const updated = evaluations.filter((e) => e.id !== id);
      try {
        localStorage.setItem(SUS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        notify('تعذر تحديث التخزين المحلي؛ لم يُحذف التقييم.', 'error');
        return;
      }
      setEvaluations(updated);
      notify('حُذف التقييم من التخزين المحلي.', 'success');
    }
  };

  const handleDownloadSUS_CSV = () => {
    if (evaluations.length === 0) {
      notify('لا توجد تقييمات محفوظة لتصديرها.', 'info');
      return;
    }
    const csvContent = generateSUS_CSV(evaluations);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AlBasar_Usability_Evaluations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('بدأ تنزيل ملف CSV للتقييمات.', 'success');
  };

  const handleResetForm = () => {
    setAnswers(Array(10).fill(0));
  };

  // Mean & Standard Deviation of SUS scores
  const nEval = evaluations.length;
  const meanVal = nEval > 0 ? evaluations.reduce((acc, e) => acc + e.susScore, 0) / nEval : 0;
  const meanSUS = nEval > 0 ? meanVal.toFixed(1) : '--';
  const variance = nEval > 1
    ? evaluations.reduce((acc, e) => acc + Math.pow(e.susScore - meanVal, 2), 0) / (nEval - 1)
    : 0;
  const sdSUS = nEval > 1 ? Math.sqrt(variance).toFixed(1) : '--';

  return (
    <section className="admin-card">
      <div className="card-head">
        <div>
          <h2 className="card-head__title">
            <Award size={19} aria-hidden="true" />
            استبيان تقييم سهولة الاستخدام (صياغة مكيّفة عن SUS)
          </h2>
          <p className="card-head__sub">
            البنود الحالية مكيّفة لسياق التطبيق. الدرجة مؤشر وصفي؛ لا تُقارن بمراجع SUS المنشورة قبل التحقق محلياً من الترجمة والتكييف.
          </p>
        </div>

        <div className="btn-row">
          <button
            type="button"
            onClick={handleDownloadSUS_CSV}
            className="m3-btn m3-btn--pass m3-btn--sm"
          >
            <Download size={15} aria-hidden="true" />
            تصدير تقييمات CSV
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            className="m3-btn m3-btn--outline m3-btn--sm"
          >
            <RotateCcw size={14} aria-hidden="true" />
            تصفير الإجابات
          </button>
        </div>
      </div>

      <div className="admin-stats admin-stats--3 mb-4">
        <div className="admin-stat admin-stat--primary">
          <span>متوسط الدرجة الوصفية (Mean ± SD)</span>
          <strong>
            {meanSUS} <span className="text-xs font-normal">± {sdSUS}</span>
          </strong>
          <small>الدرجة من 0 إلى 100؛ لا تعرض هذه النسخة عتبة قبول.</small>
        </div>

        <div className="admin-stat">
          <span>عدد التقييمات المسجلة</span>
          <strong>{nEval}</strong>
          <small>قد يتكرر المقيّم عند إرسال أكثر من تقييم</small>
        </div>

        <div className="admin-stat admin-stat--pass">
          <span>التفسير</span>
          <strong className="!text-[18px]">{nEval === 0 ? 'لا توجد بيانات' : 'درجة وصفية'}</strong>
          <small>الدرجة لا تحكم على السلامة أو الصلاحية السريرية</small>
        </div>
      </div>

      <div className="admin-subcard mb-4">
        <h3 className="section-title">
          <UserPlus size={17} aria-hidden="true" />
          بيانات الفاحص المقيم
        </h3>
        <div className="admin-form-grid mt-3">
          <div className="field">
            <label className="field-label" htmlFor="sus-examiner-id">كود الفاحص</label>
            <input
              id="sus-examiner-id"
              type="text"
              value={examinerId}
              onChange={(e) => setExaminerId(e.target.value)}
              className="m3-input m3-input--mono"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sus-examiner-name">اسم الممرض / الفاحص</label>
            <input
              id="sus-examiner-name"
              type="text"
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              className="m3-input"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sus-site">المركز الصحي / المدرسة</label>
            <input
              id="sus-site"
              type="text"
              value={phccOrHospital}
              onChange={(e) => setPhccOrHospital(e.target.value)}
              className="m3-input"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sus-role">المسمى الوظيفي</label>
            <input
              id="sus-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="m3-input"
            />
          </div>
        </div>
      </div>

      <div className="notice notice--info mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <strong className="block">النتيجة المحسوبة لهذا التقييم الحالي:</strong>
            <span className="text-[12px]">
              {currentCalc.grade} • {currentCalc.acceptability}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-black font-mono text-[var(--m3-primary-strong)]">
              {currentCalc.score ?? '--'} <span className="text-xs font-sans text-[var(--m3-muted)]">/ 100</span>
            </span>
            <button
              type="button"
              onClick={handleSaveEvaluation}
              disabled={currentCalc.score === null || !examinerId.trim() || !examinerName.trim()}
              className="m3-btn m3-btn--primary"
            >
              <Save size={16} aria-hidden="true" />
              حفظ وتوثيق استبانة الفاحص
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 mb-4">
        {SUS_QUESTIONS.map((q, idx) => {
          const isOdd = (idx + 1) % 2 === 1;
          return (
            <div key={idx} className="sus-question">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-[var(--m3-text)] leading-relaxed">{q}</p>
                  <span className="text-[10px] text-[var(--m3-muted)]">
                    {isOdd ? 'فقرة إيجابية (تسجيل مباشر)' : 'فقرة عكسية (تسجيل معكوس)'}
                  </span>
                </div>

                <div className="likert-wrap">
                  <div className="likert" role="group" aria-label={`إجابة الفقرة ${idx + 1}`}>
                    <span className="likert__label">لا أوافق</span>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleScoreChange(idx, val)}
                        aria-pressed={answers[idx] === val}
                        aria-label={`الفقرة ${idx + 1}: ${val} من 5`}
                        className="likert__btn"
                      >
                        {val}
                      </button>
                    ))}
                    <span className="likert__label">أوافق بشدة</span>
                  </div>
                  <span className="likert__caption">1 = لا أوافق · 5 = أوافق بشدة</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-table-wrap mb-4">
        <div className="admin-table-head">
          <h3 className="section-title text-[13px]">
            <Users size={15} aria-hidden="true" />
            سجل استبانات الفاحصين المحفوظة محلياً (N = {evaluations.length})
          </h3>
          <span className="field-hint font-mono" dir="ltr">albasar_sus_evaluations_v3</span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الفاحص</th>
                <th>المركز / المدرسة</th>
                <th>المسمى</th>
                <th>درجة SUS</th>
                <th>التصنيف</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[var(--m3-muted)]">
                    لا توجد استبانات مسجلة بعد.
                  </td>
                </tr>
              ) : (
                evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td className="cell-strong text-[var(--m3-primary)]">{ev.examinerId}</td>
                    <td>{ev.examinerName}</td>
                    <td className="cell-muted">{ev.phccOrHospital}</td>
                    <td className="cell-muted">{ev.role}</td>
                    <td className="cell-pass">{ev.susScore}</td>
                    <td className="cell-muted">درجة وصفية</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvaluation(ev.id)}
                        className="icon-action icon-action--danger"
                        title="حذف هذا التقييم"
                        aria-label={`حذف تقييم ${ev.examinerId}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="notice notice--pass items-start">
        <CheckCircle2 size={17} aria-hidden="true" />
        <span>
          تُحفظ التقييمات محلياً في هذا المتصفح. تحقّق من الترميز وقاموس البيانات وإعدادات الاستيراد قبل التحليل الإحصائي.
        </span>
      </div>
    </section>
  );
};
