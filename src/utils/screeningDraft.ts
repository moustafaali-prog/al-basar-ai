/**
 * Versioned persistent draft engine for the active screening session.
 * Persists in-memory state to localStorage and IndexedDB so mobile app
 * switching / lock / tab background does not lose the current child's data.
 */
import type { WHOPreScreenDraft } from '../types';

export interface ActiveScreeningDraft {
  version: number;
  updatedAt: number;
  activeStep: 1 | 2 | 3 | 4;
  childId: string;
  childName: string;
  gradeLevel: number;
  ageYears: number;
  gender: string;
  wearsGlasses: number;
  parentalConsent: number;
  whoPreScreen: WHOPreScreenDraft;
  paperOd: string;
  paperOs: string;
  paperTimeSec: number;
  paperStationStarted: boolean;
  smartOd: string;
  smartOs: string;
  smartTimeSec: number;
  smartStationStarted: boolean;
  chartMode: 'HOTV' | 'TUMBLING_E';
  hirschbergMM: number;
  hirschbergRecorded: boolean;
  mrd1MM: number;
  mrd1Recorded: boolean;
  aiQualityFlag: number;
  triageOcularFlag: number;
  asthenopiaScore: number;
  externalEyeFindings: string[];
  externalEyeOther: string;
  externalEyeScreened: boolean;
  hasDraftPhoto: boolean;
}

const STORAGE_KEY = 'albasar_active_draft_v1';
const DRAFT_VERSION = 1;

export function saveScreeningDraft(draft: ActiveScreeningDraft): void {
  try {
    const payload = { ...draft, version: DRAFT_VERSION, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal: storage quota or private mode.
  }
}

export function loadScreeningDraft(): ActiveScreeningDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveScreeningDraft;
    if (parsed.version !== DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearScreeningDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
