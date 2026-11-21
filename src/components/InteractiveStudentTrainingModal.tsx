import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import {
  DECISION_PRACTICE_CASES,
  FIELD_SCENARIOS,
  TRAINING_STAGES,
  type DecisionPracticeCase,
  type FieldScenario,
} from './trainingContent';
import { TRAINING_CSS } from './trainingStyles';
import { classifyClinicalDecision } from '../utils/acuityMath';

interface TrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TrainingMode = 'walkthrough' | 'scenarios' | 'decision' | 'resources';
type DecisionOutcome = 'MODEL_PRIORITY' | 'MODEL_REVIEW' | 'MODEL_NO_FLAG';

interface OutcomeOption {
  value: DecisionOutcome;
  label: string;
  shortLabel: string;
  tone: 'urgent' | 'review' | 'pass';
}

const OUTCOME_OPTIONS: OutcomeOption[] = [
  {
    value: 'MODEL_PRIORITY',
    label: 'إحالة عاجلة — طبيب عيون خلال 48 ساعة',
    shortLabel: 'إحالة خلال 48 ساعة',
    tone: 'urgent',
  },
  {
    value: 'MODEL_REVIEW',
    label: 'مراجعة — المركز الصحي خلال أسبوعين',
    shortLabel: 'مراجعة خلال أسبوعين',
    tone: 'review',
  },
  {
    value: 'MODEL_NO_FLAG',
    label: 'لا توجد إشارة ضمن حدود النموذج',
    shortLabel: 'لا توجد إشارة',
    tone: 'pass',
  },
];

const outcomeOption = (value: DecisionOutcome): OutcomeOption =>
  OUTCOME_OPTIONS.find((option) => option.value === value) ?? OUTCOME_OPTIONS[2];

const scenarioNarration = (scenario: FieldScenario) =>
  `${scenario.title}. الموقف: ${scenario.situation} القاعدة: ${scenario.rule} التطبيق: ${scenario.click} ${scenario.tip}`;

const classifyPracticeCase = (practiceCase: DecisionPracticeCase) =>
  classifyClinicalDecision(
    practiceCase.smartOd,
    practiceCase.smartOs,
    practiceCase.hirschbergMM,
    practiceCase.mrd1MM,
    practiceCase.asthenopiaScore,
    {
      paperOd: practiceCase.paperOd,
      paperOs: practiceCase.paperOs,
      externalEyeFindings: practiceCase.externalEyeFindings,
      whoPreScreen: {
        diabetes: practiceCase.diabetes ? 'YES' : 'NO',
        eyePainOrSevereItch: practiceCase.eyePain ? 'YES' : 'NO',
        childAssent: 'YES',
      },
    },
  );

const formatFinding = (finding: string): string => {
  const labels: Record<string, string> = {
    LEUKOCORIA: 'انعكاس حدقي أبيض أو غير طبيعي',
    CORNEAL_HAZINESS: 'عتامة أو تندب القرنية',
    SCLERAL_REDNESS: 'احمرار ملتحمة حاد أو إفرازات قيحية',
    ANISOCORIA: 'تفاوت واضح في حجم الحدقتين',
    EYE_MISALIGNMENT: 'انحراف أو حول ظاهر بالعين المجردة',
  };
  return labels[finding] ?? finding;
};

