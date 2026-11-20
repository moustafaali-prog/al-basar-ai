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

import { SUPABASE_ANON_KEY_VALUE, SUPABASE_URL_VALUE, setSupabaseLocalOverrides } from '../utils/supabaseConfig';
import type { CloudAuthUser } from '../utils/supabaseAuth';


interface CloudAuthModalProps {
  isOpen: boolean;
  isOnline: boolean;
  onClose: () => void;
  onSignedIn: (user: CloudAuthUser) => void;
  /** Field-examiner shortcut: close the modal and sync with the public anon key. */
  onContinueWithoutAccount: () => void;
}

type CloudAuthMode = 'signin' | 'signup';

const friendlyAuthError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code ?? '';
  const status = (error as { status?: number } | null)?.status ?? 0;

  if (code === 'CLOUD_NOT_CONFIGURED') {
    return 'سحابة المشرف غير مهيأة في نسخة التطبيق هذه. تواصل مع مدير النظام.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return '⚠️ البريد الإلكتروني أو الرمز السري غير صحيح، أو أن الحساب غير منشأ بعد في لوحة Authentication -> Users داخل Supabase.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return '⚠️ الحساب بانتظار تأكيد البريد الإلكتروني — فعّل خيار Auto Confirm User في لوحة Supabase.';
  }
  if (code === 'weak_password' || /password should be at least 6 characters/i.test(message)) {
    return '⚠️ يجب أن يتكون الرمز السري من 6 أحرف أو أرقام على الأقل.';
  }
  if (code === 'user_already_exists' || /user already registered|already been registered/i.test(message)) {
    return '⚠️ هذا البريد الإلكتروني مسجل مسبقاً. استخدم تبويب «تسجيل الدخول» أو استعد كلمة المرور من لوحة Supabase.';
  }
  if (code === 'signup_disabled' || /signups? (are )?disabled|signup is disabled/i.test(message)) {
    return '⚠️ إنشاء الحسابات الجديدة معطّل في إعدادات Supabase Auth. اطلب من المشرف تفعيل Sign Ups أو إنشاء الحساب من Authentication -> Users.';
  }
  if (code === 'email_address_invalid' || /email address .* is invalid|invalid email/i.test(message)) {
    return '⚠️ صيغة البريد الإلكتروني غير صحيحة — مثال صحيح: name@example.com';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|too many requests/i.test(message)) {
    return 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.';
  }
  if (code === 'validation_failed' || /failed to fetch|network|fetch error/i.test(message)) {
    return 'تعذر الوصول إلى خادم السحابة. تحقق من اتصال الإنترنت.';
  }
  if (status === 400 || status === 422) {
    return `⚠️ تعذر إكمال العملية: ${message}`;
  }
  return 'تعذر إكمال العملية. تحقق من البيانات ثم أعد المحاولة.';
};

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  isOnline,
  onClose,
  onSignedIn,
  onContinueWithoutAccount,
}) => {
  const [mode, setMode] = useState<CloudAuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [urlOverride, setUrlOverride] = useState(() => {
    try { return localStorage.getItem('albasar_supabase_url') || SUPABASE_URL_VALUE; } catch { return SUPABASE_URL_VALUE; }
  });
  const [keyOverride, setKeyOverride] = useState(() => {
    try { return localStorage.getItem('albasar_supabase_anon_key') || SUPABASE_ANON_KEY_VALUE; } catch { return SUPABASE_ANON_KEY_VALUE; }
  });
  const [testResult, setTestResult] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // Keep the latest close handler and busy flags in refs so the open/close
  // effect below only runs when the modal actually opens. Otherwise an inline
  // `onClose` prop from the parent would reset the tab and wipe the password
  // on every parent re-render.
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  const testingRef = useRef(testing);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);
  useEffect(() => { testingRef.current = testing; }, [testing]);

  useEffect(() => {
    if (!isOpen) return;

    setMode('signin');
    setErrorMessage('');
    setInfoMessage('');
    setShowPassword(false);
    setSubmitting(false);
    setTesting(false);
    setTestResult(null);
    setPassword('');
    const timer = window.setTimeout(() => emailRef.current?.focus(), 60);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current && !testingRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveOverrides = () => {
    setSupabaseLocalOverrides(urlOverride, keyOverride);
    setTestResult('تم حفظ الإعدادات محلياً. أعد تحميل الصفحة لتطبيقها.');
  };

  const handleTestConnection = async () => {
    if (!isOnline) { setTestResult('لا يوجد اتصال بالإنترنت'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const { testSupabaseConnection } = await import('../utils/supabaseClient');
      const diag = await testSupabaseConnection(urlOverride, keyOverride);
      if (diag.ok) {
        setTestResult(`✅ HTTP ${diag.status ?? ''} — ${diag.message}`);
      } else {
        const code = diag.code ? ` (${diag.code})` : '';
        const details = diag.details ? ` — ${diag.details}` : '';
        const hint = diag.hint ? ` — hint: ${diag.hint}` : '';
        setTestResult(`❌ HTTP ${diag.status ?? ''}${code}: ${diag.message}${details}${hint}`);
      }
    } catch (e) {
      setTestResult(`❌ خطأ: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  const switchMode = (nextMode: CloudAuthMode) => {
    if (submitting) return;
    setMode(nextMode);
    setErrorMessage('');
    setInfoMessage('');
    setPassword('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !isOnline) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setErrorMessage('⚠️ يجب أن يتكون الرمز السري من 6 أحرف أو أرقام على الأقل.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      const { signInToCloud, signUpToCloud } = await import('../utils/supabaseAuth');

      if (mode === 'signup') {
        const result = await signUpToCloud(trimmedEmail, password);
        setPassword('');
        if (result.alreadyRegistered) {
          setMode('signin');
          setErrorMessage('⚠️ هذا البريد الإلكتروني مسجل مسبقاً. استخدم تبويب «تسجيل الدخول» أو استعد كلمة المرور من لوحة Supabase.');
          return;
        }
        if (result.needsEmailConfirmation || !result.user) {
          setMode('signin');
          setInfoMessage('✅ تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول من هنا.');
          return;
        }
        onSignedIn(result.user);
        return;
      }
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
              <h2 id="cloud-auth-title">
                {mode === 'signin' ? 'تسجيل دخول الفاحص' : 'إنشاء حساب فاحص جديد'}
              </h2>
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

        <form className="auth-dialog__body" onSubmit={handleSubmit} noValidate>
          <div className="auth-tabs" role="tablist" aria-label="تسجيل الدخول أو إنشاء حساب">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`auth-tab ${mode === 'signin' ? 'is-active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              إنشاء حساب جديد
            </button>
          </div>

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
            <span>Supabase URL</span>
            <span className="auth-input">
              <input dir="ltr" value={urlOverride} onChange={e => setUrlOverride(e.target.value)} placeholder="https://your-project.supabase.co" />
            </span>
          </label>
          <label className="auth-field">
            <span>Anon Key</span>
            <span className="auth-input">
              <input dir="ltr" value={keyOverride} onChange={e => setKeyOverride(e.target.value)} placeholder="sb_publishable_..." />
            </span>
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button type="button" className="m3-btn" onClick={handleSaveOverrides}>حفظ الإعدادات محلياً</button>
            <button type="button" className="m3-btn" onClick={handleTestConnection} disabled={testing || !isOnline}>
              {testing ? 'جاري الفحص…' : '🔍 فحص الاتصال الآن'}
            </button>
          </div>
          {testResult && <p className="auth-dialog__hint" style={{ whiteSpace: 'pre-wrap' }}>{testResult}</p>}

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
            <span>{mode === 'signup' ? 'الرمز السري (6 أحرف أو أرقام على الأقل)' : 'كلمة المرور'}</span>
            <span className="auth-input">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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

          {infoMessage && (
            <p className="auth-dialog__info" role="status">
              {infoMessage}
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
            <span>
              {submitting
                ? (mode === 'signup' ? 'جارٍ إنشاء الحساب…' : 'جارٍ التحقق…')
                : (mode === 'signup' ? 'إنشاء الحساب' : 'تسجيل الدخول')}
            </span>
          </button>

          <p className="auth-dialog__hint">
            {mode === 'signup'
              ? 'يُنشئ هذا الحساب فاحصاً جديداً في Supabase Auth. قد يطلب المشرف تأكيد البريد الإلكتروني قبل أول تسجيل دخول.'
              : 'تُنشأ الحسابات أيضاً من مشرف النظام عبر Authentication -> Users في لوحة Supabase. تبقى السجلات على هذا الجهاز حتى بعد تسجيل الخروج.'}
          </p>
        </form>

        <button
          type="button"
          className="auth-bypass"
          onClick={onContinueWithoutAccount}
          disabled={submitting}
        >
          ⚡ المتابعة والمزامنة السريعة بكود الفاحص فقط (بدون بريد إلكتروني)
        </button>
      </section>
    </div>
  );
};
