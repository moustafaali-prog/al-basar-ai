import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';

import { isSupabaseConfigured } from '../utils/supabaseConfig';
import {
  CloudAuthError,
  signInToCloud,
  type CloudAuthUser,
} from '../utils/supabaseAuth';

interface CloudAuthModalProps {
  isOpen: boolean;
  isOnline: boolean;
  onClose: () => void;
  onSignedIn: (user: CloudAuthUser) => void;
}

const friendlyAuthError = (error: unknown): string => {
  if (!(error instanceof CloudAuthError)) {
    return 'تعذر تسجيل الدخول. تحقق من الاتصال ثم أعد المحاولة.';
  }

  if (error.code === 'CLOUD_NOT_CONFIGURED') {
    return 'سحابة المشرف غير مهيأة في نسخة التطبيق هذه. تواصل مع مدير النظام.';
  }
  if (/invalid login credentials/i.test(error.message)) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (/email not confirmed/i.test(error.message)) {
    return 'الحساب لم يُفعّل بعد. اطلب من المشرف تأكيد البريد الإلكتروني.';
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(error.message)) {
    return 'محاولات دخول كثيرة. انتظر دقيقة ثم أعد المحاولة.';
  }
  if (/failed to fetch|network|fetch error/i.test(error.message)) {
    return 'تعذر الوصول إلى خادم السحابة. تحقق من اتصال الإنترنت.';
  }
  if (/invalid email/i.test(error.message)) {
    return 'صيغة البريد الإلكتروني غير صحيحة.';
  }
  return 'تعذر تسجيل الدخول. تحقق من البيانات ثم أعد المحاولة.';
};

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  isOnline,
  onClose,
  onSignedIn,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage('');
    setShowPassword(false);
    setSubmitting(false);
    setTesting(false);
    setTestResult(null);
    setPassword('');
    const timer = window.setTimeout(() => emailRef.current?.focus(), 60);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  const testConnection = async () => {
    setTestResult(null);
    setErrorMessage('');
    setTesting(true);
    try {
      const { testSupabaseConnection, testSupabaseUpsert } = await import('../utils/supabaseClient');
      const read = await testSupabaseConnection();
      if (!read.ok) {
        const exact = [read.code, read.message, read.details, read.hint]
          .filter(Boolean)
          .join(' | ');
        setTestResult(`⚠️ فشل GET (${read.status ?? '—'}): ${exact}`);
        return;
      }

      const write = await testSupabaseUpsert();
      if (!write.ok) {
        setTestResult(`⚠️ فشل UPSERT التجريبي: ${write.message}`);
        return;
      }

      const dropped = write.droppedColumns?.length
        ? ` | أعمدة غير موجودة في الجدول وتم تجاهلها: ${write.droppedColumns.join(', ')}`
        : '';
      setTestResult(`✅ الاتصال ناجح وتم إرسال سجل تجريبي. ${write.message}${dropped}`);
    } catch (e) {
      setTestResult(`❌ خطأ في الاختبار: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !configured || !isOnline) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const user = await signInToCloud(trimmedEmail, password);
      setPassword('');
      onSignedIn(user);
    } catch (error) {
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="feedback-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-auth-title"
        aria-describedby="cloud-auth-note"
      >
        <header className="auth-dialog__header">
          <div className="auth-dialog__heading">
            <span className="auth-dialog__icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </span>
            <div className="auth-dialog__titles">
              <h2 id="cloud-auth-title">تسجيل دخول الفاحص</h2>
              <p id="cloud-auth-note">
                المزامنة السحابية فقط. الفحص والحفظ المحلي يعملان دون تسجيل دخول.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-action shrink-0"
            onClick={onClose}
            disabled={submitting}
            aria-label="إغلاق نافذة تسجيل الدخول"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {!configured ? (
          <div className="auth-dialog__body">
            <div className="notice notice--warn" role="alert">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>السحابة غير مهيأة</strong>
                <p>لم تُضبط مفاتيح Supabase في هذه النسخة. يستمر الحفظ المحلي بشكل طبيعي.</p>
              </div>
            </div>
          </div>
        ) : (
          <form className="auth-dialog__body" onSubmit={handleSubmit} noValidate>
            {!isOnline && (
              <div className="notice notice--warn" role="status">
                <WifiOff size={18} aria-hidden="true" />
                <div>
                  <strong>لا يوجد اتصال بالإنترنت</strong>
                  <p>يمكنك متابعة الفحص الآن، ثم تسجيل الدخول والمزامنة عند عودة الشبكة.</p>
                </div>
              </div>
            )}

            <label className="auth-field">
              <span>البريد الإلكتروني</span>
              <span className="auth-input">
                <Mail size={17} aria-hidden="true" />
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="examiner@example.org"
                  autoComplete="username"
                  dir="ltr"
                  inputMode="email"
                  disabled={submitting}
                  required
                />
              </span>
            </label>

            <label className="auth-field">
              <span>كلمة المرور</span>
              <span className="auth-input">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  dir="ltr"
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="auth-input__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPassword}
                  disabled={submitting}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </span>
            </label>

            {errorMessage && (
              <p className="auth-dialog__error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="m3-btn m3-btn--primary m3-btn--block auth-dialog__submit"
              disabled={submitting || !isOnline}
              aria-busy={submitting}
            >
              {submitting ? (
                <RefreshCw size={18} className="spin" aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              <span>{submitting ? 'جارٍ التحقق…' : 'تسجيل الدخول'}</span>
            </button>

            <button
              type="button"
              className="m3-btn m3-btn--ghost m3-btn--block auth-dialog__submit"
              onClick={testConnection}
              disabled={submitting || testing || !isOnline || !configured}
              style={{ marginTop: '8px' }}
              aria-busy={testing}
            >
              {testing ? <RefreshCw size={16} className="spin" aria-hidden="true" /> : null}
              <span>{testing ? 'جارٍ فحص الاتصال وإرسال سجل تجريبي…' : '🔍 اختبار الاتصال وإرسال سجل تجريبي'}</span>
            </button>

            {testResult && (
              <p className="auth-dialog__error" role="status" style={{ marginTop: '8px' }}>
                {testResult}
              </p>
            )}

            <p className="auth-dialog__hint">
              تُنشأ الحسابات من مشرف النظام عبر لوحة Supabase، ولا يوجد تسجيل ذاتي.
              تبقى السجلات على هذا الجهاز حتى بعد تسجيل الخروج.
            </p>
          </form>
        )}
      </section>
    </div>
  );
};
