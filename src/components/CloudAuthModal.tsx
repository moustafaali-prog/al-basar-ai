import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Fingerprint,
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
  loadExaminerProfile,
  registerLocalAccount,
  saveExaminerProfile,
  setRememberMe,
} from '../utils/examinerProfile';
import {
  clearBiometricCredential,
  getBiometricBinding,
  isBiometricAvailable,
  registerBiometricCredential,
  verifyBiometricUnlock,
} from '../utils/biometricAuth';

interface CloudAuthModalProps {
  isOpen: boolean;
  isOnline: boolean;
  /**
   * Startup-gate mode: the screen blocks the workflow until the examiner
   * signs in, unlocks with a biometric, or explicitly continues offline.
   */
  isGate?: boolean;
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
  isGate = false,
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
  /** "Keep me signed in on this device" — on by default. */
  const [rememberMe, setRememberMeState] = useState(true);
  /** Opt-in toggle shown after a successful sign-in. */
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricPrompting, setBiometricPrompting] = useState(false);
  const [biometricBinding, setBiometricBinding] = useState(() => getBiometricBinding());
  /** Set after a successful sign-in so the screen can offer biometric enrolment. */
  const [postSignInUser, setPostSignInUser] = useState<CloudAuthUser | null>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Keep the latest close handler and busy flag in refs so the open/close
  // effect below only runs when the modal actually opens. Otherwise an inline
  // `onClose` prop from the parent would reset the tab and wipe the password
  // on every parent re-render.
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  // Detect the platform authenticator once, when the screen opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setBiometricBinding(getBiometricBinding());
    void isBiometricAvailable().then((available) => {
      if (!cancelled) setBiometricAvailable(available);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

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
    setBiometricEnabled(false);
    setPostSignInUser(null);
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

  /** Live confirmation-password match indicator. */
  const passwordMismatch = useMemo(
    () => mode === 'signup' && confirmPassword.length > 0 && confirmPassword !== password,
    [mode, confirmPassword, password],
  );

  if (!isOpen) return null;

  const switchMode = (nextMode: CloudAuthMode) => {
    if (submitting) return;
    setMode(nextMode);
    setErrorMessage('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
    setBiometricEnabled(false);
  };

  /**
   * Persist the identity locally so the examiner is never blocked.
   *
   * The role is **never** chosen here — it is either copied from the server
   * JWT (`app_metadata.role`) or defaults to the least-privilege `examiner`.
   */
  const persistLocalIdentity = (
    name: string,
    email: string,
    userId = '',
    role: 'admin' | 'examiner' = 'examiner',
  ): CloudAuthUser => {
    const deviceId = getOrCreateDeviceId();
    saveExaminerProfile({ fullName: name, email, deviceId, userId, rememberMe, role });
    if (email) registerLocalAccount({ fullName: name, email });
    return {
      id: userId || `local-${deviceId}`,
      email: email || null,
      fullName: name || null,
      role,
    };
  };

  /**
   * Enrols the device's fingerprint / Face ID for one-tap unlocking.
   * The OS prompt is the only thing that can produce the credential.
   */
  const enableBiometric = async (user: CloudAuthUser) => {
    setBiometricPrompting(true);
    setErrorMessage('');
    try {
      const ok = await registerBiometricCredential(
        user.id || user.email || 'albasar-examiner',
        user.fullName || user.email || 'فاحص',
      );
      if (ok) {
        setBiometricBinding(getBiometricBinding());
        setBiometricEnabled(true);
        setInfoMessage('✅ تم تفعيل الدخول بالبصمة على هذا الجهاز.');
      } else {
        setBiometricEnabled(false);
        setInfoMessage('تعذّر تفعيل البصمة على هذا الجهاز — يمكنك المحاولة لاحقاً من إعدادات الحساب.');
      }
    } finally {
      setBiometricPrompting(false);
    }
  };

  /**
   * One-tap biometric unlock. Works completely offline because the assertion is
   * produced by the device's own secure hardware.
   */
  const handleBiometricUnlock = async () => {
    if (biometricPrompting) return;
    setBiometricPrompting(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      const verified = await verifyBiometricUnlock();
      if (!verified) {
        setErrorMessage('⚠️ لم يتم تأكيد البصمة. حاول مرة أخرى أو سجّل الدخول بالرمز السري.');
        return;
      }
      const binding = getBiometricBinding();
      const stored = loadExaminerProfile();
      const fullName = binding?.displayName?.trim() || stored?.fullName?.trim() || '';
      const email = stored?.email?.trim() || '';
      const user: CloudAuthUser = {
        id: binding?.userId || stored?.userId || `local-${getOrCreateDeviceId()}`,
        email: email || null,
        fullName: fullName || null,
        role: stored?.role ?? 'examiner',
      };
      persistLocalIdentity(fullName, user.email ?? '', user.id, user.role);
      onSignedIn(user);
      // The biometric is already enrolled — no enrolment panel needed.
      onClose();
    } finally {
      setBiometricPrompting(false);
    }
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
    const localAccount = findLocalAccount(trimmedIdentifier);
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
        setPostSignInUser(localUser);
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
        const localUser = persistLocalIdentity(
          trimmedName,
          trimmedIdentifier,
          result.user?.id ?? '',
          result.user?.role ?? 'examiner',
        );
        if (result.needsEmailConfirmation || !result.user) {
          setInfoMessage('✅ تم إنشاء الحساب. سيُفعّل المزامنة بعد تأكيد البريد الإلكتروني.');
          setPostSignInUser(localUser);
          onSignedIn(localUser);
          return;
        }
        const signedIn: CloudAuthUser = { ...result.user, fullName: result.user.fullName ?? trimmedName };
        setPostSignInUser(signedIn);
        onSignedIn(signedIn);
        return;
      }

      const user = await signInToCloud(resolvedEmail, password);
      setPassword('');
      const name = user.fullName?.trim() || localAccount?.fullName || trimmedName;
      persistLocalIdentity(name, user.email ?? resolvedEmail, user.id, user.role);
      const signedIn = { ...user, fullName: name || null };
      setPostSignInUser(signedIn);
      onSignedIn(signedIn);
    } catch (error) {
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  /** Keeps the "remember me" preference in sync with the checkbox. */
  const handleRememberMeChange = (next: boolean) => {
    setRememberMeState(next);
    setRememberMe(next);
  };

  const submitLabel = mode === 'signup' ? 'إنشاء الحساب والدخول' : 'دخول';
  const hasBinding = Boolean(biometricBinding);

  /* ---------------- Post sign-in: biometric enrolment ---------------- */
  if (postSignInUser) {
    return (
      <div
        className={`feedback-dialog-backdrop auth-gate-backdrop${isGate ? ' is-gate' : ''}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) onClose();
        }}
      >
        <section
          className="auth-dialog auth-dialog--minimal auth-dialog--gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cloud-auth-success"
        >
          <header className="auth-dialog__header">
            <div className="auth-dialog__heading">
              <span className="auth-dialog__icon auth-dialog__icon--pass" aria-hidden="true">
                <ShieldCheck size={20} />
              </span>
              <div className="auth-dialog__titles">
                <h2 id="cloud-auth-success">تم تسجيل الدخول</h2>
                <p>{postSignInUser.fullName || postSignInUser.email || 'حساب الفاحص'}</p>
              </div>
            </div>
          </header>

          <div className="auth-dialog__body">
            <p className="auth-dialog__info" role="status">
              ✅ الجلسة جاهزة. يمكنك الآن تفعيل الدخول بالبصمة لتسريع الفتح في الزيارات القادمة.
            </p>

            {biometricAvailable ? (
              <button
                type="button"
                className={`auth-biometric-toggle${biometricEnabled ? ' is-on' : ''}`}
                onClick={() => {
                  if (biometricEnabled) {
                    clearBiometricCredential();
                    setBiometricBinding(null);
                    setBiometricEnabled(false);
                    setInfoMessage('تم إلغاء ربط البصمة من هذا الجهاز.');
                    return;
                  }
                  void enableBiometric(postSignInUser);
                }}
                disabled={biometricPrompting}
                aria-pressed={biometricEnabled}
              >
                <Fingerprint size={17} aria-hidden="true" />
                <span>
                  {biometricPrompting
                    ? 'جارٍ انتظار تأكيد الجهاز…'
                    : biometricEnabled
                      ? '🔐 البصمة مفعّلة على هذا الجهاز (اضغط للإلغاء)'
                      : '🔐 تفعيل الدخول بالبصمة على هذا الجهاز'}
                </span>
              </button>
            ) : (
              <p className="auth-dialog__hint">
                هذا الجهاز لا يدعم البصمة — سيُحفظ تسجيل الدخول بالرمز السري فقط.
              </p>
            )}

            {infoMessage && (
              <p className="auth-dialog__info" role="status">
                {infoMessage}
              </p>
            )}

            <button
              type="button"
              className="m3-btn m3-btn--primary m3-btn--block auth-dialog__submit"
              onClick={onClose}
              disabled={submitting || biometricPrompting}
            >
              <LogIn size={18} aria-hidden="true" />
              <span>متابعة إلى الفحص</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`feedback-dialog-backdrop auth-gate-backdrop${isGate ? ' is-gate' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting && !isGate) onClose();
      }}
    >
      <section
        className={`auth-dialog auth-dialog--minimal${isGate ? ' auth-dialog--gate' : ''}`}
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
              <h2 id="cloud-auth-title">
                {isGate ? 'تسجيل الدخول' : 'حساب الفاحص'}
              </h2>
              <p>
                {isGate
                  ? 'افتح جلسة الفحص الخاصة بك على هذا الجهاز.'
                  : 'اربط حسابك بالمشرف لمزامنة السجلات.'}
              </p>
            </div>
          </div>
          {!isGate && (
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
          )}
        </header>

        {/* ---- One-tap biometric unlock (top of the screen) ---- */}
        {hasBinding && (
          <button
            type="button"
            className="auth-biometric-button"
            onClick={() => void handleBiometricUnlock()}
            disabled={submitting || biometricPrompting}
            aria-busy={biometricPrompting}
          >
            <span className="auth-biometric-button__icon" aria-hidden="true">
              {biometricPrompting
                ? <RefreshCw size={22} className="spin" />
                : <Fingerprint size={22} />}
            </span>
            <span className="auth-biometric-button__copy">
              <strong>👆 تسجيل الدخول بالبصمة</strong>
              <small>افتح قفل الجهاز ببصمة الإصبع أو الوجه — يعمل بدون إنترنت</small>
            </span>
          </button>
        )}

        {hasBinding && <div className="auth-divider"><span>أو</span></div>}

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
                  name="name"
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
                name={mode === 'signup' ? 'email' : 'username'}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="examiner@example.org"
                autoComplete={mode === 'signup' ? 'email' : 'username'}
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
                minLength={mode === 'signup' ? 6 : undefined}
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
              <span className={`auth-input${passwordMismatch ? ' is-invalid' : ''}`}>
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  ref={confirmPasswordRef}
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
              {passwordMismatch && (
                <small className="auth-field__error" role="alert">الرمزان غير متطابقين</small>
              )}
            </label>
          )}

          {mode === 'signin' && (
            <label className="auth-checkline">
              <input
                type="checkbox"
                name="remember_me"
                checked={rememberMe}
                onChange={(event) => handleRememberMeChange(event.target.checked)}
                disabled={submitting}
              />
              <span>البقاء مسجلاً على هذا الجهاز</span>
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
          {isGate ? 'المتابعة محلياً بدون حساب' : 'متابعة بدون تسجيل دخول'}
        </button>
      </section>
    </div>
  );
};
