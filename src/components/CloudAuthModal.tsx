import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UserPlus,
  X,
} from 'lucide-react';

import type { CloudAuthUser } from '../utils/supabaseAuth';
import {
  findLocalAccount,
  getOrCreateDeviceId,
  registerLocalAccount,
  saveExaminerProfile,
} from '../utils/examinerProfile';

interface CloudAuthModalProps {
  isOpen: boolean;
  isOnline: boolean;
  /** Dismiss the modal and keep working fully offline. */
  onClose: () => void;
  /** Fired for server-backed AND locally persisted accounts. */
  onSignedIn: (user: CloudAuthUser) => void;
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
    return '⚠️ هذا البريد الإلكتروني مسجل مسبقاً. سجّل الدخول من التبويب الأول.';
  }
  if (code === 'signup_disabled' || /signups? (are )?disabled|signup is disabled/i.test(message)) {
    return '⚠️ إنشاء الحسابات الجديدة معطّل في إعدادات Supabase Auth. اطلب من المشرف إنشاء الحساب.';
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
}) => {
  const [mode, setMode] = useState<CloudAuthMode>('signin');
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const identifierRef = useRef<HTMLInputElement>(null);

  // Keep the latest close handler and busy flag in refs so the open/close
  // effect below only runs when the modal actually opens. Otherwise an inline
  // `onClose` prop from the parent would reset the tab and wipe the password
  // on every parent re-render.
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  useEffect(() => {
    if (!isOpen) return;

    setMode('signin');
    setErrorMessage('');
    setInfoMessage('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitting(false);
    setPassword('');
    setConfirmPassword('');
    const timer = window.setTimeout(() => identifierRef.current?.focus(), 60);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const switchMode = (nextMode: CloudAuthMode) => {
    if (submitting) return;
    setMode(nextMode);
    setErrorMessage('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  /** Persist the identity locally so the examiner is never blocked. */
  const persistLocalIdentity = (name: string, email: string): CloudAuthUser => {
    const deviceId = getOrCreateDeviceId();
    saveExaminerProfile({ fullName: name, email, deviceId });
    if (email) registerLocalAccount({ fullName: name, email });
    return { id: `local-${deviceId}`, email: email || null, fullName: name || null };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedIdentifier = identifier.trim();
    const trimmedName = fullName.trim();

    if (mode === 'signup') {
      if (trimmedName.split(/\s+/).filter(Boolean).length < 3) {
        setErrorMessage('⚠️ أدخل الاسم الثلاثي الكامل (مثال: أحمد محمد علي).');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier)) {
        setErrorMessage('⚠️ صيغة البريد الإلكتروني غير صحيحة — مثال صحيح: name@example.com');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('⚠️ يجب أن يتكون الرمز السري من 6 أحرف أو أرقام على الأقل.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('⚠️ تأكيد الرمز السري غير مطابق.');
        return;
      }
    } else {
      if (!trimmedIdentifier || !password) {
        setErrorMessage('أدخل البريد الإلكتروني (أو اسم المستخدم) والرمز السري.');
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');

    // Sign-in accepts the email or a username known on this device.
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
    const localAccount = looksLikeEmail ? null : findLocalAccount(trimmedIdentifier);
    const resolvedEmail = looksLikeEmail
      ? trimmedIdentifier
      : localAccount?.email ?? trimmedIdentifier;

    try {
      // Offline-first: keep the examiner working locally and sync later.
      if (!isOnline) {
        const localUser = persistLocalIdentity(
          trimmedName || localAccount?.fullName || '',
          resolvedEmail,
        );
        setInfoMessage('✅ حُفظت بياناتك على هذا الجهاز. المزامنة السحابية عند عودة الشبكة.');
        onSignedIn(localUser);
        return;
      }

      const { signInToCloud, signUpToCloud } = await import('../utils/supabaseAuth');

      if (mode === 'signup') {
        const result = await signUpToCloud(trimmedIdentifier, password, trimmedName);
        setPassword('');
        setConfirmPassword('');
        if (result.alreadyRegistered) {
          setMode('signin');
          setErrorMessage('⚠️ هذا البريد الإلكتروني مسجل مسبقاً. سجّل الدخول من التبويب الأول.');
          return;
        }
        // The account exists on the server; the local identity is persisted
        // immediately so a pending email confirmation never blocks fieldwork.
        const localUser = persistLocalIdentity(trimmedName, trimmedIdentifier);
        if (result.needsEmailConfirmation || !result.user) {
          setInfoMessage('✅ تم إنشاء الحساب. سيُفعّل المزامنة بعد تأكيد البريد الإلكتروني.');
          onSignedIn({ ...localUser, id: result.user?.id ?? localUser.id });
          return;
        }
        onSignedIn({ ...result.user, fullName: result.user.fullName ?? trimmedName });
        return;
      }

      const user = await signInToCloud(resolvedEmail, password);
      setPassword('');
      const name = user.fullName?.trim() || localAccount?.fullName || trimmedName;
      persistLocalIdentity(name, user.email ?? resolvedEmail);
      onSignedIn({ ...user, fullName: name || null });
    } catch (error) {
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = mode === 'signup' ? 'تأكيد وإنشاء الحساب' : 'دخول';

  return (
    <div
      className="feedback-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="auth-dialog auth-dialog--minimal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-auth-title"
      >
        <header className="auth-dialog__header">
          <div className="auth-dialog__heading">
            <span className="auth-dialog__icon" aria-hidden="true">
              <ShieldCheck size={20} />
            </span>
            <div className="auth-dialog__titles">
              <h2 id="cloud-auth-title">حساب الفاحص</h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-action shrink-0"
            onClick={onClose}
            disabled={submitting}
            aria-label="متابعة بدون تسجيل دخول"
            title="متابعة بدون تسجيل دخول"
          >
            <X size={18} aria-hidden="true" />
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

          {mode === 'signup' && (
            <label className="auth-field">
              <span>الاسم الثلاثي الكامل</span>
              <span className="auth-input">
                <UserRound size={17} aria-hidden="true" />
                <input
                  type="text"
                  name="full_name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="أحمد محمد علي"
                  autoComplete="name"
                  disabled={submitting}
                  required
                />
              </span>
            </label>
          )}

          <label className="auth-field">
            <span>{mode === 'signup' ? 'البريد الإلكتروني' : 'البريد الإلكتروني أو اسم المستخدم'}</span>
            <span className="auth-input">
              <Mail size={17} aria-hidden="true" />
              <input
                ref={identifierRef}
                type={mode === 'signup' ? 'email' : 'text'}
                name="email"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
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
            <span>الرمز السري</span>
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
                aria-label={showPassword ? 'إخفاء الرمز السري' : 'إظهار الرمز السري'}
                aria-pressed={showPassword}
                disabled={submitting}
              >
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </span>
          </label>

          {mode === 'signup' && (
            <label className="auth-field">
              <span>تأكيد الرمز السري</span>
              <span className="auth-input">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm_password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  dir="ltr"
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="auth-input__toggle"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'إخفاء تأكيد الرمز السري' : 'إظهار تأكيد الرمز السري'}
                  aria-pressed={showConfirmPassword}
                  disabled={submitting}
                >
                  {showConfirmPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </span>
            </label>
          )}

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
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <RefreshCw size={18} className="spin" aria-hidden="true" />
            ) : (
              mode === 'signup'
                ? <UserPlus size={18} aria-hidden="true" />
                : <LogIn size={18} aria-hidden="true" />
            )}
            <span>{submitting ? 'جاري المعالجة…' : submitLabel}</span>
          </button>
        </form>

        <button
          type="button"
          className="auth-dialog__skip"
          onClick={onClose}
          disabled={submitting}
        >
          متابعة بدون تسجيل دخول
        </button>
      </section>
    </div>
  );
};
