/* Scoped styles for the Interactive Student Training modal. */
export const TRAINING_CSS = String.raw`
.train-overlay {
  --tr-ink: #123c57;
  --tr-primary: #0b57d0;
  --tr-primary-strong: #0842a0;
  --tr-teal: #0f766e;
  --tr-amber: #b45309;
  --tr-red: #b3261e;
  --tr-border: #dbe4ee;
  --tr-muted: #64748b;
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(8px, 2vw, 24px);
  background: rgba(6, 20, 34, 0.68);
  backdrop-filter: blur(6px);
  direction: rtl;
  font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--tr-ink);
}

.train-dialog {
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  max-height: 94dvh;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 28px;
  box-shadow: 0 34px 90px -30px rgba(2, 12, 27, 0.85);
  animation: trainDialogIn 220ms ease-out;
}

@keyframes trainDialogIn {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.train-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
  color: #fff;
  background: linear-gradient(120deg, #0c3a55 0%, #0b4a7a 46%, #0b57d0 100%);
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
  width: 50px;
  height: 50px;
  border-radius: 17px;
  font-size: 25px;
  background: linear-gradient(145deg, #f8d477, #e8a317);
  box-shadow: 0 10px 22px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.train-header__copy { min-width: 0; }

.train-header h2 {
  margin: 0;
  font-size: clamp(17px, 2vw, 21px);
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.train-header p {
  margin: 3px 0 0;
  color: #cfe4f7;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
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
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}

.train-voice-toggle:hover,
.train-close:hover { background: rgba(255, 255, 255, 0.24); }
.train-voice-toggle:active,
.train-close:active { transform: translateY(1px); }

.train-voice-toggle.is-on {
  background: #fff;
  color: #0b4a7a;
  border-color: #fff;
}

.train-voice-toggle:disabled { opacity: 0.55; cursor: not-allowed; }

.train-close {
  width: 40px;
  padding: 0;
  font-size: 17px;
}

.train-modebar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid var(--tr-border);
}

.train-modes {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #eef3f8;
}

.train-modes button {
  border: 0;
  border-radius: 999px;
  padding: 8px 15px;
  background: transparent;
  color: #475569;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.train-modes button.is-active {
  background: #fff;
  color: var(--tr-primary);
  box-shadow: 0 2px 9px rgba(15, 23, 42, 0.14);
}

.train-practice {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.train-practice__btn,
.train-reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border-radius: 999px;
  border: 1px solid var(--tr-border);
  background: #fff;
  color: #475569;
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}

.train-practice__btn.is-on {
  border-color: #99f6e4;
  background: #f0fdfa;
  color: #0f766e;
}

.train-practice__btn:hover,
.train-reset:hover { border-color: #93c5fd; color: var(--tr-primary); }

.train-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px clamp(12px, 2.2vw, 22px) 24px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #b6c6d8 transparent;
}

.train-body::-webkit-scrollbar { width: 9px; }
.train-body::-webkit-scrollbar-thumb { background: #b6c6d8; border-radius: 999px; }

/* ---------- Stage rail ---------- */
.train-rail {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 13px;
}

.train-rail__item {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--tr-border);
  border-radius: 14px;
  background: #fff;
  color: #475569;
  font-family: inherit;
  text-align: right;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.train-rail__item:hover { border-color: #93c5fd; color: var(--tr-primary); }

.train-rail__num {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: #eef3f8;
  color: #475569;
  font-size: 11px;
  font-weight: 900;
}

.train-rail__label {
  overflow: hidden;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.train-rail__item.is-done .train-rail__num { background: #dcfce7; color: #146c2e; }

.train-rail__item.is-active {
  border-color: var(--tr-primary);
  background: var(--tr-primary);
  color: #fff;
  box-shadow: 0 8px 18px -12px rgba(11, 87, 208, 0.95);
}

.train-rail__item.is-active .train-rail__num {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}

/* ---------- Stage card ---------- */
.train-stage {
  overflow: hidden;
  border: 1px solid var(--tr-border);
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 18px 40px -34px rgba(15, 23, 42, 0.55);
}

.train-stage__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 18px 12px;
  border-bottom: 1px dashed #e2e8f0;
}

.train-stage__badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: #e8f0fe;
  color: var(--tr-primary-strong);
  font-size: 10.5px;
  font-weight: 900;
  white-space: nowrap;
}

.train-stage__heading { min-width: 0; }

.train-stage__heading h3 {
  margin: 0;
  color: var(--tr-ink);
  font-size: clamp(16px, 2vw, 19px);
  font-weight: 800;
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
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  padding: 18px;
}

/* ---------- Mock phone ---------- */
.train-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.train-phone {
  position: relative;
  width: min(286px, 100%);
  aspect-ratio: 9 / 16.1;
  padding: 9px;
  border-radius: 34px;
  background: linear-gradient(160deg, #243247, #0f172a);
  box-shadow: 0 26px 48px -26px rgba(15, 23, 42, 0.8), inset 0 0 0 2px #334155;
}

.train-phone::before {
  content: '';
  position: absolute;
  top: 15px;
  left: 50%;
  z-index: 4;
  width: 52px;
  height: 5px;
  border-radius: 999px;
  background: #475569;
  transform: translateX(-50%);
}

.train-phone__screen {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 26px;
  background: #f8fafc;
}

.train-visual__hint {
  margin: 0;
  color: var(--tr-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
}

/* Pulsing red callout pointers */
.train-callout {
  position: absolute;
  z-index: 6;
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #dc2626;
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  transform: translate(-50%, -50%);
  box-shadow: 0 4px 14px rgba(185, 28, 28, 0.55);
  transition: background 160ms ease, transform 160ms ease;
}

.train-callout::before {
  content: '';
  position: absolute;
  inset: -7px;
  border: 2px solid rgba(239, 68, 68, 0.9);
  border-radius: 50%;
  animation: trainPulse 1.8s ease-out infinite;
}

.train-callout:hover { background: #b91c1c; }

.train-callout.is-active {
  background: #991b1b;
  transform: translate(-50%, -50%) scale(1.14);
}

@keyframes trainPulse {
  0% { opacity: 0.9; transform: scale(0.8); }
  70% { opacity: 0; transform: scale(1.55); }
  100% { opacity: 0; transform: scale(1.55); }
}

/* ---------- Coach panel ---------- */
.train-coach {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}

.train-voice {
  padding: 14px;
  border: 1px solid #fcd34d;
  border-radius: 18px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
}

.train-voice__label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #92400e;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.5;
}

.train-voice__label span:first-child { font-size: 16px; }

.train-voice__text {
  margin: 8px 0 0;
  color: #3f3f46;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.95;
}

.train-voice__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
}

.train-speak-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #0f766e;
  border-radius: 999px;
  background: #0f766e;
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease;
}

.train-speak-btn:hover { background: #115e59; }

.train-speak-btn--ghost {
  background: #fff;
  color: #0f766e;
}

.train-speak-btn--ghost:hover { background: #f0fdfa; }

.train-speak-btn:disabled { opacity: 0.48; cursor: not-allowed; }

.train-voice__hint {
  margin: 7px 0 0;
  color: #92400e;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.6;
}

.train-callout-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 86px;
  padding: 13px 14px;
  border: 1px solid var(--tr-border);
  border-radius: 18px;
  background: #fff;
}

.train-callout-card__num {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 900;
}

.train-callout-card strong {
  display: block;
  color: #0f172a;
  font-size: 12.5px;
  font-weight: 800;
  line-height: 1.5;
}

.train-callout-card p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.8;
}

.train-callout-card--empty {
  align-items: center;
  border-style: dashed;
  background: #f8fafc;
  color: var(--tr-muted);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.7;
}

/* ---------- Checklist + navigation ---------- */
.train-checklist {
  margin: 0 18px 16px;
  padding-top: 12px;
  border-top: 1px dashed #dbe4ee;
}

.train-checklist h4 {
  margin: 0 0 8px;
  color: #146c2e;
  font-size: 11.5px;
  font-weight: 900;
}

.train-checklist ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.train-checklist li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 8px;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  background: #f8fafc;
  color: #475569;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.65;
}

.train-checklist li::before {
  content: '✓';
  flex: 0 0 auto;
  color: #146c2e;
  font-weight: 900;
}

.train-stage__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 18px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.train-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 15px;
  border: 1px solid var(--tr-border);
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.train-nav-btn:hover:not(:disabled) { border-color: #93c5fd; color: var(--tr-primary); }

.train-nav-btn--primary {
  border-color: var(--tr-primary);
  background: var(--tr-primary);
  color: #fff;
}

.train-nav-btn--primary:hover:not(:disabled) {
  border-color: var(--tr-primary-strong);
  background: var(--tr-primary-strong);
  color: #fff;
}

.train-nav-btn:disabled { opacity: 0.42; cursor: not-allowed; }

.train-stage__progress {
  color: var(--tr-muted);
  font-size: 10.5px;
  font-weight: 700;
}

/* ---------- Mock app screens inside the phone ---------- */
.train-app {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  padding: 22px 11px 12px;
  color: var(--tr-ink);
  font-size: 10px;
}

.train-app__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #64748b;
  font-size: 7px;
  font-weight: 900;
}

.train-app__head {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 2px;
}

.train-app__eyebrow {
  color: var(--tr-primary);
  font-size: 7.5px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.train-app__head strong {
  font-size: 13.5px;
  font-weight: 900;
  line-height: 1.35;
}

.train-app__note {
  margin: 0;
  color: var(--tr-muted);
  font-size: 7.5px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
}

.train-id {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: linear-gradient(135deg, #fff, #eef6ff);
}

.train-id__flag { flex: 0 0 auto; font-size: 18px; }
.train-id strong { display: block; font-size: 9px; font-weight: 900; line-height: 1.4; }
.train-id small { display: block; color: #64748b; font-size: 7px; font-weight: 600; line-height: 1.4; }

.train-id__chip {
  margin-inline-start: auto;
  padding: 3px 5px;
  border-radius: 5px;
  background: #dbeafe;
  color: var(--tr-primary);
  font-size: 7.5px;
  font-weight: 900;
}

.train-ruler {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 6px;
  border-top: 1px dashed #94a3b8;
  border-bottom: 1px dashed #94a3b8;
  color: var(--tr-red);
  font-size: 8px;
  font-weight: 900;
}

.train-checkrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #475569;
  font-size: 8.5px;
  font-weight: 700;
}

.train-ok { color: #146c2e; font-weight: 900; }

.train-mockbtn {
  margin-top: auto;
  padding: 8px;
  border-radius: 10px;
  background: var(--tr-primary);
  color: #fff;
  font-size: 9.5px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 8px 14px -10px var(--tr-primary);
}

.train-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 9px;
  background: #f1f5f9;
  color: #475569;
  font-size: 8.5px;
  font-weight: 700;
}

.train-code {
  color: var(--tr-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  font-weight: 900;
}

.train-pill {
  padding: 3px 5px;
  border-radius: 6px;
  font-size: 7.5px;
  font-weight: 900;
}

.train-pill--ok { background: #dcfce7; color: #146c2e; }
.train-pill--warn { background: #fef3c7; color: #b45309; }

.train-seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: #e2e8f0;
}

.train-seg i {
  padding: 2px 6px;
  border-radius: 4px;
  color: #64748b;
  font-size: 7.5px;
  font-style: normal;
  font-weight: 800;
}

.train-seg i.is-on {
  background: #fff;
  color: var(--tr-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
}

.train-who {
  padding: 7px 8px;
  border: 1px solid #fed7aa;
  border-radius: 9px;
  background: #fff7ed;
}

.train-who b { color: #9a3412; font-size: 8px; font-weight: 900; }

.train-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}

.train-chips span {
  padding: 2px 5px;
  border-radius: 999px;
  background: #ffedd5;
  color: #9a3412;
  font-size: 7px;
  font-weight: 700;
}

.train-route {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: auto;
  padding: 7px 8px;
  border: 1px solid #a7f3d0;
  border-radius: 9px;
  background: #ecfdf5;
}

.train-route small { color: #047857; font-size: 7px; font-weight: 900; }
.train-route b { color: #065f46; font-size: 9px; font-weight: 900; line-height: 1.5; }
.train-route span { color: #64748b; font-size: 7px; font-weight: 700; }

.train-eye-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #f8fafc;
}

.train-eye-row--muted { opacity: 0.62; }

.train-eye-tag {
  display: grid;
  place-items: center;
  width: 26px;
  height: 20px;
  border-radius: 5px;
  background: var(--tr-primary);
  color: #fff;
  font-size: 8.5px;
  font-weight: 900;
}

.train-eye-row b { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 900; }

.train-locked {
  margin-inline-start: auto;
  padding: 3px 5px;
  border-radius: 5px;
  background: #fef3c7;
  color: #b45309;
  font-size: 7.5px;
  font-weight: 900;
}

.train-tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.train-tools div {
  padding: 7px;
  border-radius: 9px;
  background: #f1f5f9;
  font-size: 14px;
  text-align: center;
}

.train-tools small {
  display: block;
  margin-top: 2px;
  color: #475569;
  font-size: 7px;
  font-weight: 700;
  line-height: 1.4;
}

.train-timer {
  margin-top: auto;
  padding: 8px;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
}

.train-timer > span { color: #94a3b8; font-size: 7px; font-weight: 900; }
.train-timer > b {
  display: block;
  color: #5eead4;
  font-family: 'JetBrains Mono', monospace;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.train-progress {
  height: 4px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #334155;
}

.train-progress i {
  display: block;
  width: 38%;
  height: 100%;
  border-radius: inherit;
  background: #5eead4;
}

.train-age-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font-size: 7.5px;
  font-weight: 800;
}

.train-mode-toggle { display: flex; gap: 3px; }

.train-mode-toggle span {
  flex: 1;
  padding: 4px 5px;
  border-radius: 5px;
  background: #eef2f7;
  color: #64748b;
  font-size: 7px;
  font-weight: 900;
  text-align: center;
}

.train-mode-toggle span.is-on { background: var(--tr-primary); color: #fff; }

.train-optotype {
  display: grid;
  place-items: center;
  flex: 1;
  min-height: 64px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #0f172a;
  font-family: 'Cairo', sans-serif;
  font-size: 52px;
  font-weight: 900;
  line-height: 1;
}

.train-lapcard {
  padding: 5px;
  border: 1px dashed #fb923c;
  border-radius: 8px;
  background: #ffedd5;
  color: #7c2d12;
  font-size: 7.5px;
  font-weight: 900;
  text-align: center;
}

.train-stairs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 900;
}

.train-stairs span {
  padding: 3px 4px;
  border-radius: 5px;
  background: #eef2f7;
  color: #475569;
}

.train-stairs span.is-fail { background: #fee2e2; color: #b91c1c; }
.train-stairs span.is-next { background: #dbeafe; color: var(--tr-primary); outline: 1px solid #60a5fa; }

.train-camera {
  position: relative;
  display: grid;
  place-items: center;
  flex: 1;
  min-height: 108px;
  overflow: hidden;
  border-radius: 12px;
  background: radial-gradient(circle at 50% 44%, #334155, #0f172a 72%);
}

.train-camera::before,
.train-camera::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(226, 232, 240, 0.5);
}

.train-camera::before { top: 8px; left: 8px; border-right: 0; border-bottom: 0; }
.train-camera::after { right: 8px; bottom: 8px; border-top: 0; border-left: 0; }

.train-face {
  position: relative;
  width: 82px;
  height: 100px;
  border-radius: 46px;
  background: linear-gradient(#fcd9b6, #f3bd8c);
  box-shadow: inset 0 -8px 18px rgba(180, 83, 9, 0.18);
}

.train-face__eye {
  position: absolute;
  top: 33px;
  display: grid;
  place-items: center;
  width: 13px;
  height: 9px;
  border-radius: 50%;
  background: #fff;
}

.train-face__eye--l { left: 19px; }
.train-face__eye--r { right: 19px; }

.train-flash {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 2px #fde68a, 0 0 12px 5px rgba(255, 255, 255, 0.85);
}

.train-face__nose {
  position: absolute;
  top: 46px;
  left: 50%;
  width: 5px;
  height: 13px;
  border-radius: 999px;
  background: rgba(180, 83, 9, 0.25);
  transform: translateX(-50%);
}

.train-face__mouth {
  position: absolute;
  top: 73px;
  left: 50%;
  width: 19px;
  height: 8px;
  border-bottom: 2px solid rgba(120, 53, 15, 0.5);
  border-radius: 0 0 50% 50%;
  transform: translateX(-50%);
}

.train-camera__badge {
  position: absolute;
  bottom: 6px;
  left: 50%;
  padding: 2px 7px;
  border: 1px solid #475569;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.68);
  color: #e2e8f0;
  font-size: 6.5px;
  font-weight: 800;
  white-space: nowrap;
  transform: translateX(-50%);
}

.train-quality { display: flex; gap: 3px; }

.train-quality span {
  flex: 1;
  padding: 4px 2px;
  border-radius: 6px;
  background: #eef2f7;
  color: #475569;
  font-size: 7px;
  font-weight: 900;
  text-align: center;
}

.train-quality span.is-on { background: #dcfce7; color: #146c2e; }
.train-quality span.is-warn { background: #fef3c7; color: #b45309; }

.train-signs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}

.train-signs span {
  padding: 3px 4px;
  border-radius: 5px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 6.5px;
  font-weight: 700;
  text-align: center;
}

.train-parentcard {
  position: relative;
  padding: 8px;
  border: 1px solid #bae6fd;
  border-radius: 11px;
  background: linear-gradient(150deg, #ecfeff, #e0f2fe);
}

.train-parentcard__tag {
  display: inline-block;
  padding: 2px 5px;
  border: 1px solid #bae6fd;
  border-radius: 999px;
  background: #fff;
  color: #0369a1;
  font-size: 6.5px;
  font-weight: 900;
}

.train-blur-lines { margin: 6px 0; filter: blur(2px); }

.train-blur-lines i {
  display: block;
  height: 5px;
  margin-bottom: 3px;
  border-radius: 999px;
  background: #7dd3fc;
  opacity: 0.7;
}

.train-blur-lines i:nth-child(2) { width: 80%; }
.train-blur-lines i:nth-child(3) { width: 62%; }

.train-parentcard__badges { display: flex; gap: 4px; }

.train-parentcard__badges span {
  flex: 1;
  padding: 3px 2px;
  border-radius: 6px;
  background: #fff;
  color: #0c4a6e;
  font-size: 7px;
  font-weight: 800;
  text-align: center;
}

.train-audit {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: auto;
  padding: 6px 7px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}

.train-audit small { color: #64748b; font-size: 6.5px; font-weight: 900; }

.train-audit__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  color: #334155;
  font-size: 6.5px;
  font-weight: 700;
}

.train-audit__row span {
  direction: ltr;
  font-family: 'JetBrains Mono', monospace;
  font-size: 6.5px;
}

.train-audit__row b {
  padding: 0 4px;
  border-radius: 4px;
  background: #dcfce7;
  color: #146c2e;
  font-size: 7px;
  font-weight: 900;
}

/* ---------- Scenario cards ---------- */
.train-scenarios__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.train-scenarios__intro { min-width: 0; }

.train-scenarios__intro h3 {
  margin: 0;
  color: var(--tr-ink);
  font-size: clamp(16px, 2vw, 19px);
  font-weight: 800;
}

.train-scenarios__intro p {
  margin: 3px 0 0;
  color: var(--tr-muted);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.65;
}

.train-score {
  flex: 0 0 auto;
  padding: 6px 11px;
  border-radius: 999px;
  background: var(--tr-teal);
  color: #fff;
  font-size: 10.5px;
  font-weight: 900;
  white-space: nowrap;
}

.train-scenario-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.train-scenario {
  overflow: hidden;
  border: 1px solid var(--tr-border);
  border-radius: 18px;
  background: #fff;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.train-scenario.is-open {
  border-color: #99d6c6;
  box-shadow: 0 12px 28px -24px rgba(15, 118, 110, 0.8);
}

.train-scenario__head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  background: linear-gradient(135deg, #f8fafc, #eef6ff);
  color: var(--tr-ink);
  font-family: inherit;
  text-align: right;
  cursor: pointer;
}

.train-scenario__emoji {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 1px solid var(--tr-border);
  border-radius: 12px;
  background: #fff;
  font-size: 18px;
}

.train-scenario__titles { flex: 1; min-width: 0; }

.train-scenario__titles strong {
  display: block;
  font-size: 12.5px;
  font-weight: 800;
  line-height: 1.5;
}

.train-scenario__titles small {
  display: block;
  margin-top: 1px;
  color: var(--tr-muted);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.5;
}

.train-scenario__chev {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

.train-scenario.is-open .train-scenario__chev { background: #ccfbf1; color: #0f766e; }

.train-scenario__body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 0 14px 14px;
}

.train-scenario__block {
  padding: 9px 11px;
  border-right: 3px solid;
  border-radius: 12px;
  background: #f8fafc;
}

.train-scenario__block span {
  display: block;
  margin-bottom: 3px;
  font-size: 8.5px;
  font-weight: 900;
  letter-spacing: 0.01em;
}

.train-scenario__block p {
  margin: 0;
  color: #334155;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.8;
}

.train-scenario__block--a { border-color: #94a3b8; background: #f8fafc; }
.train-scenario__block--a span { color: #475569; }
.train-scenario__block--b { border-color: #60a5fa; background: #eff6ff; }
.train-scenario__block--b span { color: #1d4ed8; }
.train-scenario__block--c { border-color: #34d399; background: #ecfdf5; }
.train-scenario__block--c span { color: #047857; }
.train-scenario__block--d { border-color: #fbbf24; background: #fffbeb; }
.train-scenario__block--d span { color: #b45309; }

.train-reveal {
  padding: 9px;
  border: 1px dashed #94a3b8;
  border-radius: 10px;
  background: #fff;
  color: var(--tr-primary);
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.train-reveal:hover { border-color: #60a5fa; background: #eff6ff; }

.train-scenario__answer {
  display: flex;
  flex-direction: column;
  gap: 7px;
  animation: trainReveal 220ms ease-out;
}

@keyframes trainReveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.train-scenario__speak {
  align-self: flex-start;
  padding: 5px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: var(--tr-primary);
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 800;
  cursor: pointer;
}

.train-scenario__speak:hover { background: #dbeafe; }
.train-scenario__speak:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---------- Responsive ---------- */
@media (max-width: 900px) {
  .train-stage__grid { grid-template-columns: 1fr; }
  .train-visual { order: -1; }
  .train-phone { width: min(270px, 82vw); }
  .train-scenario-grid { grid-template-columns: 1fr; }
  .train-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .train-overlay { padding: 0; }
  .train-dialog {
    width: 100%;
    max-height: 100dvh;
    height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .train-header { padding: 12px 14px; }
  .train-header__mark { width: 42px; height: 42px; border-radius: 14px; font-size: 21px; }
  .train-header p { display: none; }
  .train-voice-toggle { width: 40px; padding: 0; font-size: 15px; }
  .train-voice-toggle span:last-child { display: none; }
  .train-modebar { padding: 8px 12px; }
  .train-modes button { padding: 7px 11px; font-size: 11.5px; }
  .train-body { padding: 12px 10px 20px; }
  .train-rail {
    display: flex;
    gap: 5px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .train-rail::-webkit-scrollbar { display: none; }
  .train-rail__item { flex: 0 0 auto; padding: 7px 9px; }
  .train-rail__label { font-size: 10.5px; }
  .train-stage__head { padding: 12px 13px 10px; }
  .train-stage__grid { padding: 13px; gap: 14px; }
  .train-checklist { margin: 0 13px 13px; }
  .train-checklist ul { grid-template-columns: 1fr; }
  .train-stage__nav { padding: 10px 13px; }
  .train-stage__progress { font-size: 9.5px; }
  .train-voice__text { font-size: 12px; line-height: 1.9; }
  .train-scenarios__head { align-items: flex-start; flex-direction: column; gap: 7px; }
  .train-scenario__head { padding: 10px 12px; }
  .train-scenario__body { padding: 0 12px 12px; }
}

@media (max-width: 420px) {
  .train-header h2 { font-size: 15.5px; }
  .train-header__mark { width: 38px; height: 38px; font-size: 19px; }
  .train-close { width: 36px; min-height: 36px; }
  .train-voice-toggle { width: 36px; min-height: 36px; }
  .train-phone { width: min(250px, 84vw); }
  .train-nav-btn { padding: 0 11px; font-size: 10.5px; }
  .train-stage__progress { display: none; }
  .train-scenario__titles strong { font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .train-dialog,
  .train-callout::before,
  .train-scenario__answer {
    animation: none !important;
  }
}

.train-resources { padding: 22px 20px 26px; }
.train-resources__head { margin-bottom: 16px; }
.train-resources__head h3 { margin: 0 0 6px; font-size: 16px; font-weight: 900; }
.train-resources__head p { margin: 0; color: var(--tr-muted); font-size: 12.5px; }
.train-resources__grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.train-resource-card { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--tr-border); border-radius: 16px; background: #fff; text-align: right; text-decoration: none; color: inherit; transition: box-shadow 140ms ease, transform 140ms ease; }
.train-resource-card:hover { box-shadow: 0 8px 22px -10px rgba(2, 12, 27, 0.28); transform: translateY(-1px); }
.train-resource-card__emoji { font-size: 20px; line-height: 1; }
.train-resource-card strong { display: block; font-size: 13px; font-weight: 800; }
.train-resource-card small { display: block; color: var(--tr-muted); font-size: 11px; margin-top: 2px; }
.train-resource-card--btn { cursor: pointer; }
.train-resources__note { margin-top: 14px; font-size: 11.5px; color: var(--tr-muted); }

`;
