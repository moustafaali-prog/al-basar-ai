import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Timer, X } from 'lucide-react';
import { useFeedback } from './FeedbackProvider';

/**
 * Mandatory 2-minute accommodative washout period between the two acuity
 * stations (SPIRIT-AI / WHO 2025 protocol). Non-blocking by design: starting
 * the countdown never disables inputs or navigates the user anywhere.
 */
interface WashoutTimerProps {
  /** 'light' fits the standard M3 cards; 'dark' fits the full-screen acuity station. */
  variant?: 'light' | 'dark';
}

const WASHOUT_SECONDS = 120;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function playCompletionChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.52);
    oscillator.onended = () => context.close();
  } catch {}
}

export const WashoutTimer: React.FC<WashoutTimerProps> = ({ variant = 'light' }) => {
  const { notify } = useFeedback();
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(WASHOUT_SECONDS);
  const [isComplete, setIsComplete] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0 && !completedRef.current) {
        completedRef.current = true;
        setIsComplete(true);
        setEndAt(null);
        playCompletionChime();
        navigator.vibrate?.([60, 80, 60]);
        notify('اكتملت فترة الراحة البصرية (دقيقتان). يمكن متابعة الفحص.', 'success');
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [endAt, notify]);

  const toggleTimer = useCallback(() => {
    if (endAt !== null) {
      setEndAt(null);
      return;
    }
    completedRef.current = false;
    setIsComplete(false);
    setRemainingSec(WASHOUT_SECONDS);
    setEndAt(performance.now() + WASHOUT_SECONDS * 1000);
  }, [endAt]);

  const resetTimer = useCallback(() => {
    setEndAt(null);
    completedRef.current = false;
    setIsComplete(false);
    setRemainingSec(WASHOUT_SECONDS);
  }, []);

  const isRunning = endAt !== null;

  const toneClass = variant === 'dark'
    ? 'bg-white/10 text-white border-white/20 hover:bg-white/20'
    : 'border-[var(--m3-border)] text-[var(--m3-on-surface)] hover:bg-[color-mix(in_srgb,var(--m3-primary)_8%,transparent)]';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${toneClass}`}
      role="timer"
      aria-live="off"
      aria-label="مؤقت الراحة البصرية دقيقتان"
    >
      {isRunning ? (
        <>
          <Timer size={14} aria-hidden="true" className={variant === 'dark' ? '' : 'text-[var(--m3-primary)]'} />
          <span className="font-mono tabular-nums min-w-[2.5rem] text-center">{formatCountdown(remainingSec)}</span>
          <button
            type="button"
            onClick={toggleTimer}
            className="inline-flex items-center gap-1 underline underline-offset-2"
            aria-label="إيقاف المؤقت مؤقتاً"
          >
            <Pause size={12} aria-hidden="true" /> إيقاف
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="inline-flex items-center"
            aria-label="إلغاء المؤقت والبدء من جديد"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </>
      ) : isComplete ? (
        <>
          <span aria-hidden="true">✅</span>
          <span>اكتملت الراحة البصرية (دقيقتان)</span>
          <button
            type="button"
            onClick={resetTimer}
            className="inline-flex items-center gap-1 underline underline-offset-2"
            aria-label="إعادة ضبط المؤقت"
          >
            إعادة
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={toggleTimer}
          className="inline-flex items-center gap-1.5 font-bold"
          aria-label="بدء مؤقت الراحة البصرية لدقيقتين"
        >
          <Play size={13} aria-hidden="true" />
          ⏱️ مؤقت الراحة البصرية - دقيقتان Washout
        </button>
      )}
    </div>
  );
};