export const InteractiveStudentTrainingModal: React.FC<TrainingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<TrainingMode>('walkthrough');
  const [stageIndex, setStageIndex] = useState(0);
  const [openScenarios, setOpenScenarios] = useState<string[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [practiceCaseIndex, setPracticeCaseIndex] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<DecisionOutcome | null>(null);
  const [answerChecked, setAnswerChecked] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [speechSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  const stage = TRAINING_STAGES[stageIndex];
  const practiceCase = DECISION_PRACTICE_CASES[practiceCaseIndex];
  const engineResult = useMemo(
    () => classifyPracticeCase(practiceCase),
    [practiceCase],
  );
  const actualOutcome = outcomeOption(engineResult.urgency);
  const selectedOption = selectedOutcome ? outcomeOption(selectedOutcome) : null;
  const isPracticeCorrect = selectedOutcome === engineResult.urgency;
  const stageSpeechId = `stage-${stage.id}`;

  const stopSpeech = useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [speechSupported]);

  const speak = useCallback(
    (text: string, id: string) => {
      if (!speechSupported || !ttsEnabled) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice =
        voices.find((voice) => /^ar[-_]IQ/i.test(voice.lang)) ||
        voices.find((voice) => /^ar[-_]SA/i.test(voice.lang)) ||
        voices.find((voice) => /^ar/i.test(voice.lang));
      if (arabicVoice) utterance.voice = arabicVoice;
      utterance.lang = arabicVoice?.lang || 'ar-SA';
      utterance.rate = 0.92;
      utterance.pitch = 1;
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    },
    [speechSupported, ttsEnabled],
  );

  const toggleVoice = () => {
    if (!speechSupported) return;
    if (ttsEnabled) stopSpeech();
    setTtsEnabled((current) => !current);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    stopSpeech();
    setSpeakingId(null);
  }, [stageIndex, isOpen, stopSpeech]);

  useEffect(() => {
    if (!isOpen) return;
    stopSpeech();
    setSpeakingId(null);
  }, [mode, isOpen, stopSpeech]);

  useEffect(
    () => () => {
      if (speechSupported) window.speechSynthesis.cancel();
    },
    [speechSupported],
  );

  if (!isOpen) return null;

  const toggleScenario = (scenarioId: string) => {
    setOpenScenarios((current) =>
      current.includes(scenarioId)
        ? current.filter((id) => id !== scenarioId)
        : [...current, scenarioId],
    );
    stopSpeech();
  };

  const checkPracticeAnswer = () => {
    if (!selectedOutcome || answerChecked) return;
    setAnswerChecked(true);
    setAnsweredCount((count) => count + 1);
    if (selectedOutcome === engineResult.urgency) {
      setPracticeScore((score) => score + 1);
    }
  };

  const goToPracticeCase = (index: number) => {
    setPracticeCaseIndex(index);
    setSelectedOutcome(null);
    setAnswerChecked(false);
    stopSpeech();
  };

  const resetPractice = () => {
    setPracticeCaseIndex(0);
    setSelectedOutcome(null);
    setAnswerChecked(false);
    setPracticeScore(0);
    setAnsweredCount(0);
    stopSpeech();
  };

  const voiceHint = !speechSupported
    ? 'هذا الجهاز لا يدعم القراءة الصوتية. اقرأ النص مباشرة أو استخدم قارئ الشاشة.'
    : !ttsEnabled
      ? 'الصوت مكتوم. فعّله من أعلى النافذة لسماع التوجيه.'
      : 'القراءة الصوتية تعمل داخل الجهاز، بلا ملفات صوتية خارجية.';

  const stageNarration = `${stage.narration} الخطوات: ${stage.steps.join(' ')}`;

  return (
    <div
      className="train-overlay"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <style>{TRAINING_CSS}</style>
      <section
        className="train-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interactive-training-title"
      >
        <header className="train-header">
          <div className="train-header__identity">
            <div className="train-header__mark" aria-hidden="true">
              <ClipboardCheck size={25} />
            </div>
            <div className="train-header__copy">
              <h2 id="interactive-training-title">مركز تدريب الفاحصين</h2>
              <p>8 وحدات ميدانية · 7 حالات · 12 تمرين قرار · لقطات حقيقية من التطبيق</p>
            </div>
          </div>
          <div className="train-header__actions">
            <button
              type="button"
              className={`train-voice-toggle${ttsEnabled ? ' is-on' : ''}`}
              onClick={toggleVoice}
              disabled={!speechSupported}
              aria-pressed={ttsEnabled}
              title={speechSupported ? 'تشغيل أو كتم القراءة الصوتية' : 'القراءة الصوتية غير مدعومة'}
            >
              {speechSupported && ttsEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              <span>{speechSupported && ttsEnabled ? 'الصوت مفعّل' : 'الصوت مكتوم'}</span>
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className="train-close"
              onClick={onClose}
              aria-label="إغلاق مركز التدريب"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="train-modebar">
          <div className="train-modes" role="tablist" aria-label="أقسام مركز التدريب">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'walkthrough'}
              className={mode === 'walkthrough' ? 'is-active' : ''}
              onClick={() => setMode('walkthrough')}
            >
              <BookOpen size={15} /> الجولة
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'scenarios'}
              className={mode === 'scenarios' ? 'is-active' : ''}
              onClick={() => setMode('scenarios')}
            >
              <Lightbulb size={15} /> حالات ميدانية
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'decision'}
              className={mode === 'decision' ? 'is-active' : ''}
              onClick={() => setMode('decision')}
            >
              <Target size={15} /> اختبر قرارك
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'resources'}
              className={mode === 'resources' ? 'is-active' : ''}
              onClick={() => setMode('resources')}
            >
              <Eye size={15} /> مرجع سريع
            </button>
          </div>
          {mode === 'scenarios' && (
            <button
              type="button"
              className="train-reset"
              onClick={() => {
                setOpenScenarios([]);
                stopSpeech();
              }}
            >
              <RotateCcw size={14} /> إعادة
            </button>
          )}
          {mode === 'decision' && (
            <div className="train-score" aria-live="polite">
              {answeredCount} إجابة · {practiceScore} صحيحة
            </div>
          )}
        </div>

        <div className="train-body">
          {mode === 'walkthrough' && (
            <>
              <nav className="train-rail" aria-label="وحدات الجولة">
                {TRAINING_STAGES.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`train-rail__item${index === stageIndex ? ' is-active' : ''}${index < stageIndex ? ' is-done' : ''}`}
                    onClick={() => setStageIndex(index)}
                    aria-current={index === stageIndex ? 'step' : undefined}
                  >
                    <span className="train-rail__num">{index < stageIndex ? <Check size={13} /> : index + 1}</span>
                    <span className="train-rail__label">{item.short}</span>
                  </button>
                ))}
              </nav>

              <article className="train-stage">
                <header className="train-stage__head">
                  <span className="train-stage__badge">{stage.station}</span>
                  <div className="train-stage__heading">
                    <h3>{stage.title}</h3>
                    <p>{stage.subtitle}</p>
                  </div>
                </header>

                <div className="train-stage__grid">
                  <figure className="train-shot">
                    <div className="train-shot__frame">
                      <img
                        src={`${import.meta.env.BASE_URL}${stage.screenshot}`}
                        alt={stage.screenshotAlt}
                        loading="lazy"
                      />
                    </div>
                    <figcaption>
                      <CheckCircle2 size={14} aria-hidden="true" />
                      لقطة حقيقية من التطبيق الحالي
                    </figcaption>
                  </figure>

                  <div className="train-coach">
                    <div className="train-voice">
                      <div className="train-voice__label">
                        <Sparkles size={16} aria-hidden="true" />
                        <span>التوجيه المختصر</span>
                      </div>
                      <p className="train-voice__text">{stage.narration}</p>
                      <div className="train-voice__actions">
                        <button
                          type="button"
                          className="train-speak-btn"
                          onClick={() =>
                            speakingId === stageSpeechId
                              ? stopSpeech()
                              : speak(stageNarration, stageSpeechId)
                          }
                          disabled={!ttsEnabled || !speechSupported}
                        >
                          {speechSupported ? <Volume2 size={15} /> : <VolumeX size={15} />}
                          {speakingId === stageSpeechId ? 'أوقف القراءة' : 'اسمع التوجيه والخطوات'}
                        </button>
                        {speakingId && speakingId !== stageSpeechId && (
                          <button type="button" className="train-speak-btn train-speak-btn--ghost" onClick={stopSpeech}>
                            إيقاف
                          </button>
                        )}
                      </div>
                      <p className="train-voice__hint">{voiceHint}</p>
                    </div>

                    <section className="train-block">
                      <h4><ClipboardCheck size={16} /> ماذا تفعل؟</h4>
                      <ol className="train-step-list">
                        {stage.steps.map((step, index) => (
                          <li key={step}>
                            <span>{index + 1}</span>
                            <p>{step}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  </div>
                </div>

                <div className="train-stage__lower">
                  <section className="train-block train-block--warn">
                    <h4><AlertTriangle size={16} /> لا تخلط بين هذه القواعد</h4>
                    <ul className="train-attention-list">
                      {stage.attention.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                  <section className="train-block train-block--pass">
                    <h4><CheckCircle2 size={16} /> قبل أن تنتقل</h4>
                    <ul className="train-check-list">
                      {stage.checklist.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                </div>

                <div className="train-stage__nav">
                  <button
                    type="button"
                    className="train-nav-btn"
                    onClick={() => setStageIndex((index) => Math.max(0, index - 1))}
                    disabled={stageIndex === 0}
                  >
                    <ChevronRight size={16} /> الوحدة السابقة
                  </button>
                  <span className="train-stage__progress">الوحدة {stageIndex + 1} من {TRAINING_STAGES.length}</span>
                  {stageIndex < TRAINING_STAGES.length - 1 ? (
                    <button
                      type="button"
                      className="train-nav-btn train-nav-btn--primary"
                      onClick={() => setStageIndex((index) => Math.min(TRAINING_STAGES.length - 1, index + 1))}
                    >
                      الوحدة التالية <ChevronLeft size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="train-nav-btn train-nav-btn--primary"
                      onClick={() => setMode('decision')}
                    >
                      اختبر قرارك الآن <Target size={16} />
                    </button>
                  )}
                </div>
              </article>
            </>
          )}

          {mode === 'scenarios' && (
            <div className="train-scenarios">
              <div className="train-scenarios__head">
                <div className="train-scenarios__intro">
                  <h3>حالات واقعية: ماذا تفعل الآن؟</h3>
                  <p>اقرأ الموقف والقاعدة أولاً. خمّن الإجراء، ثم افتح الحل وقارنه بخطوات التطبيق.</p>
                </div>
                <span className="train-score">
                  {openScenarios.length} / {FIELD_SCENARIOS.length} مكشوفة
                </span>
              </div>

              <div className="train-scenario-grid">
                {FIELD_SCENARIOS.map((scenario, index) => {
                  const isOpen = openScenarios.includes(scenario.id);
                  const scenarioSpeechId = `scenario-${scenario.id}`;
                  return (
                    <article key={scenario.id} className={`train-scenario${isOpen ? ' is-open' : ''}`}>
                      <button
                        type="button"
                        className="train-scenario__head"
                        onClick={() => toggleScenario(scenario.id)}
                        aria-expanded={isOpen}
                        aria-controls={`scenario-body-${scenario.id}`}
                      >
                        <span className="train-scenario__emoji" aria-hidden="true">{scenario.emoji}</span>
                        <span className="train-scenario__titles">
                          <strong>{index + 1}. {scenario.title}</strong>
                          <small>{scenario.tag}</small>
                        </span>
                        <span className="train-scenario__chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                      </button>

                      <div className="train-scenario__body" id={`scenario-body-${scenario.id}`}>
                        <figure className="train-scenario__evidence">
                          <img
                            src={`${import.meta.env.BASE_URL}${scenario.screenshot}`}
                            alt={scenario.screenshotAlt}
                            loading="lazy"
                          />
                          <figcaption>دليل مرئي من التطبيق الحالي</figcaption>
                        </figure>
                        <section className="train-scenario__block train-scenario__block--a">
                          <span>الموقف</span>
                          <p>{scenario.situation}</p>
                        </section>
                        <section className="train-scenario__block train-scenario__block--b">
                          <span>القاعدة</span>
                          <p>{scenario.rule}</p>
                        </section>

                        {isOpen ? (
                          <div className="train-scenario__answer">
                            <section className="train-scenario__block train-scenario__block--c">
                              <span>الإجراء الصحيح</span>
                              <p>{scenario.click}</p>
                            </section>
                            <section className="train-scenario__block train-scenario__block--d">
                              <span>نصيحة ميدانية</span>
                              <p>{scenario.tip}</p>
                            </section>
                            <button
                              type="button"
                              className="train-scenario__speak"
                              onClick={() =>
                                speakingId === scenarioSpeechId
                                  ? stopSpeech()
                                  : speak(scenarioNarration(scenario), scenarioSpeechId)
                              }
                              disabled={!ttsEnabled || !speechSupported}
                            >
                              <Volume2 size={14} /> اسمع الحالة كاملة
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="train-reveal" onClick={() => toggleScenario(scenario.id)}>
                            خمّن الإجراء… ثم أظهر الحل
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'decision' && (
            <div className="train-practice">
              <div className="train-practice__head">
                <div>
                  <span className="train-kicker"><Target size={15} /> تمرين على محرك القرار الحقيقي</span>
                  <h3>اختر القرار الذي سيعرضه التطبيق</h3>
                  <p>لا توجد إجابات مكتوبة يدوياً. بعد اختيارك، يستدعي مركز التدريب دالة القرار نفسها المستخدمة في حفظ السجل، ثم يقارن النتيجة.</p>
                </div>
                <div className="train-score train-score--large">
                  <Trophy size={16} /> {practiceScore} / {answeredCount}
                </div>
              </div>

              <nav className="train-case-nav" aria-label="حالات تمرين القرار">
                {DECISION_PRACTICE_CASES.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={index === practiceCaseIndex ? 'is-active' : ''}
                    onClick={() => goToPracticeCase(index)}
                    aria-label={`الحالة ${index + 1}: ${item.title}`}
                    aria-current={index === practiceCaseIndex ? 'step' : undefined}
                  >
                    {index + 1}
                  </button>
                ))}
              </nav>

              <article className="train-case-card">
                <header>
                  <span>الحالة {practiceCaseIndex + 1} من {DECISION_PRACTICE_CASES.length}</span>
                  <h4>{practiceCase.title}</h4>
                  <p>{practiceCase.story}</p>
                </header>

                <div className="train-case-inputs">
                  <div><small>رقمي OD / OS</small><strong dir="ltr">{practiceCase.smartOd} / {practiceCase.smartOs}</strong></div>
                  <div><small>ورقي OD / OS</small><strong dir="ltr">{practiceCase.paperOd} / {practiceCase.paperOs}</strong></div>
                  <div><small>Hirschberg</small><strong>{practiceCase.hirschbergMM.toFixed(2)} mm</strong></div>
                  <div><small>MRD₁</small><strong>{practiceCase.mrd1MM.toFixed(1)} mm</strong></div>
                  <div><small>الإجهاد</small><strong>{practiceCase.asthenopiaScore} / 5</strong></div>
                  <div><small>علامات / فرز</small><strong>{practiceCase.externalEyeFindings.map(formatFinding).join('، ') || 'لا شيء'}{practiceCase.diabetes ? ' · سكري' : ''}{practiceCase.eyePain ? ' · ألم حاد' : ''}</strong></div>
                </div>

                <div className="train-outcome-picker" role="radiogroup" aria-label="القرار المتوقع">
                  {OUTCOME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selectedOutcome === option.value}
                      className={`train-outcome train-outcome--${option.tone}${selectedOutcome === option.value ? ' is-selected' : ''}`}
                      onClick={() => {
                        if (answerChecked) return;
                        setSelectedOutcome(option.value);
                      }}
                      disabled={answerChecked}
                    >
                      <span className="train-outcome__radio" aria-hidden="true">{selectedOutcome === option.value && <Check size={13} />}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>

                {!answerChecked ? (
                  <button
                    type="button"
                    className="train-check-answer"
                    onClick={checkPracticeAnswer}
                    disabled={!selectedOutcome}
                  >
                    <ClipboardCheck size={17} /> تحقق من قراري
                  </button>
                ) : (
                  <div className={`train-verdict train-verdict--${actualOutcome.tone}`} role="status" aria-live="polite">
                    <div className="train-verdict__head">
                      {isPracticeCorrect ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                      <div>
                        <span>{isPracticeCorrect ? 'إجابة صحيحة' : 'راجع السبب'}</span>
                        <strong>{actualOutcome.label}</strong>
                      </div>
                    </div>
                    <p>{engineResult.detailsAr}</p>
                    <small>إجابتك: {selectedOption?.shortLabel}.</small>
                  </div>
                )}

                <div className="train-case-actions">
                  <button
                    type="button"
                    className="train-nav-btn"
                    onClick={() => goToPracticeCase((practiceCaseIndex - 1 + DECISION_PRACTICE_CASES.length) % DECISION_PRACTICE_CASES.length)}
                  >
                    <ChevronRight size={16} /> الحالة السابقة
                  </button>
                  <button type="button" className="train-reset" onClick={resetPractice}>
                    <RotateCcw size={14} /> من البداية
                  </button>
                  <button
                    type="button"
                    className="train-nav-btn train-nav-btn--primary"
                    onClick={() => goToPracticeCase((practiceCaseIndex + 1) % DECISION_PRACTICE_CASES.length)}
                  >
                    الحالة التالية <ChevronLeft size={16} />
                  </button>
                </div>
              </article>
            </div>
          )}

          {mode === 'resources' && (
            <div className="train-resources">
              <div className="train-resources__head">
                <span className="train-kicker"><BookOpen size={15} /> مرجع مركز التدريب</span>
                <h3>أدلة وروابط ووقائع تشغيل</h3>
                <p>ملخص واضح لما هو منفذ في التطبيق، مع روابط المراجع الرسمية.</p>
              </div>

              <div className="train-resource-grid">
                <a
                  className="train-resource-card train-resource-card--feature"
                  href={`${import.meta.env.BASE_URL}guide.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="train-resource-card__icon" aria-hidden="true"><BookOpen size={21} /></span>
                  <div>
                    <strong>الدليل المصور الكامل</strong>
                    <small>يفتح في صفحة مستقلة، ويمكن حفظه أو طباعته من داخل الدليل.</small>
                  </div>
                </a>
                <a
                  className="train-resource-card"
                  href="https://iris.who.int/handle/10665/375590"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="train-resource-card__icon" aria-hidden="true"><Eye size={21} /></span>
                  <div>
                    <strong>WHO 2025 Vision Screening Implementation Handbook</strong>
                    <small>الدليل الرسمي لمنظمة الصحة العالمية للفحص المدرسي للبصر.</small>
                  </div>
                </a>
                <a
                  className="train-resource-card"
                  href="https://www.equator-network.org/reporting-guidelines/spirit-ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="train-resource-card__icon" aria-hidden="true"><ClipboardCheck size={21} /></span>
                  <div>
                    <strong>EQUATOR · SPIRIT-AI</strong>
                    <small>إرشادات إعداد تقارير البحوث السريرية المدعومة بالذكاء الاصطناعي.</small>
                  </div>
                </a>
                <a
                  className="train-resource-card"
                  href="https://www.equator-network.org/reporting-guidelines/stard-ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="train-resource-card__icon" aria-hidden="true"><Target size={21} /></span>
                  <div>
                    <strong>EQUATOR · STARD-AI</strong>
                    <small>معايير الإبلاغ عن دراسات دقة التشخيص بالذكاء الاصطناعي.</small>
                  </div>
                </a>
              </div>

              <div className="train-facts">
                <div><strong>يعمل دون إنترنت</strong><span>الحفظ المحلي متاح بعد فتح التطبيق؛ المزامنة تحتاج جلسة.</span></div>
                <div><strong>صور العين خاصة</strong><span>مسار الصورة داخل حسابك، والرابط الموقّع صالح لمدة ساعة.</span></div>
                <div><strong>السجلات مملوكة للحساب</strong><span>الفاحص يرى سجلاته فقط، بينما يرى المشرف جميع السجلات.</span></div>
                <div><strong>ليس تشخيصاً</strong><span>غياب إشارة النموذج لا ينفي وجود مشكلة بصرية.</span></div>
              </div>

              <p className="train-resources__note">
                هذه أداة فرز مدرسي وتوثيق بحثي. لا تستبدل تقييماً سريرياً مؤهلاً، ولا تشرح قراراً لا يظهر في التطبيق.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
