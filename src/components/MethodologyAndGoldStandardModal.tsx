import React, { useEffect } from 'react';
import { X, BookOpen, ShieldCheck, Ruler, ClipboardCheck, BarChart3, ExternalLink } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyAndGoldStandardModal: React.FC<MethodologyModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="feedback-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="methodology-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
      >
        <header className="methodology-dialog__header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center w-11 h-11 rounded-2xl bg-[var(--m3-primary-soft)] text-[var(--m3-primary)] shrink-0">
              <BookOpen size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="methodology-title" className="methodology-dialog__title">المنهجية وحدود الاستخدام</h2>
              <p className="methodology-dialog__sub">ملاحظات تشغيلية ومراجع عامة؛ ليست اعتماداً أو بروتوكولاً محلياً.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-action shrink-0"
            aria-label="إغلاق النافذة"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="methodology-dialog__body">
          <article className="notice notice--info items-start">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong className="block font-extrabold">غرض المنظومة وحدودها</strong>
              <p className="mt-1">
                تدعم الواجهة تسجيل قياسات فحص أولي وإدارة بيانات المشروع. لا تصدر تشخيصاً طبياً،
                ولا تثبت بمفردها وجود مرض أو سلامة العين. تُراجع الإحالات والقرارات وفق البروتوكول
                المحلي المعتمد وبواسطة المختصين.
              </p>
            </div>
          </article>

          <article className="methodology-section">
            <h3 className="section-title"><Ruler size={17} aria-hidden="true" /> حجم الرموز ومعايرة العرض</h3>
            <p>
              تُحسب أبعاد الرموز نظرياً من مسافة العرض ومعامل التحويل بين بكسلات CSS والملليمتر.
              الحساب الهندسي لا يثبت وحده دقة الشاشة أو تباينها أو صلاحية طريقة الفحص. طابق المرجع
              المادي على الجهاز المستخدم، وثبّت المسافة والإضاءة ووضعية الطفل كما يحددها بروتوكول الدراسة.
            </p>
            <p className="methodology-formula" dir="ltr">h = 2d × tan(5 arcmin / 2) × 10^LogMAR</p>
            <p className="field-hint">يظهر التطبيق قيمة افتراضية قبل الضبط الفعلي؛ لا تُعامل القيمة الافتراضية على أنها معايرة.</p>
          </article>

          <article className="methodology-section methodology-section--warn">
            <h3 className="section-title"><ClipboardCheck size={17} aria-hidden="true" /> اختيار الفحص وحد الإحالة</h3>
            <p>
              ملاءمة رمز الفحص والمسافة وحد الإحالة تعتمد على العمر واللغة والقدرة على الاستجابة
              والبروتوكول المعتمد. العتبة المبرمجة في هذا التطبيق إعداد خاص بالنموذج، وليست توصية
              عالمية أو دليلاً على اعتماد المنظومة. لا تغيّرها لأغراض الدراسة دون توثيق واعتماد مسبق.
            </p>
            <p>
              يجب إكمال الفحص الورقي والرقمي كلٌّ على حدة. يحفظ النظام معرف فاحص ووقت بدء وإكمال
              مستقلين لكل محطة. التسلسل الافتراضي في هذه النسخة هو الورقي (6m) ثم الرقمي؛ ولا
              يولّد التطبيق توزيعاً عشوائياً ولا يضمن إخفاء النتائج بين فاحصين؛ يلزم لذلك إجراء
              ميداني مستقل.
            </p>
            <p>
              الخوارزمية الحالية تبدأ عند 6/60، وتستخدم إجابتين صحيحتين متتاليتين للانتقال إلى
              المستوى التالي، وإجابتين خاطئتين للتراجع مستوى واحداً. المسار السريع المبرمج هو
              6/60 ← 6/12 ← 6/6. عند التعذر عند 6/60 تسجل النتيجة «أقل من 6/60» كقيمة مقيدة لا
              كحدة بصر دقيقة. يلزم اعتماد هذه القاعدة والتحقق منها في بروتوكول الدراسة قبل جمع
              البيانات.
            </p>
          </article>

          <article className="methodology-section">
            <h3 className="section-title"><Ruler size={17} aria-hidden="true" /> قياسات الصورة</h3>
            <p>
              تقديرات انعكاس القرنية وMRD₁ في التطبيق تعتمد على صورة ونقاط يحددها المستخدم وعلى
              مقياس مرجعي مفترض. قيمة HVID البالغة 11.7 mm هنا افتراض للتحويل البرمجي وليست
              قياساً فردياً للمشارك. زاوية التصوير، اتجاه النظر، الإضاءة وجودة الصورة قد تؤثر في
              الناتج؛ لا تستخدم هذه القيم منفردة لتشخيص الحول أو الإطراق أو لاتخاذ قرار إحالة.
            </p>
          </article>

          <div className="notice notice--warn items-start">
            <ClipboardCheck size={17} aria-hidden="true" />
            <p>
              <strong>السجلات القديمة:</strong> الإصدارات السابقة لم تحفظ ما إذا كانت قيم Hirschberg
              وMRD₁ الافتراضية قد قِيست فعلاً. لا يمكن استنتاج ذلك من الرقم وحده؛ راجع سجلاتها
              قبل ضمها للتحليل.
            </p>
          </div>

          <article className="methodology-section methodology-section--pass">
            <h3 className="section-title"><BarChart3 size={17} aria-hidden="true" /> قراءة المؤشرات</h3>
            <p>
              Kappa يصف الاتفاق الثنائي بين الورقي والرقمي عند حد WHO 2025: 6/12 (LogMAR ≥ 0.30)، ولا يقيس الصدق
              التشخيصي. الحساسية والنوعية وPPV وNPV تقارن الحدة الرقمية وحدها بالمرجع، ولا تستخدم
              الإحالة المركبة التي تضم مدخلات استكشافية. لا تدخل نتيجة المرجع في حساب الدقة إلا مع
              توثيق الطريقة والمعيار والفاحص والتاريخ وحالة التعمية؛ وتعرض فواصل ثقة Wilson بنسبة
              95% وأعداد التحقق. هذه مؤشرات وصفية وليست اعتماداً سريرياً.
            </p>
          </article>

          <article className="methodology-section">
            <h3 className="section-title"><BookOpen size={17} aria-hidden="true" /> مراجع عامة للرجوع إلى النسخة الكاملة</h3>
            <ul className="mt-2 grid gap-2">
              <li>
                <a className="methodology-link" href="https://www.who.int/publications/i/item/9789240105201" target="_blank" rel="noreferrer">
                  منظمة الصحة العالمية: دليل فحص البصر والسمع للأطفال في سن المدرسة (2025)
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </li>
              <li>
                <a className="methodology-link" href="https://aapos.org/syndicated/vision-screening" target="_blank" rel="noreferrer">
                  AAPOS: توصيات فحص البصر حسب العمر
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </li>
            </ul>
            <p className="field-hint mt-2">
              هذه مراجع إرشادية عامة. يعتمد التنفيذ على موافقات وأدلة البروتوكول المحلي للدراسة،
              وعلى النسخ السارية وقت جمع البيانات.
            </p>
          </article>

          <div className="notice notice--warn items-start">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              تُخزن البيانات في localStorage بهذا المتصفح دون تشفير تطبيقي. احمِ الجهاز وملفات
              التصدير وفق متطلبات الجهة البحثية.
            </p>
          </div>
        </div>

        <footer className="methodology-dialog__footer">
          <a
            href={`${import.meta.env.BASE_URL}guide.html`}
            target="_blank"
            rel="noopener"
            className="m3-btn m3-btn--outline"
          >
            <BookOpen size={16} aria-hidden="true" />
            الدليل المصور والتدريبي
          </a>
          <button type="button" onClick={onClose} className="m3-btn m3-btn--primary">
            إغلاق
          </button>
        </footer>
      </section>
    </div>
  );
};
