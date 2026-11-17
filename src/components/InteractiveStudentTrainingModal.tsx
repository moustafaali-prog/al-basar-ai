import React, { useCallback, useEffect, useState } from 'react';

import {
  FIELD_SCENARIOS,
  TRAINING_STAGES,
  type FieldScenario,
} from './trainingContent';
import { TRAINING_CSS } from './trainingStyles';

interface TrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TrainingMode = 'walkthrough' | 'scenarios' | 'resources';

const scenarioNarration = (scenario: FieldScenario) =>
  `${scenario.title}. الموقف: ${scenario.situation} القاعدة: ${scenario.rule} التطبيق: ${scenario.click} ${scenario.tip}`;

/* ------------------------------------------------------------------ */
/* Mock app screens used behind the pulsing red annotations            */
/* ------------------------------------------------------------------ */
const MockStageScreen: React.FC<{ stage: number }> = ({ stage }) => {
  if (stage === 0) {
    return (
      <div className="train-app">
        <div className="train-app__status"><span>9:41</span><span>◉ ▮▮</span></div>
        <div className="train-app__head">
          <span className="train-app__eyebrow">الإعداد · مرة واحدة</span>
          <strong>معايرة الشاشة</strong>
        </div>
        <div className="train-id">
          <span className="train-id__flag" aria-hidden="true">🇮🇶</span>
          <div>
            <strong>البطاقة الوطنية العراقية</strong>
            <small>الجمهورية العراقية · الهوية الموحدة</small>
          </div>
          <span className="train-id__chip">ID</span>
        </div>
        <div className="train-ruler"><span>↔</span><b>85.60 mm</b><span>↔</span></div>
        <div className="train-checkrow"><span>مطابقة حافة البطاقة</span><span className="train-ok">✓</span></div>
        <div className="train-checkrow"><span>كثافة البكسل</span><span className="train-ok">✓</span></div>
        <div className="train-mockbtn">🔒 قفل المعايرة</div>
        <p className="train-app__note">تُقفل مرة واحدة لكل جهاز</p>
      </div>
    );
  }

  if (stage === 1) {
    return (
      <div className="train-app">
        <div className="train-app__status"><span>9:41</span><span>◉ ▮▮</span></div>
        <div className="train-app__head">
          <span className="train-app__eyebrow">المحطة أ · الاستقبال</span>
          <strong>التعريف والموافقة</strong>
        </div>
        <div className="train-field">
          <span>موافقة ولي الأمر</span>
          <span className="train-pill train-pill--ok">Parental_Consent = 1</span>
        </div>
        <div className="train-field"><span>رقم التلميذ</span><b className="train-code">BAB-101</b></div>
        <div className="train-field">
          <span>النظارة</span>
          <span className="train-seg"><i className="is-on">PVA</i><i>UVA</i></span>
        </div>
        <div className="train-who">
          <b>WHO pre-screen</b>
          <div className="train-chips"><span>رؤية</span><span>سمع</span><span>ألم</span><span>سكري</span></div>
        </div>
        <div className="train-route">
          <small>المسار التلقائي</small>
          <b>فردي: ورقي ← رقمي</b>
          <span>زوجي: رقمي ← ورقي</span>
        </div>
      </div>
    );
  }

  if (stage === 2) {
    return (
      <div className="train-app">
        <div className="train-app__status"><span>9:41</span><span>◉ ▮▮</span></div>
        <div className="train-app__head">
          <span className="train-app__eyebrow">المحطة ب · اللوحة الورقية</span>
          <strong>لوحة العينين</strong>
        </div>
        <div className="train-eye-row">
          <span className="train-eye-tag">OD</span><b>6/12</b><span className="train-locked">🔒 ***</span>
        </div>
        <div className="train-eye-row train-eye-row--muted">
          <span className="train-eye-tag">OS</span><b>—</b><span className="train-locked">بانتظار</span>
        </div>
        <div className="train-tools">
          <div>🧴<small>كحول 70%</small></div>
          <div>🕶️<small>غطاء معقّم</small></div>
        </div>
        <div className="train-timer">
          <span>WASHOUT TIMER</span><b>02:00</b>
          <div className="train-progress"><i /></div>
        </div>
        <p className="train-app__note">دقيقتان كاملتان قبل الفحص الرقمي</p>
      </div>
    );
  }

  if (stage === 3) {
    return (
      <div className="train-app">
        <div className="train-app__status"><span>9:41</span><span>◉ ▮▮</span></div>
        <div className="train-app__head">
          <span className="train-app__eyebrow">المحطة ج · الفحص التكيفي</span>
          <strong>فحص النظر الذكي</strong>
        </div>
        <div className="train-mode-toggle">
          <span className="is-on">HOTV</span>
          <span>Tumbling E</span>
        </div>
        <div className="train-age-row"><span>6 سنوات · صف 1 → HOTV</span><span>تلقائي</span></div>
        <div className="train-optotype">H</div>
        <div className="train-lapcard">🪪 بطاقة الحضن · Lap Card</div>
        <div className="train-stairs">
          <span className="is-fail">6/60</span><span>←</span>
          <span className="is-next">6/12</span><span>←</span><span>6/6</span>
        </div>
        <p className="train-app__note">لمس أعمى · بدون مساعدة</p>
      </div>
    );
  }

  if (stage === 4) {
    return (
      <div className="train-app">
        <div className="train-app__status"><span>9:41</span><span>◉ ▮▮</span></div>
        <div className="train-app__head">
          <span className="train-app__eyebrow">المحطة ج · الكاميرا</span>
          <strong>انعكاس القرنية</strong>
        </div>
        <div className="train-camera">
          <div className="train-face">
            <span className="train-face__eye train-face__eye--l" />
            <span className="train-face__eye train-face__eye--r"><b className="train-flash" /></span>
            <span className="train-face__nose" />
            <span className="train-face__mouth" />
          </div>
          <span className="train-camera__badge">Portrait · 1.0 m · ظهر الطفل للشباك</span>
        </div>
        <div className="train-quality">
          <span className="is-on">1 جيدة</span><span className="is-warn">2 إعادة</span><span>3 يدوي</span>
        </div>
        <div className="train-signs">
          <span>قشور/قيح الجفن</span><span>احمرار الصلبة</span>
          <span>إفرازات العين</span><span>عتامة القرنية</span>
        </div>
        <p className="train-app__note">AI_Quality_Flag · لا تحفظ صورة رديئة</p>
      </div>
    );
  }

  return (
    <div className="train-app">
      <div className="train-app__status"><span>9:41</span><span>◉ ▮▮</span></div>
      <div className="train-app__head">
        <span className="train-app__eyebrow">المحطة د · النتيجة</span>
        <strong>بطاقة ولي الأمر</strong>
      </div>
      <div className="train-parentcard">
        <span className="train-parentcard__tag">نسخة مموّهة Gaussian</span>
        <div className="train-blur-lines"><i /><i /><i /></div>
        <div className="train-parentcard__badges">
          <span>☀️ 90 دقيقة خارج</span><span>👀 20-20-20</span>
        </div>
      </div>
      <div className="train-audit">
        <small>Visit 2 · PHCC</small>
        <div className="train-audit__row"><span>FollowUp_Status</span><b>2</b></div>
        <div className="train-audit__row"><span>Gold_Standard_Confirmed</span><b>1</b></div>
        <div className="train-audit__row"><span>Spectacles_Prescribed_Fitted</span><b>1</b></div>
      </div>
      <div className="train-mockbtn">📤 تصدير البطاقة</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */
export const InteractiveStudentTrainingModal: React.FC<TrainingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<TrainingMode>('walkthrough');
  const [stageIndex, setStageIndex] = useState(0);
  const [activeCalloutId, setActiveCalloutId] = useState<string>(
    TRAINING_STAGES[0].callouts[0].id,
  );
  const [practiceMode, setPracticeMode] = useState(true);
  const [openScenarios, setOpenScenarios] = useState<string[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speechSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  const stage = TRAINING_STAGES[stageIndex];
  const activeCallout =
    stage.callouts.find((callout) => callout.id === activeCalloutId) ?? stage.callouts[0];
  const activeCalloutIndex = Math.max(
    0,
    stage.callouts.findIndex((callout) => callout.id === activeCallout.id),
  );
  const stageSpeechId = `stage-${stage.id}`;
  const revealedCount = openScenarios.length;

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

  /* Escape closes the dialog; the page behind stays put. */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  /* Reset the annotation and stop the previous narration when the station changes. */
  useEffect(() => {
    if (!isOpen) return;
    setActiveCalloutId(TRAINING_STAGES[stageIndex].callouts[0].id);
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [stageIndex, isOpen, speechSupported]);

  /* Never keep reading when switching modes or closing the modal. */
  useEffect(() => {
    if (!isOpen || !speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [mode, isOpen, speechSupported]);

  useEffect(() => {
    if (!isOpen && speechSupported) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
  }, [isOpen, speechSupported]);

  useEffect(
    () => () => {
      if (speechSupported) window.speechSynthesis.cancel();
    },
    [speechSupported],
  );

  if (!isOpen) return null;

  const handlePracticeToggle = () => {
    if (practiceMode) {
      setPracticeMode(false);
      setOpenScenarios(FIELD_SCENARIOS.map((scenario) => scenario.id));
    } else {
      setPracticeMode(true);
      setOpenScenarios([]);
    }
    stopSpeech();
  };

  const toggleScenario = (scenarioId: string) => {
    setOpenScenarios((current) =>
      current.includes(scenarioId)
        ? current.filter((id) => id !== scenarioId)
        : [...current, scenarioId],
    );
    stopSpeech();
  };

  const voiceHint = !speechSupported
    ? 'جهازك لا يدعم النطق الآلي بالعربية. اقرأ التوجيه بصوتك للطلبة، أو استخدم النص المكتوب.'
    : !ttsEnabled
      ? 'الصوت مكتوم مؤقتاً. فعّل زر 🔊 من أعلى النافذة إذا أردت سماع التوجيه.'
      : 'يمكنك الاستماع للتوجيه أو قراءته بصوتك. لا توجد ملفات صوتية خارجية، فكل شيء يعمل داخل الجهاز.';

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
            <div className="train-header__mark" aria-hidden="true">🎓</div>
            <div className="train-header__copy">
              <h2 id="interactive-training-title">دليل تدريب الطلبة التفاعلي</h2>
              <p>محاكي ميداني بصوت د. مصطفى · 6 محطات · 5 حالات WHO 2025</p>
            </div>
          </div>
          <div className="train-header__actions">
            <button
              type="button"
              className={`train-voice-toggle${ttsEnabled ? ' is-on' : ''}`}
              onClick={toggleVoice}
              disabled={!speechSupported}
              aria-pressed={ttsEnabled}
              title={speechSupported ? 'تشغيل أو كتم النطق الآلي' : 'النطق الآلي غير مدعوم على هذا الجهاز'}
            >
              <span aria-hidden="true">{speechSupported ? (ttsEnabled ? '🔊' : '🔇') : '🔇'}</span>
              <span>
                {speechSupported
                  ? ttsEnabled
                    ? 'الصوت مفعّل'
                    : 'الصوت مكتوم'
                  : 'النطق غير مدعوم'}
              </span>
            </button>
            <button
              type="button"
              className="train-close"
              onClick={onClose}
              aria-label="إغلاق دليل التدريب"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="train-modebar">
          <div className="train-modes" role="tablist" aria-label="وضع التدريب">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'walkthrough'}
              className={mode === 'walkthrough' ? 'is-active' : ''}
              onClick={() => setMode('walkthrough')}
            >
              🎬 جولة المحطات
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'scenarios'}
              className={mode === 'scenarios' ? 'is-active' : ''}
              onClick={() => setMode('scenarios')}
            >
              🧠 حالات ميدانية
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'resources'}
              className={mode === 'resources' ? 'is-active' : ''}
              onClick={() => setMode('resources')}
            >
              📚 مرجع الأدلة والروابط
            </button>
          </div>
          {mode === 'scenarios' && (
            <div className="train-practice">
              <button
                type="button"
                className={`train-practice__btn${practiceMode ? ' is-on' : ''}`}
                onClick={handlePracticeToggle}
                aria-pressed={practiceMode}
              >
                🎯 وضع الاختبار {practiceMode ? 'مفعّل' : 'متوقف'}
              </button>
              {practiceMode && (
                <button
                  type="button"
                  className="train-reset"
                  onClick={() => {
                    setOpenScenarios([]);
                    stopSpeech();
                  }}
                >
                  ↺ إعادة
                </button>
              )}
            </div>
          )}
        </div>

        <div className="train-body">
          {mode === 'walkthrough' ? (
            <>
              <nav className="train-rail" aria-label="محطات الجولة الست">
                {TRAINING_STAGES.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`train-rail__item${index === stageIndex ? ' is-active' : ''}${index < stageIndex ? ' is-done' : ''}`}
                    onClick={() => setStageIndex(index)}
                    aria-current={index === stageIndex ? 'step' : undefined}
                  >
                    <span className="train-rail__num">{index < stageIndex ? '✓' : item.id}</span>
                    <span className="train-rail__label">{item.short}</span>
                  </button>
                ))}
              </nav>

              <article className="train-stage">
                <header className="train-stage__head">
                  <span className="train-stage__badge">المحطة {stage.id} · {stage.station}</span>
                  <div className="train-stage__heading">
                    <h3>{stage.title}</h3>
                    <p>{stage.subtitle}</p>
                  </div>
                </header>

                <div className="train-stage__grid">
                  <div className="train-visual">
                    <div className="train-phone">
                      <div className="train-phone__screen">
                        <MockStageScreen stage={stage.id} />
                      </div>
                      {stage.callouts.map((callout, index) => (
                        <button
                          key={callout.id}
                          type="button"
                          className={`train-callout${activeCallout.id === callout.id ? ' is-active' : ''}`}
                          style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
                          onClick={() => setActiveCalloutId(callout.id)}
                          aria-label={`النقطة ${index + 1}: ${callout.title}`}
                          aria-pressed={activeCallout.id === callout.id}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                    <p className="train-visual__hint">اضغط النقاط الحمراء النابضة لقراءة الشرح</p>
                  </div>

                  <div className="train-coach">
                    <div className="train-voice">
                      <div className="train-voice__label">
                        <span aria-hidden="true">🎤</span>
                        <span>توجيه د. مصطفى علي غازي الشمري:</span>
                      </div>
                      <p className="train-voice__text">{stage.narration}</p>
                      <div className="train-voice__actions">
                        <button
                          type="button"
                          className="train-speak-btn"
                          onClick={() =>
                            speakingId === stageSpeechId
                              ? stopSpeech()
                              : speak(stage.narration, stageSpeechId)
                          }
                          disabled={!ttsEnabled || !speechSupported}
                        >
                          {speakingId === stageSpeechId ? '⏹ أوقف القراءة' : '🔊 اسمع التوجيه'}
                        </button>
                        {speakingId && speakingId !== stageSpeechId && (
                          <button
                            type="button"
                            className="train-speak-btn train-speak-btn--ghost"
                            onClick={stopSpeech}
                          >
                            ⏹ إيقاف
                          </button>
                        )}
                      </div>
                      <p className="train-voice__hint">{voiceHint}</p>
                    </div>

                    <div className={`train-callout-card${activeCallout ? '' : ' train-callout-card--empty'}`}>
                      {activeCallout ? (
                        <>
                          <span className="train-callout-card__num">{activeCalloutIndex + 1}</span>
                          <div>
                            <strong>{activeCallout.title}</strong>
                            <p>{activeCallout.detail}</p>
                          </div>
                        </>
                      ) : (
                        <span>اضغط على أي نقطة حمراء فوق شاشة الهاتف لتشاهد الشرح التفصيلي.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="train-checklist">
                  <h4>✅ تذكير سريع قبل ما تنتقل للمحطة التالية</h4>
                  <ul>
                    {stage.checklist.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div className="train-stage__nav">
                  <button
                    type="button"
                    className="train-nav-btn"
                    onClick={() => setStageIndex((index) => Math.max(0, index - 1))}
                    disabled={stageIndex === 0}
                  >
                    → المحطة السابقة
                  </button>
                  <span className="train-stage__progress">
                    المحطة {stageIndex + 1} من {TRAINING_STAGES.length}
                  </span>
                  {stageIndex < TRAINING_STAGES.length - 1 ? (
                    <button
                      type="button"
                      className="train-nav-btn train-nav-btn--primary"
                      onClick={() =>
                        setStageIndex((index) => Math.min(TRAINING_STAGES.length - 1, index + 1))
                      }
                    >
                      المحطة التالية ←
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="train-nav-btn train-nav-btn--primary"
                      onClick={() => setMode('scenarios')}
                    >
                      اختبر نفسك بالحالات 🧠
                    </button>
                  )}
                </div>
              </article>
            </>
          ) : mode === 'scenarios' ? (
            <div className="train-scenarios">
              <div className="train-scenarios__head">
                <div className="train-scenarios__intro">
                  <h3>5 حالات واقعية من الميدان</h3>
                  <p>
                    اقرأ الموقف والقاعدة، وخمّن الزر قبل ما تفتح الحل. جرّب تجاوب بصوتك أولاً،
                    بعدها اضغط البطاقة.
                  </p>
                </div>
                <span className="train-score">
                  {practiceMode ? `${revealedCount} / ${FIELD_SCENARIOS.length} محلولة` : 'كل الحلول ظاهرة'}
                </span>
              </div>

              <div className="train-scenario-grid">
                {FIELD_SCENARIOS.map((scenario, index) => {
                  const isOpen = openScenarios.includes(scenario.id);
                  const scenarioSpeechId = `scenario-${scenario.id}`;
                  return (
                    <article
                      key={scenario.id}
                      className={`train-scenario${isOpen ? ' is-open' : ''}`}
                    >
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
                        <section className="train-scenario__block train-scenario__block--a">
                          <span>(A) الموقف السريري</span>
                          <p>{scenario.situation}</p>
                        </section>
                        <section className="train-scenario__block train-scenario__block--b">
                          <span>(B) قاعدة منظمة الصحة العالمية 2025</span>
                          <p>{scenario.rule}</p>
                        </section>

                        {isOpen ? (
                          <div className="train-scenario__answer">
                            <section className="train-scenario__block train-scenario__block--c">
                              <span>(C) شنو تضغط في Al-Basar AI</span>
                              <p>{scenario.click}</p>
                            </section>
                            <section className="train-scenario__block train-scenario__block--d">
                              <span>(D) 🎤 توجيه د. مصطفى</span>
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
                              {speakingId === scenarioSpeechId ? '⏹ أوقف القراءة' : '🔊 اسمع الحل كاملاً'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="train-reveal"
                            onClick={() => toggleScenario(scenario.id)}
                          >
                            خمّن أولاً… أظهر الحل 👀
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="train-resources">
              <div className="train-resources__head">
                <h3>مرجع الأدلة والروابط الرسمية</h3>
                <p>كل شيء يعمل دون إنترنت بعد أول تحميل؛ الروابط تفتح عند توفر الشبكة.</p>
              </div>
              <div className="train-resources__grid">
                <a className="train-resource-card" href="https://iris.who.int/handle/10665/375590" target="_blank" rel="noopener noreferrer">
                  <span className="train-resource-card__emoji">🌐</span>
                  <div>
                    <strong>WHO 2025 Vision Screening Implementation Handbook</strong>
                    <small>الدليل الرسمي لمنظمة الصحة العالمية للفحص المدرسي للبصر 2025</small>
                  </div>
                </a>
                <a className="train-resource-card" href="https://www.equator-network.org/reporting-guidelines/spirit-ai/" target="_blank" rel="noopener noreferrer">
                  <span className="train-resource-card__emoji">📄</span>
                  <div>
                    <strong>EQUATOR SPIRIT-AI</strong>
                    <small>إرشادات التقرير للبحوث السريرية المدعومة بالذكاء الاصطناعي</small>
                  </div>
                </a>
                <a className="train-resource-card" href="https://www.equator-network.org/reporting-guidelines/stard-ai/" target="_blank" rel="noopener noreferrer">
                  <span className="train-resource-card__emoji">🔬</span>
                  <div>
                    <strong>EQUATOR STARD-AI</strong>
                    <small>معايير تقرير دراسات الدقة التشخيصية بالذكاء الاصطناعي</small>
                  </div>
                </a>
                <button className="train-resource-card train-resource-card--btn" onClick={() => { const a=document.createElement('a'); a.href='./guide.html'; a.download='Al-Basar-Field-Guide.html'; a.click(); }}>
                  <span className="train-resource-card__emoji">📖</span>
                  <div>
                    <strong>دليل الميدان الطلابي</strong>
                    <small>تحميل نسخة HTML قابلة للطباعة للمراجعة داخل المدرسة</small>
                  </div>
                </button>
                <button className="train-resource-card train-resource-card--btn" onClick={() => {
                  const blob = new Blob([JSON.stringify({offline:'Al-Basar v3 offline package placeholder', version:'v3'},null,2)], {type:'application/json'});
                  const url = URL.createObjectURL(blob);
                  const a=document.createElement('a'); a.href=url; a.download='albasar-offline-package.json'; a.click(); URL.revokeObjectURL(url);
                }}>
                  <span className="train-resource-card__emoji">📦</span>
                  <div>
                    <strong>حزمة عدم الاتصال Offline</strong>
                    <small>نسخة احتياطية محلية للتثبيت دون إنترنت</small>
                  </div>
                </button>
              </div>
              <p className="train-resources__note">التطبيق PWA يخزّن واجهة التدريب والمواد الثابتة في Service Worker ليتم الوصول لها بدون شبكة داخل المدارس.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
