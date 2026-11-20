import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { CalibrationData } from '../types';
import { SNELLEN_LADDER, LOGMAR_MAP, UNTTESTABLE_ACUITY_LABEL, getOptotypePixelSize } from '../utils/acuityMath';
import { useFeedback } from './FeedbackProvider';
import { WashoutTimer } from './WashoutTimer';

type ChartMode = 'HOTV' | 'TUMBLING_E';

interface AdaptiveAcuityProps {
  calibration: CalibrationData;
  smartOd: string;
  setSmartOd: (val: string) => void;
  smartOs: string;
  setSmartOs: (val: string) => void;
  smartTimeSec: number;
  setSmartTimeSec: (sec: number) => void;
  smartExaminerId: string;
  setSmartExaminerId: (id: string) => void;
  smartExaminerLocked: boolean;
  onSmartTestStarted: (eye: 'OD' | 'OS') => void;
  onSmartTestCompleted: () => void;
  onProceedToBiometry: () => void;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
}

const HOTV_LETTERS = ['H', 'O', 'T', 'V'] as const;

const playTone = (frequency: number, duration = 0.08, volume = 0.03) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
    oscillator.onended = () => context.close();
  } catch {}
};

/** Pleasant high confirmation chime for every recorded response. */
const playResponseChime = () => playTone(1046.5, 0.07, 0.03);

/** Distinct two-note chime when an eye is completed. */
const playEyeCompletedChime = () => {
  playTone(784, 0.1, 0.035);
  window.setTimeout(() => playTone(1174.7, 0.16, 0.04), 115);
};

