import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, X } from 'lucide-react';

import { verifyAdminPin } from '../utils/adminPin';

interface AdminPinGateProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired when the correct PIN was entered. */
  onUnlock: () => void;
}

/**
 * PIN gate in front of the supervisor Admin Drawer.
 *
 * The PIN is verified locally (SHA-256 digest comparison) so no code ever
 * leaves the device. Three failed attempts close the sheet — the examiner is
 * never trapped in a modal.
 */
export const AdminPinGate: React.FC<AdminPinGateProps> = ({ isOpen, onClose, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPin('');
    setError('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      const ok = await verifyAdminPin(pin);
      if (ok) {
        onUnlock();
        return;
      }
      setError('⚠️ الرمز غير صحيح. حاول مرة أخرى.');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="feedback-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !checking) onClose();
      }}
    >
      <section
        className="auth-dialog auth-dialog--minimal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-pin-title"
      >
        <header className="auth-dialog__header">
          <div className="auth-dialog__heading">
            <span className="auth-dialog__icon" aria-hidden="true">
              <ShieldCheck size={20} />
            </span>
            <div className="auth-dialog__titles">
              <h2 id="admin-pin-title">لوحة المشرف</h2>
              <p>أدخل رمز المشرف للمتابعة</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-action shrink-0"
            onClick={onClose}
            disabled={checking}
            aria-label="إغلاق"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form className="auth-dialog__body" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>رمز المشرف</span>
            <span className="auth-input">
              <KeyRound size={17} aria-hidden="true" />
              <input
                ref={inputRef}
                type="password"
                name="admin_pin"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="••••"
                autoComplete="off"
                inputMode="numeric"
                dir="ltr"
                maxLength={8}
                disabled={checking}
                required
              />
            </span>
          </label>

          {error && (
            <p className="auth-dialog__error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            className="m3-btn m3-btn--primary m3-btn--block auth-dialog__submit"
            disabled={checking || !pin}
            aria-busy={checking}
          >
            {checking
              ? <RefreshCw size={18} className="spin" aria-hidden="true" />
              : <ShieldCheck size={18} aria-hidden="true" />}
            <span>{checking ? 'جارٍ التحقق…' : 'فتح اللوحة'}</span>
          </button>
        </form>
      </section>
    </div>
  );
};
