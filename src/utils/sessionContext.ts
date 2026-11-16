/**
 * School-session context shared by consecutive children on the same morning.
 * Only session-level fields are persisted; per-child clinical data never is.
 */
export const SESSION_CONTEXT_KEY = 'albasar_session_context_v3';

export interface SchoolSessionContext {
  schoolName: string;
  schoolSector: string;
  referralPHCC: string;
  examinerId: string;
  paperExaminerId: string;
  smartExaminerId: string;
  gradeLevel: number;
  updatedAt: string;
}

export const EMPTY_SESSION_CONTEXT: SchoolSessionContext = {
  schoolName: '',
  schoolSector: '',
  referralPHCC: '',
  examinerId: '',
  paperExaminerId: '',
  smartExaminerId: '',
  gradeLevel: 0,
  updatedAt: '',
};

const safeText = (value: unknown): string => (typeof value === 'string' ? value : '');

export const readSessionContext = (): SchoolSessionContext => {
  try {
    const raw = localStorage.getItem(SESSION_CONTEXT_KEY);
    if (!raw) return { ...EMPTY_SESSION_CONTEXT };
    const parsed = JSON.parse(raw) as Partial<SchoolSessionContext>;
    const grade = Number(parsed.gradeLevel);
    return {
      schoolName: safeText(parsed.schoolName),
      schoolSector: safeText(parsed.schoolSector),
      referralPHCC: safeText(parsed.referralPHCC),
      examinerId: safeText(parsed.examinerId),
      paperExaminerId: safeText(parsed.paperExaminerId),
      smartExaminerId: safeText(parsed.smartExaminerId),
      gradeLevel: Number.isInteger(grade) && grade >= 1 && grade <= 6 ? grade : 0,
      updatedAt: safeText(parsed.updatedAt),
    };
  } catch {
    return { ...EMPTY_SESSION_CONTEXT };
  }
};

export const writeSessionContext = (
  context: Omit<SchoolSessionContext, 'updatedAt'>,
): void => {
  try {
    localStorage.setItem(
      SESSION_CONTEXT_KEY,
      JSON.stringify({ ...context, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Session prefill is an ergonomic convenience; failure must never block screening.
  }
};

/** Default expected age for an Iraqi primary grade; the examiner can adjust ±1 year. */
export const defaultAgeForGrade = (gradeLevel: number): number =>
  gradeLevel >= 1 && gradeLevel <= 6 ? gradeLevel + 5 : 0;