export const AdaptiveAcuityStation: React.FC<AdaptiveAcuityProps> = ({
  calibration,
  smartOd,
  setSmartOd,
  smartOs,
  setSmartOs,
  smartTimeSec,
  setSmartTimeSec,
  smartExaminerId,
  setSmartExaminerId,
  smartExaminerLocked,
  onSmartTestStarted,
  onSmartTestCompleted,
  onProceedToBiometry,
  chartMode,
  onChartModeChange,
}) => {
  const { notify } = useFeedback();
  const [activeEye, setActiveEye] = useState<'OD' | 'OS' | 'COMPLETED'>(smartOd && smartOs ? 'COMPLETED' : 'OD');
  const [stepIndex, setStepIndex] = useState<number>(0);
  /** Highest ladder line the child has passed (index into SNELLEN_LADDER). */
  const [highestPassedIdx, setHighestPassedIdx] = useState<number | null>(null);
  /** Lowest ladder line the child has failed (index into SNELLEN_LADDER). */
  const [lowestFailedIdx, setLowestFailedIdx] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<number>(0);
  const [targetLetter, setTargetLetter] = useState<string>('H');
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [isTrainingMode, setIsTrainingMode] = useState<boolean>(false);
  const [feedbackEffect, setFeedbackEffect] = useState<'correct' | 'wrong' | null>(null);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [clinicalFullscreen, setClinicalFullscreen] = useState<boolean>(false);
  const [swipeLetter, setSwipeLetter] = useState<string>('H');
  const [swipeArmed, setSwipeArmed] = useState<boolean>(false);
  const mode = chartMode;
  const timerStartRef = useRef<number>(0);
  const touchStartRef = useRef<{x: number; y: number} | null>(null);

  useEffect(() => {
    if (!clinicalFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [clinicalFullscreen]);

  useEffect(() => {
    if (activeEye === 'COMPLETED' && clinicalFullscreen) setClinicalFullscreen(false);
  }, [activeEye, clinicalFullscreen]);

  /**
   * Picks the next optotype.
   *
   * The new letter / E orientation is **always strictly different** from the
   * previous one so a young child sees a visible change on every single trial
   * (a repeated target would let the child answer from memory instead of reading).
   */
  const pickRandomTarget = useCallback(() => {
    setOrientation((current) => {
      const angles = [0, 90, 180, 270];
      const options = angles.filter((angle) => angle !== current);
      return options[Math.floor(Math.random() * options.length)];
    });
    setTargetLetter((current) => {
      const options = HOTV_LETTERS.filter((letter) => letter !== current);
      return options[Math.floor(Math.random() * options.length)];
    });
  }, []);

  const startEyeTest = (eye: 'OD' | 'OS', isAutomaticTransition = false) => {
    if (smartExaminerLocked && !isAutomaticTransition) {
      notify('بدأت المحطة الرقمية بالفعل؛ لا يمكن إعادة تشغيلها دون إنشاء سجل جديد.', 'error');
      return;
    }
    setActiveEye(eye);
    setStepIndex(0);
    setCorrectCount(0);
    setAttemptCount(0);
    setHighestPassedIdx(null);
    setLowestFailedIdx(null);
    setIsTrainingMode(false);
    pickRandomTarget();
    onSmartTestStarted(eye);
    if (!timerActive) {
      timerStartRef.current = performance.now() - smartTimeSec * 1000;
      setTimerActive(true);
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => {
        const elapsed = (performance.now() - timerStartRef.current) / 1000;
        setSmartTimeSec(+elapsed.toFixed(1));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerActive, setSmartTimeSec]);

  useEffect(() => {
    pickRandomTarget();
  }, [pickRandomTarget]);

  useEffect(() => {
    if (!smartOd && !timerActive && activeEye !== 'COMPLETED') {
      startEyeTest('OD', false);
    }
  }, []);

  const concludeEye = (thresholdSnellen: string) => {
    playEyeCompletedChime();
    navigator.vibrate?.([40, 60, 40]);
    if (activeEye === 'OD') {
      setSmartOd(thresholdSnellen);
      notify(`اكتملت العين اليمنى: ${thresholdSnellen}. ننتقل إلى العين اليسرى.`, 'success');
      startEyeTest('OS', true);
    } else if (activeEye === 'OS') {
      setSmartOs(thresholdSnellen);
      setActiveEye('COMPLETED');
      setTimerActive(false);
      onSmartTestCompleted();
      notify(`اكتمل فحص العينين: اليمنى ${smartOd || 'غير مسجلة'}، اليسرى ${thresholdSnellen}.`, 'success');
    }
  };

  // WHO (2025) code 88: an untestable child is a mandatory referral. This is a
  // direct one-tap field action; the value remains per-eye and is saved in the
  // existing Smart_Snellen fields without changing the SPSS schema.
  const recordUntestable = () => {
    if (activeEye === 'COMPLETED') return;
    navigator.vibrate?.([40, 60, 40]);
    playEyeCompletedChime();
    if (activeEye === 'OD') {
      setSmartOd(UNTTESTABLE_ACUITY_LABEL);
      notify('سُجّل رمز 88 للعين اليمنى (إحالة وجوبية). ننتقل إلى العين اليسرى.', 'info');
      startEyeTest('OS', true);
    } else {
      setSmartOs(UNTTESTABLE_ACUITY_LABEL);
      setActiveEye('COMPLETED');
      setTimerActive(false);
      onSmartTestCompleted();
      notify('سُجّل رمز 88 للعين اليسرى. اكتمل فحص العينين (إحالة وجوبية وفق WHO 2025).', 'info');
    }
  };

  /**
   * Adaptive staircase scoring (WHO 2025 / SPIRIT protocol).
   *
   * The previous implementation could oscillate forever between two adjacent
   * lines whenever the child's true threshold lay between them (for example a
   * child who passes 6/18 but fails 6/12: the old code walked 6/18 → 6/12 → 6/18
   * → 6/12 without ever terminating).
   *
   * The fix tracks the bracket explicitly:
   *  - `highestPassedIdx`: the best (smallest) line index the child has passed.
   *  - `lowestFailedIdx`: the worst (largest) line index the child has failed.
   *
   * As soon as the two brackets touch, the threshold is known and the eye is
   * concluded immediately with the best line actually passed.
   */
  const scoreAnswer = (isCorrect: boolean) => {
    if (isTrainingMode) {
      pickRandomTarget();
      return;
    }
    const newAttempts = attemptCount + 1;
    const newCorrect = isCorrect ? correctCount + 1 : correctCount;
    setAttemptCount(newAttempts);
    if (isCorrect) setCorrectCount(newCorrect);

    const lastIndex = SNELLEN_LADDER.length - 1;

    if (isCorrect && newCorrect >= 2) {
      // ---------- The line was PASSED ----------
      const nextHighestPassed = Math.max(highestPassedIdx ?? -1, stepIndex);
      setHighestPassedIdx(nextHighestPassed);

      if (stepIndex === lastIndex) {
        // 6/6 reached - nothing better exists on the ladder.
        setCorrectCount(0);
        setAttemptCount(0);
        concludeEye(SNELLEN_LADDER[stepIndex].snellen);
        return;
      }

      if (lowestFailedIdx !== null && stepIndex + 1 >= lowestFailedIdx) {
        // The bracket closed: this line is the best one the child can read.
        setCorrectCount(0);
        setAttemptCount(0);
        concludeEye(SNELLEN_LADDER[stepIndex].snellen);
        return;
      }

      let nextIdx: number;
      if (lowestFailedIdx === null) {
        // Fast-track only while the ladder is still unknown.
        if (stepIndex === 0) nextIdx = 4;
        else if (stepIndex === 4) nextIdx = 7;
        else nextIdx = Math.min(stepIndex + 1, lastIndex);
      } else {
        nextIdx = Math.min(stepIndex + 1, lastIndex);
      }

      if (nextIdx !== stepIndex) {
        setStepIndex(nextIdx);
        setCorrectCount(0);
        setAttemptCount(0);
      }
      pickRandomTarget();
      return;
    }

    if (!isCorrect && newAttempts - newCorrect >= 2) {
      // ---------- The line was FAILED ----------
      const nextLowestFailed = Math.min(lowestFailedIdx ?? Number.MAX_SAFE_INTEGER, stepIndex);
      setLowestFailedIdx(nextLowestFailed);

      if (stepIndex === 0) {
        // The chart floor was failed twice.
        setCorrectCount(0);
        setAttemptCount(0);
        concludeEye('أقل من 6/60');
        return;
      }

      if (highestPassedIdx !== null && stepIndex - 1 <= highestPassedIdx) {
        // The bracket closed: the best passed line is the threshold.
        setCorrectCount(0);
        setAttemptCount(0);
        concludeEye(SNELLEN_LADDER[highestPassedIdx].snellen);
        return;
      }

      const nextIdx = stepIndex - 1;
      setStepIndex(nextIdx);
      setCorrectCount(0);
      setAttemptCount(0);
      pickRandomTarget();
      return;
    }

    // The line is not yet decisive: keep testing on the same line.
    if (!isCorrect) setCorrectCount(0);
    pickRandomTarget();
  };

  const flashFeedback = (isCorrect: boolean) => {
    setFeedbackEffect(isCorrect ? 'correct' : 'wrong');
    window.setTimeout(() => setFeedbackEffect(null), 260);
  };

  const handleResponse = (chosenAngle: number) => {
    if (activeEye === 'COMPLETED' && !isTrainingMode) return;
    navigator.vibrate?.(20);
    const isCorrect = chosenAngle === orientation;
    playResponseChime();
    flashFeedback(isCorrect);
    scoreAnswer(isCorrect);
  };

  const handleLetterResponse = (letter: string) => {
    if (activeEye === 'COMPLETED' && !isTrainingMode) return;
    navigator.vibrate?.(20);
    const isCorrect = letter === targetLetter;
    playResponseChime();
    flashFeedback(isCorrect);
    scoreAnswer(isCorrect);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && clinicalFullscreen) {
        e.preventDefault();
        setClinicalFullscreen(false);
        return;
      }
      const target = e.target;
      if (target instanceof HTMLElement && target.closest('input, select, textarea, button, [contenteditable="true"]')) return;
      if (!timerActive && !isTrainingMode) return;
      if (activeEye === 'COMPLETED' && !isTrainingMode) return;
      if (mode === 'HOTV') {
        const key = e.key.toUpperCase();
        if (HOTV_LETTERS.includes(key as any)) {
          e.preventDefault();
          handleLetterResponse(key);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleResponse(0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleResponse(90);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleResponse(180);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleResponse(270);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEye, isTrainingMode, timerActive, mode, orientation, targetLetter, attemptCount, correctCount, stepIndex, highestPassedIdx, lowestFailedIdx, clinicalFullscreen]);

  const currentStep = SNELLEN_LADDER[stepIndex];
  const renderedSizePx = getOptotypePixelSize(currentStep, calibration.pxPerMM, calibration.testingDistanceMeters ?? 2.0);
  const progressPercent = Math.min(100, Math.round((stepIndex / (SNELLEN_LADDER.length - 1)) * 100));

  const eyeLabel = activeEye === 'OD' ? 'العين اليمنى · OD' : activeEye === 'OS' ? 'العين اليسرى · OS' : 'اكتمل';

  const cycleSwipeLetter = (direction: 1 | -1) => {
    const index = HOTV_LETTERS.indexOf(swipeLetter as (typeof HOTV_LETTERS)[number]);
    const nextIndex = (index + direction + HOTV_LETTERS.length) % HOTV_LETTERS.length;
    setSwipeLetter(HOTV_LETTERS[nextIndex]);
    setSwipeArmed(true);
    playTone(659.3, 0.04, 0.018);
    navigator.vibrate?.(10);
  };

  const handleStageTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleStageTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    touchStartRef.current = null;
    if (Math.max(absX, absY) < 30) return;

    if (mode === 'TUMBLING_E') {
      const angle = absX > absY ? (dx > 0 ? 0 : 180) : (dy > 0 ? 90 : 270);
      handleResponse(angle);
      return;
    }

    // HOTV: horizontal swipes arm the next letter, upward swipe confirms it.
    if (absX > absY) {
      cycleSwipeLetter(dx > 0 ? 1 : -1);
      return;
    }
    if (dy < 0 && swipeArmed) {
      handleLetterResponse(swipeLetter);
      setSwipeArmed(false);
      return;
    }
    setSwipeArmed(false);
  };

  return (
    <div className={`who-eyes-step2 min-h-screen bg-neutral-950 text-white flex flex-col${clinicalFullscreen ? ' is-clinical-fullscreen' : ''}`}>
      {/* Top bar */}
      <header className="acuity-header flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="pill flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Eye size={14} /> {eyeLabel}
          </span>
          <span className="progress-pill bg-white/5 px-3 py-1.5 rounded-full text-xs">
            خطوة {Math.min(stepIndex + 1, SNELLEN_LADDER.length)} / {SNELLEN_LADDER.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mandatory 2-minute accommodative washout; non-blocking helper for the nursing team. */}
          <WashoutTimer variant="dark" />
          <button
            type="button"
            onClick={() => onChartModeChange(mode === 'TUMBLING_E' ? 'HOTV' : 'TUMBLING_E')}
            disabled={smartExaminerLocked}
            className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold disabled:opacity-40"
          >
            {mode === 'TUMBLING_E' ? 'حرف E' : 'أحرف HOTV'}
          </button>
          <button
            type="button"
            onClick={() => setClinicalFullscreen((value) => !value)}
            className="acuity-fullscreen-toggle"
            aria-pressed={clinicalFullscreen}
          >
            <Maximize2 size={15} aria-hidden="true" />
            <span>ملء الشاشة</span>
          </button>
        </div>
      </header>

      {/* Non-blocking calibration advisory (WHO 2025: optotype size needs a calibrated screen). */}
      {!calibration.isCalibrated && (
        <div className="acuity-calibration-badge" role="status" aria-live="polite">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>⚠️ يُنصح بمعايرة شاشة هذا الهاتف من لوحة المشرف لدقة مقاس الحروف.</span>
        </div>
      )}
      {/* Setup / Completed */}
      {activeEye === 'COMPLETED' ? (
        <div className="flex-1 grid place-items-center text-center p-8">
          <div>
            <h2 className="text-2xl font-extrabold">اكتمل فحص العينين</h2>
            <p className="mt-2 text-sm text-white/60">اليمنى {smartOd || '—'} · اليسرى {smartOs || '—'}</p>
            <button
              type="button"
              onClick={onProceedToBiometry}
              style={{ color: '#000', backgroundColor: '#fff' }}
              className="mt-6 px-4 py-2 rounded-lg font-bold"
            >
              الانتقال إلى فحص العين
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Center Stage */}
          <main className="acuity-main flex-1 grid place-items-center bg-white">
            <div
              className={`optotype-stage acuity-stage ${feedbackEffect ? 'is-' + feedbackEffect : ''}`}
              onTouchStart={handleStageTouchStart}
              onTouchEnd={handleStageTouchEnd}
            >
              <div className="acuity-stage-hud">
                <span className="acuity-hud-eye"><Eye size={13} aria-hidden="true" /> {eyeLabel}</span>
                <span
                  className="acuity-progress-dots"
                  aria-label={`تقدم القياس ${stepIndex + 1} من ${SNELLEN_LADDER.length}`}
                >
                  {SNELLEN_LADDER.map((step, index) => (
                    <i
                      key={step.snellen}
                      className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : ''}
                    />
                  ))}
                </span>
                <span className="acuity-hud-mode">{mode === 'HOTV' ? 'HOTV' : 'Tumbling E'}</span>
              </div>

              {clinicalFullscreen && (
                <button
                  type="button"
                  className="acuity-fullscreen-exit"
                  onClick={() => setClinicalFullscreen(false)}
                  aria-label="الخروج من ملء الشاشة السريري"
                >
                  <Minimize2 size={15} aria-hidden="true" />
                  خروج
                </button>
              )}

              <div
                className="optotype-holder"
                style={{ width: renderedSizePx, height: renderedSizePx }}
              >
                {mode === 'HOTV' ? (
                  <span className="hotv-letter" style={{ fontSize: renderedSizePx * 0.9, lineHeight: 1, color: '#000' }}>
                    {targetLetter}
                  </span>
                ) : (
                  <div style={{ width: '100%', height: '100%', transform: `rotate(${orientation}deg)` }}>
                    <svg viewBox="0 0 5 5" className="w-full h-full" aria-label="E">
                      <path d="M0,0 H5 V1 H1 V2 H4 V3 H1 V4 H5 V5 H0 Z" fill="#000"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className="acuity-stage-foot">
                {mode === 'TUMBLING_E'
                  ? 'اسحب على المسرح باتجاه فتحة E، أو استخدم الأزرار الكبيرة.'
                  : swipeArmed
                    ? `اخترت الحرف ${swipeLetter} — اسحب لأعلى للتأكيد، أو المس الزر مباشرة.`
                    : 'اسحب يميناً/يساراً لاختيار الحرف ثم لأعلى للتأكيد، أو المس الحرف المطابق.'}
              </div>
            </div>
          </main>

          {/* Bottom Pad */}
          <footer className="acuity-pad p-4 bg-neutral-950">
            <button
              type="button"
              onClick={recordUntestable}
              className="acuity-88-btn"
              title="WHO 2025: طفل غير قابل للفحص = إحالة وجوبية (رمز 88)"
            >
              <AlertTriangle size={17} aria-hidden="true" />
              ⚠️ الطفل غير متعاون (كود 88 — إحالة وجوبية)
            </button>

            <div className="acuity-response-pad">
              {mode === 'HOTV' ? (
                <div className="grid grid-cols-4 gap-3">
                  {HOTV_LETTERS.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => handleLetterResponse(l)}
                      style={{ color: '#000', fontSize: '2.25rem', lineHeight: 1, fontWeight: 900 }}
                      className="acuity-response-btn h-24 rounded-2xl bg-white font-black active:scale-95"
                      aria-label={`تسجيل الحرف ${l}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div />
                  <button type="button" aria-label="أعلى" onClick={() => handleResponse(270)} style={{ color: '#000', fontSize: '2.5rem', lineHeight: 1 }} className="acuity-response-btn h-24 rounded-2xl bg-white">▲</button>
                  <div />
                  <button type="button" aria-label="يسار" onClick={() => handleResponse(180)} style={{ color: '#000', fontSize: '2.5rem', lineHeight: 1 }} className="acuity-response-btn h-24 rounded-2xl bg-white">◀</button>
                  <div className="h-24 grid place-items-center text-white/40 text-xs">اتجاه الفتحة</div>
                  <button type="button" aria-label="يمين" onClick={() => handleResponse(0)} style={{ color: '#000', fontSize: '2.5rem', lineHeight: 1 }} className="acuity-response-btn h-24 rounded-2xl bg-white">▶</button>
                  <div />
                  <button type="button" aria-label="أسفل" onClick={() => handleResponse(90)} style={{ color: '#000', fontSize: '2.5rem', lineHeight: 1 }} className="acuity-response-btn h-24 rounded-2xl bg-white">▼</button>
                  <div />
                </div>
              )}
            </div>
          </footer>
        </>
      )}

    </div>
  );
};
