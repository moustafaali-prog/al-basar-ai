import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

type NoticeTone = 'success' | 'error' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackContextValue {
  notify: (message: string, tone?: NoticeTone) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
}

interface NoticeState {
  id: number;
  message: string;
  tone: NoticeTone;
}

interface PendingConfirmation extends ConfirmOptions {
  resolve: (accepted: boolean) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const useFeedback = (): FeedbackContextValue => {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider');
  return context;
};

export const FeedbackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const noticeSequence = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const notify = useCallback((message: string, tone: NoticeTone = 'info') => {
    noticeSequence.current += 1;
    setNotice({ id: noticeSequence.current, message, tone });
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmation({ ...options, resolve });
  }), []);

  const finishConfirmation = useCallback((accepted: boolean) => {
    setConfirmation((current) => {
      current?.resolve(accepted);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => {
      setNotice((current) => current?.id === notice.id ? null : current);
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!confirmation) return;
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finishConfirmation(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmation, finishConfirmation]);

  const NoticeIcon = notice?.tone === 'success'
    ? CheckCircle2
    : notice?.tone === 'error'
      ? AlertCircle
      : Info;

  return (
    <FeedbackContext.Provider value={{ notify, confirmAction }}>
      {children}

      {notice && (
        <div className={`feedback-toast feedback-toast--${notice.tone}`} role="status" aria-live="polite">
          <NoticeIcon aria-hidden="true" size={20} />
          <p>{notice.message}</p>
          <button type="button" className="feedback-toast__close" aria-label="إغلاق التنبيه" onClick={() => setNotice(null)}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {confirmation && (
        <div
          className="feedback-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finishConfirmation(false);
          }}
        >
          <section className="feedback-dialog" role="alertdialog" aria-modal="true" aria-labelledby="feedback-dialog-title" aria-describedby="feedback-dialog-message">
            <div className={`feedback-dialog__icon${confirmation.danger ? ' is-danger' : ''}`}>
              <TriangleAlert size={23} aria-hidden="true" />
            </div>
            <h2 id="feedback-dialog-title">{confirmation.title}</h2>
            <p id="feedback-dialog-message">{confirmation.message}</p>
            <div className="feedback-dialog__actions">
              <button type="button" className="feedback-button feedback-button--quiet" onClick={() => finishConfirmation(false)}>
                {confirmation.cancelLabel ?? 'إلغاء'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`feedback-button${confirmation.danger ? ' feedback-button--danger' : ' feedback-button--primary'}`}
                onClick={() => finishConfirmation(true)}
              >
                {confirmation.confirmLabel ?? 'تأكيد'}
              </button>
            </div>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};
