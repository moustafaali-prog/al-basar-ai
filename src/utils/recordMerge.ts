import { StudentScreeningRecord } from '../types';
import { normalizeParticipantId } from './recordIdentity';

export interface RecordMergeAnalysis {
  additions: StudentScreeningRecord[];
  exactDuplicates: number;
  conflicts: string[];
  importedCount: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidRecord(value: unknown): value is StudentScreeningRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<StudentScreeningRecord>;
  const requiredStrings: (keyof StudentScreeningRecord)[] = [
    'Child_ID', 'Examiner_ID', 'Examination_Date', 'School_Name', 'School_Sector',
    'Gender', 'Crossover_Sequence', 'Paper_Snellen_OD', 'Paper_Snellen_OS',
    'Smart_Snellen_OD', 'Smart_Snellen_OS',
  ];
  if (requiredStrings.some((key) => typeof record[key] !== 'string' || String(record[key]).length > 300)) return false;
  if (!normalizeParticipantId(record.Child_ID)) return false;

  const requiredNumbers: (keyof StudentScreeningRecord)[] = [
    'Parental_Consent', 'Grade_Level', 'Age_Years', 'Wears_Glasses',
    'Paper_LogMAR_OD', 'Paper_LogMAR_OS', 'Paper_Time_Sec', 'Paper_Referral',
    'Smart_LogMAR_OD', 'Smart_LogMAR_OS', 'Smart_IOD_LogMAR', 'Smart_Time_Sec',
    'Hirschberg_Asym_mm', 'Hirschberg_Prism_Diopters', 'MRD1_Min_mm',
    'Triage_Ocular_Flag', 'Asthenopia_Score', 'Final_Triage_Referral', 'FollowUp_Status',
  ];
  if (requiredNumbers.some((key) => !isFiniteNumber(record[key]))) return false;

  if (record.Gold_Standard_Confirmed !== undefined && ![0, 1, 99].includes(Number(record.Gold_Standard_Confirmed))) return false;
  return true;
}

export function parseRecordBackup(text: string): StudentScreeningRecord[] {
  if (text.length > 25_000_000) throw new Error('حجم النسخة الاحتياطية يتجاوز 25 ميغابايت.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('الملف ليس JSON صالحاً. استخدم نسخة JSON الاحتياطية الصادرة من النظام.');
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { records?: unknown }).records)
      ? (parsed as { records: unknown[] }).records
      : null;
  if (!rows) throw new Error('لم يُعثر على مصفوفة سجلات في الملف.');
  if (rows.some((record) => !isValidRecord(record))) {
    throw new Error('تحتوي النسخة على سجل ناقص أو غير متوافق؛ لم يُستورد أي سجل.');
  }
  return rows as StudentScreeningRecord[];
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function analyzeRecordMerge(
  existing: StudentScreeningRecord[],
  incoming: StudentScreeningRecord[]
): RecordMergeAnalysis {
  const existingById = new Map<string, StudentScreeningRecord>();
  const conflicts = new Set<string>();
  for (const record of existing) {
    const key = normalizeParticipantId(record.Child_ID);
    const prior = existingById.get(key);
    if (prior && stableSerialize(prior) !== stableSerialize(record)) conflicts.add(record.Child_ID.trim());
    else if (!prior) existingById.set(key, record);
  }

  const seenIncoming = new Map<string, StudentScreeningRecord>();
  const additions: StudentScreeningRecord[] = [];
  let exactDuplicates = 0;
  for (const record of incoming) {
    const key = normalizeParticipantId(record.Child_ID);
    const previousImport = seenIncoming.get(key);
    if (previousImport) {
      if (stableSerialize(previousImport) === stableSerialize(record)) exactDuplicates++;
      else conflicts.add(record.Child_ID.trim());
      continue;
    }
    seenIncoming.set(key, record);

    const previousLocal = existingById.get(key);
    if (!previousLocal) additions.push(record);
    else if (stableSerialize(previousLocal) === stableSerialize(record)) exactDuplicates++;
    else conflicts.add(record.Child_ID.trim());
  }

  return { additions, exactDuplicates, conflicts: Array.from(conflicts), importedCount: incoming.length };
}

export function createRecordBackup(records: StudentScreeningRecord[]) {
  return {
    application: 'Al-Basar AI',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    records,
  };
}
