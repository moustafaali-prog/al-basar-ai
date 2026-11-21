/* Scoped styles for the examiner training center. */
export const TRAINING_CSS = String.raw`
.train-overlay {
  --tr-ink: #15324a;
  --tr-muted: #64748b;
  --tr-line: #dce6ef;
  --tr-blue: #0b57d0;
  --tr-blue-dark: #073b94;
  --tr-teal: #0f766e;
  --tr-teal-soft: #ecfdf8;
  --tr-amber: #a16207;
  --tr-amber-soft: #fffbeb;
  --tr-red: #b42318;
  --tr-red-soft: #fff1f0;
  --tr-green: #176b3a;
  --tr-green-soft: #ecfdf3;
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: clamp(8px, 2vw, 24px);
  overflow: hidden;
  color: var(--tr-ink);
  background: rgba(5, 20, 34, 0.72);
  backdrop-filter: blur(8px);
  direction: rtl;
  font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.train-dialog {
  display: flex;
  flex-direction: column;
  width: min(1180px, 100%);
  max-height: 94dvh;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 26px;
  background: #f7fafc;
  box-shadow: 0 38px 100px -34px rgba(2, 12, 27, 0.9);
  animation: trainDialogIn 180ms ease-out;
}

@keyframes trainDialogIn {
  from { opacity: 0; transform: translateY(12px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ---------- Header ---------- */
.train-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  color: #fff;
  background:
    radial-gradient(520px 180px at 12% 0%, rgba(45, 212, 191, 0.26), transparent 65%),
    linear-gradient(118deg, #092b43 0%, #0b4a6f 52%, #0b57d0 100%);
}

.train-header__identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.train-header__mark {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 15px;
  color: #0b3550;
  background: linear-gradient(145deg, #f8d477, #f2b84b);
  box-shadow: 0 12px 28px -14px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.train-header__copy { min-width: 0; }

.train-header h2 {
  margin: 0;
  font-size: clamp(17px, 2vw, 21px);
  font-weight: 900;
  line-height: 1.35;
}

.train-header p {
  margin: 3px 0 0;
  color: #d5e9f7;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.55;
}

.train-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.train-voice-toggle,
.train-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 39px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease, color 150ms ease;
}

.train-voice-toggle:hover,
.train-close:hover { background: rgba(255, 255, 255, 0.22); }
.train-voice-toggle:active,
.train-close:active { transform: translateY(1px); }
.train-voice-toggle.is-on { color: #0b4264; background: #fff; }
.train-voice-toggle:disabled { opacity: 0.52; cursor: not-allowed; }
.train-close { width: 39px; padding: 0; }

/* ---------- Mode bar ---------- */
.train-modebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--tr-line);
  background: #fff;
}

.train-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: #edf3f8;
}

.train-modes button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 35px;
  padding: 7px 12px;
  border: 0;
  border-radius: 11px;
  color: #526579;
  background: transparent;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 850;
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.train-modes button:hover { color: var(--tr-blue); }
.train-modes button.is-active {
  color: var(--tr-blue);
  background: #fff;
  box-shadow: 0 3px 11px rgba(15, 42, 68, 0.13);
}

.train-reset,
.train-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid var(--tr-line);
  border-radius: 999px;
  color: #526579;
  background: #fff;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 850;
}

.train-reset { cursor: pointer; }
.train-reset:hover { color: var(--tr-blue); border-color: #93c5fd; }
.train-score {
  color: #fff;
  border-color: transparent;
  background: var(--tr-teal);
  white-space: nowrap;
}
.train-score--large { min-height: 42px; padding: 9px 15px; font-size: 13px; }

/* ---------- Body ---------- */
.train-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px clamp(11px, 2vw, 20px) 22px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #b7c7d8 transparent;
}
.train-body::-webkit-scrollbar { width: 9px; }
.train-body::-webkit-scrollbar-thumb { border-radius: 999px; background: #b7c7d8; }

/* ---------- Unit rail ---------- */
.train-rail {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 12px;
}

.train-rail__item {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--tr-line);
  border-radius: 13px;
  color: #526579;
  background: #fff;
  font-family: inherit;
  text-align: right;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease, transform 150ms ease;
}
.train-rail__item:hover { color: var(--tr-blue); border-color: #93c5fd; transform: translateY(-1px); }

.train-rail__num {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  color: #526579;
  background: #edf3f8;
  font-size: 11px;
  font-weight: 900;
}

.train-rail__label {
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 850;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.train-rail__item.is-done .train-rail__num { color: var(--tr-green); background: #dcfce7; }
.train-rail__item.is-active {
  color: #fff;
  border-color: var(--tr-blue);
  background: var(--tr-blue);
  box-shadow: 0 9px 19px -13px rgba(11, 87, 208, 0.9);
}
.train-rail__item.is-active .train-rail__num { color: #fff; background: rgba(255, 255, 255, 0.2); }

/* ---------- Unit card ---------- */
.train-stage {
  overflow: hidden;
  border: 1px solid var(--tr-line);
  border-radius: 21px;
  background: #fff;
  box-shadow: 0 18px 40px -34px rgba(15, 38, 61, 0.5);
}

.train-stage__head {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 17px 12px;
  border-bottom: 1px dashed var(--tr-line);
}

.train-stage__badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  color: var(--tr-blue-dark);
  background: #e8f0fe;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.train-stage__heading { min-width: 0; }
.train-stage__heading h3 {
  margin: 0;
  color: var(--tr-ink);
  font-size: clamp(16px, 2vw, 19px);
  font-weight: 900;
  line-height: 1.4;
}
.train-stage__heading p {
  margin: 3px 0 0;
  color: var(--tr-muted);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.65;
}

.train-stage__grid {
  display: grid;
  grid-template-columns: minmax(245px, 0.78fr) minmax(0, 1.22fr);
  gap: 17px;
  align-items: start;
  padding: 17px;
}

.train-shot { margin: 0; }
.train-shot__frame {
  overflow: hidden;
  padding: 8px;
  border: 1px solid #cdd9e5;
  border-radius: 22px;
  background: linear-gradient(145deg, #eef4f9, #dce8f2);
  box-shadow: inset 0 1px 0 #fff, 0 18px 35px -24px rgba(15, 38, 61, 0.5);
}
.train-shot__frame img {
  display: block;
  width: 100%;
  max-height: 530px;
  object-fit: contain;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 8px 24px -15px rgba(15, 38, 61, 0.45);
}
.train-shot figcaption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 8px;
  color: var(--tr-muted);
  font-size: 10px;
  font-weight: 750;
}

.train-coach {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}

.train-voice {
  padding: 13px 14px;
  border: 1px solid #bfe3dc;
  border-radius: 17px;
  background: linear-gradient(135deg, #f3fffc, #ecfdf8);
}
.train-voice__label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tr-teal);
  font-size: 11px;
  font-weight: 900;
}
.train-voice__text {
  margin: 7px 0 0;
  color: #30495c;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.95;
}
.train-voice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}
.train-speak-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 35px;
  padding: 0 12px;
  border: 1px solid var(--tr-teal);
  border-radius: 999px;
  color: #fff;
  background: var(--tr-teal);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 850;
  cursor: pointer;
}
.train-speak-btn:hover { background: #115e59; }
.train-speak-btn--ghost { color: var(--tr-teal); background: #fff; }
.train-speak-btn--ghost:hover { background: #f0fdfa; }
.train-speak-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.train-voice__hint {
  margin: 7px 0 0;
  color: #52756f;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.55;
}

.train-block {
  padding: 12px 13px;
  border: 1px solid var(--tr-line);
  border-radius: 16px;
  background: #fff;
}
.train-block h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 9px;
  color: var(--tr-ink);
  font-size: 11.5px;
  font-weight: 900;
}
.train-block--warn { border-color: #f2d18a; background: var(--tr-amber-soft); }
.train-block--warn h4 { color: var(--tr-amber); }
.train-block--pass { border-color: #bfe6c9; background: var(--tr-green-soft); }
.train-block--pass h4 { color: var(--tr-green); }

.train-step-list,
.train-attention-list,
.train-check-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.train-step-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.train-step-list li > span {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 50%;
  color: var(--tr-blue);
  background: #e8f0fe;
  font-size: 9.5px;
  font-weight: 900;
}
.train-step-list p {
  margin: 0;
  color: #3f566a;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.75;
}
.train-attention-list li,
.train-check-list li {
  position: relative;
  padding-inline-start: 18px;
  color: #4b5563;
  font-size: 10.5px;
  font-weight: 650;
  line-height: 1.7;
}
.train-attention-list li::before {
  content: '!';
  position: absolute;
  inset-inline-start: 0;
  top: 1px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  color: #fff;
  background: #d97706;
  font-size: 9px;
  font-weight: 900;
}
.train-check-list li::before {
  content: '✓';
  position: absolute;
  inset-inline-start: 0;
  top: 1px;
  color: var(--tr-green);
  font-weight: 900;
}

.train-stage__lower {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 17px 15px;
}

.train-stage__nav,
.train-case-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  padding: 10px 17px;
  border-top: 1px solid var(--tr-line);
  background: #f8fafc;
}
.train-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 37px;
  padding: 0 14px;
  border: 1px solid var(--tr-line);
  border-radius: 999px;
  color: #3f566a;
  background: #fff;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 850;
  cursor: pointer;
}
.train-nav-btn:hover:not(:disabled) { color: var(--tr-blue); border-color: #93c5fd; }
.train-nav-btn--primary { color: #fff; border-color: var(--tr-blue); background: var(--tr-blue); }
.train-nav-btn--primary:hover:not(:disabled) { color: #fff; border-color: var(--tr-blue-dark); background: var(--tr-blue-dark); }
.train-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.train-stage__progress { color: var(--tr-muted); font-size: 10px; font-weight: 750; }

/* ---------- Scenarios ---------- */
.train-scenarios__head,
.train-practice__head,
.train-resources__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 13px;
}
.train-scenarios__intro,
.train-practice__head > div:first-child { min-width: 0; }
.train-scenarios__intro h3,
.train-practice__head h3,
.train-resources__head h3 {
  margin: 0;
  color: var(--tr-ink);
  font-size: clamp(16px, 2vw, 19px);
  font-weight: 900;
  line-height: 1.45;
}
.train-scenarios__intro p,
.train-practice__head p,
.train-resources__head p {
  margin: 4px 0 0;
  color: var(--tr-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.7;
}
.train-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  color: var(--tr-teal);
  font-size: 10px;
  font-weight: 900;
}

.train-scenario-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
  align-items: start;
}
.train-scenario {
  overflow: hidden;
  border: 1px solid var(--tr-line);
  border-radius: 17px;
  background: #fff;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.train-scenario.is-open {
  border-color: #8fd2c4;
  box-shadow: 0 14px 30px -25px rgba(15, 118, 110, 0.8);
}
.train-scenario__head {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  color: var(--tr-ink);
  background: linear-gradient(135deg, #f8fafc, #eef6ff);
  font-family: inherit;
  text-align: right;
  cursor: pointer;
}
.train-scenario__emoji {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 35px;
  height: 35px;
  border: 1px solid var(--tr-line);
  border-radius: 11px;
  background: #fff;
  font-size: 17px;
}
.train-scenario__titles { flex: 1; min-width: 0; }
.train-scenario__titles strong {
  display: block;
  font-size: 11.5px;
  font-weight: 900;
  line-height: 1.5;
}
.train-scenario__titles small {
  display: block;
  margin-top: 1px;
  color: var(--tr-muted);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.45;
}
.train-scenario__chev {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #526579;
  background: #e2e8f0;
  font-size: 15px;
  font-weight: 900;
}
.train-scenario.is-open .train-scenario__chev { color: var(--tr-teal); background: #ccfbf1; }
.train-scenario__body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px 12px;
}
.train-scenario__evidence {
  margin: 0 0 2px;
  overflow: hidden;
  border: 1px solid var(--tr-line);
  border-radius: 12px;
  background: #f8fafc;
}
.train-scenario__evidence img {
  display: block;
  width: 100%;
  height: 142px;
  object-fit: cover;
  object-position: top;
  background: #eef4f9;
}
.train-scenario__evidence figcaption {
  padding: 5px 8px;
  color: var(--tr-muted);
  font-size: 8.5px;
  font-weight: 750;
  text-align: center;
}
.train-scenario__block {
  padding: 9px 10px;
  border-inline-start: 3px solid;
  border-radius: 11px;
  background: #f8fafc;
}
.train-scenario__block span {
  display: block;
  margin-bottom: 3px;
  font-size: 8.5px;
  font-weight: 900;
}
.train-scenario__block p {
  margin: 0;
  color: #334155;
  font-size: 10.5px;
  font-weight: 650;
  line-height: 1.8;
}
.train-scenario__block--a { border-color: #94a3b8; }
.train-scenario__block--a span { color: #475569; }
.train-scenario__block--b { border-color: #60a5fa; background: #eff6ff; }
.train-scenario__block--b span { color: #1d4ed8; }
.train-scenario__block--c { border-color: #34d399; background: var(--tr-teal-soft); }
.train-scenario__block--c span { color: #047857; }
.train-scenario__block--d { border-color: #fbbf24; background: var(--tr-amber-soft); }
.train-scenario__block--d span { color: #b45309; }
.train-scenario__answer {
  display: flex;
  flex-direction: column;
  gap: 7px;
  animation: trainReveal 180ms ease-out;
}
@keyframes trainReveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.train-reveal {
  padding: 9px;
  border: 1px dashed #94a3b8;
  border-radius: 10px;
  color: var(--tr-blue);
  background: #fff;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 850;
  cursor: pointer;
}
.train-reveal:hover { border-color: #60a5fa; background: #eff6ff; }
.train-scenario__speak {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  padding: 6px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: var(--tr-blue);
  background: #eff6ff;
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 850;
  cursor: pointer;
}
.train-scenario__speak:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---------- Decision practice ---------- */
.train-practice { max-width: 980px; margin-inline: auto; }
.train-case-nav {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 5px;
  margin-bottom: 11px;
}
.train-case-nav button {
  display: grid;
  place-items: center;
  min-height: 34px;
  padding: 0;
  border: 1px solid var(--tr-line);
  border-radius: 10px;
  color: #526579;
  background: #fff;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 900;
  cursor: pointer;
}
.train-case-nav button:hover { color: var(--tr-blue); border-color: #93c5fd; }
.train-case-nav button.is-active {
  color: #fff;
  border-color: var(--tr-blue);
  background: var(--tr-blue);
}
.train-case-card {
  overflow: hidden;
  border: 1px solid var(--tr-line);
  border-radius: 19px;
  background: #fff;
  box-shadow: 0 18px 40px -34px rgba(15, 38, 61, 0.55);
}
.train-case-card > header { padding: 16px 17px 13px; border-bottom: 1px dashed var(--tr-line); }
.train-case-card > header > span { color: var(--tr-blue); font-size: 10px; font-weight: 900; }
.train-case-card > header h4 { margin: 4px 0 3px; color: var(--tr-ink); font-size: 17px; font-weight: 900; }
.train-case-card > header p { margin: 0; color: var(--tr-muted); font-size: 11.5px; font-weight: 650; line-height: 1.75; }
.train-case-inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  padding: 13px 17px;
  background: #f8fafc;
}
.train-case-inputs > div {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e5edf4;
  border-radius: 11px;
  background: #fff;
}
.train-case-inputs small { display: block; color: var(--tr-muted); font-size: 8.5px; font-weight: 800; }
.train-case-inputs strong {
  display: block;
  margin-top: 3px;
  overflow-wrap: anywhere;
  color: #253d51;
  font-size: 10.5px;
  font-weight: 900;
  line-height: 1.55;
}
.train-outcome-picker { display: grid; gap: 8px; padding: 15px 17px 10px; }
.train-outcome {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 11px;
  border: 1px solid var(--tr-line);
  border-radius: 12px;
  color: #40566a;
  background: #fff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  text-align: right;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
}
.train-outcome:hover:not(:disabled) { transform: translateX(-2px); }
.train-outcome:disabled { cursor: default; }
.train-outcome__radio {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 2px solid #cbd5e1;
  border-radius: 50%;
  color: #fff;
}
.train-outcome--urgent.is-selected { border-color: #ef9a92; background: var(--tr-red-soft); }
.train-outcome--urgent.is-selected .train-outcome__radio { border-color: var(--tr-red); background: var(--tr-red); }
.train-outcome--review.is-selected { border-color: #f0c96d; background: var(--tr-amber-soft); }
.train-outcome--review.is-selected .train-outcome__radio { border-color: #d97706; background: #d97706; }
.train-outcome--pass.is-selected { border-color: #83d6aa; background: var(--tr-green-soft); }
.train-outcome--pass.is-selected .train-outcome__radio { border-color: var(--tr-green); background: var(--tr-green); }
.train-check-answer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 41px;
  margin: 3px 17px 15px;
  border: 0;
  border-radius: 12px;
  color: #fff;
  background: var(--tr-blue);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 900;
  cursor: pointer;
}
.train-check-answer:disabled { opacity: 0.42; cursor: not-allowed; }
.train-verdict {
  margin: 3px 17px 15px;
  padding: 12px 13px;
  border: 1px solid;
  border-radius: 13px;
}
.train-verdict--urgent { color: #7a2019; border-color: #efaaa3; background: var(--tr-red-soft); }
.train-verdict--review { color: #754b08; border-color: #efd08b; background: var(--tr-amber-soft); }
.train-verdict--pass { color: #14532d; border-color: #a9dfc1; background: var(--tr-green-soft); }
.train-verdict__head { display: flex; align-items: flex-start; gap: 8px; }
.train-verdict__head span { display: block; margin-bottom: 2px; font-size: 9px; font-weight: 900; }
.train-verdict__head strong { display: block; font-size: 12px; font-weight: 900; line-height: 1.5; }
.train-verdict p { margin: 8px 0 0; font-size: 10.5px; font-weight: 650; line-height: 1.8; }
.train-verdict small { display: block; margin-top: 6px; font-size: 9px; font-weight: 750; }

/* ---------- Resources ---------- */
.train-resources { max-width: 980px; margin-inline: auto; }
.train-resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.train-resource-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 13px;
  border: 1px solid var(--tr-line);
  border-radius: 15px;
  color: inherit;
  background: #fff;
  text-decoration: none;
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}
.train-resource-card:hover { transform: translateY(-2px); border-color: #9fd6cc; box-shadow: 0 10px 24px -17px rgba(2, 12, 27, 0.42); }
.train-resource-card--feature { grid-column: 1 / -1; border-color: #a8c7f8; background: linear-gradient(135deg, #f5f9ff, #e8f0fe); }
.train-resource-card__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 39px;
  height: 39px;
  border-radius: 12px;
  color: var(--tr-blue);
  background: #fff;
  box-shadow: 0 5px 13px -9px rgba(15, 38, 61, 0.45);
}
.train-resource-card strong { display: block; color: var(--tr-ink); font-size: 11.5px; font-weight: 900; line-height: 1.5; }
.train-resource-card small { display: block; margin-top: 2px; color: var(--tr-muted); font-size: 9.5px; font-weight: 650; line-height: 1.6; }
.train-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.train-facts > div { padding: 10px 11px; border: 1px solid var(--tr-line); border-radius: 13px; background: #fff; }
.train-facts strong { display: block; color: var(--tr-teal); font-size: 10px; font-weight: 900; }
.train-facts span { display: block; margin-top: 3px; color: var(--tr-muted); font-size: 9.5px; font-weight: 650; line-height: 1.65; }
.train-resources__note { margin: 12px 0 0; color: var(--tr-muted); font-size: 10px; font-weight: 700; line-height: 1.7; }

/* ---------- Responsive ---------- */
@media (max-width: 960px) {
  .train-stage__grid { grid-template-columns: 1fr; }
  .train-shot { max-width: 390px; margin-inline: auto; }
  .train-rail { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .train-case-nav { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .train-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .train-overlay { padding: 0; }
  .train-dialog { width: 100%; height: 100dvh; max-height: 100dvh; border: 0; border-radius: 0; }
  .train-header { padding: 11px 13px; }
  .train-header__mark { width: 40px; height: 40px; border-radius: 13px; }
  .train-header p { display: none; }
  .train-voice-toggle { width: 39px; padding: 0; }
  .train-voice-toggle span { display: none; }
  .train-modebar { align-items: flex-start; padding: 8px 10px; }
  .train-modes { width: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .train-modes button { padding: 7px 6px; font-size: 9.5px; }
  .train-modebar > .train-score,
  .train-modebar > .train-reset { margin-inline-start: auto; }
  .train-body { padding: 11px 9px 18px; }
  .train-rail { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .train-rail::-webkit-scrollbar { display: none; }
  .train-rail__item { flex: 0 0 auto; padding: 7px 9px; }
  .train-stage__head { padding: 12px 12px 10px; }
  .train-stage__badge { white-space: normal; }
  .train-stage__grid { padding: 12px; gap: 12px; }
  .train-stage__lower { grid-template-columns: 1fr; padding: 0 12px 12px; }
  .train-stage__nav { padding: 9px 12px; }
  .train-stage__progress { display: none; }
  .train-nav-btn { padding: 0 10px; font-size: 9.5px; }
  .train-scenarios__head,
  .train-practice__head,
  .train-resources__head { align-items: flex-start; flex-direction: column; gap: 7px; }
  .train-scenario-grid,
  .train-resource-grid { grid-template-columns: 1fr; }
  .train-resource-card--feature { grid-column: auto; }
  .train-case-inputs { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 11px 12px; }
  .train-outcome-picker { padding-inline: 12px; }
  .train-case-card > header { padding-inline: 12px; }
  .train-check-answer { margin-inline: 12px; }
  .train-verdict { margin-inline: 12px; }
  .train-case-actions { padding-inline: 10px; }
  .train-facts { grid-template-columns: 1fr; }
}

@media (max-width: 420px) {
  .train-header h2 { font-size: 15px; }
  .train-header__mark { width: 37px; height: 37px; }
  .train-close { width: 36px; min-height: 36px; }
  .train-voice-toggle { width: 36px; min-height: 36px; }
  .train-modes button svg { display: none; }
  .train-stage__head { flex-direction: column; }
  .train-case-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .train-case-inputs { grid-template-columns: 1fr; }
  .train-case-actions .train-reset { padding-inline: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .train-dialog,
  .train-scenario__answer { animation: none !important; }
  .train-rail__item,
  .train-resource-card,
  .train-outcome { transition: none; }
}
`;
