const PARTICIPANT_PREFIX = 'BAB';

/**
 * Study protocol sample frame: sequential IDs run from BAB-101 to BAB-460
 * (360 participants). The generator keeps counting past the limit only to
 * keep the clinic unblocked; the UI warns when the frame is exhausted.
 */
export const PARTICIPANT_ID_FIRST = 101;
export const PARTICIPANT_ID_LAST = 460;

/** Matches strictly numeric participant codes (BAB-101 ... BAB-460). */
const PARTICIPANT_ID_PATTERN = /^BAB-(\d{1,5})$/;

export const PAPER_FIRST_SEQUENCE = 'ورقي (6m) ← رقمي (2m)';
export const DIGITAL_FIRST_SEQUENCE = 'رقمي (2m) ← ورقي (6m)';

export function normalizeParticipantId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleUpperCase() : '';
}

/** Extracts the numeric part of a `BAB-xxx` code, or null for non-numeric/legacy IDs. */
export function extractParticipantNumber(value: unknown): number | null {
  const normalized = normalizeParticipantId(value);
  const match = PARTICIPANT_ID_PATTERN.exec(normalized);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * SPIRIT Item 16 - auto-counterbalanced crossover assignment by ID parity:
 * odd codes (BAB-101, BAB-103, ...) start with the paper 6m chart;
 * even codes (BAB-102, BAB-104, ...) start with the smart 2m test.
 */
export function crossoverSequenceForParticipantNumber(number: number): string {
  return number % 2 === 1 ? PAPER_FIRST_SEQUENCE : DIGITAL_FIRST_SEQUENCE;
}

/** Same rule, applied directly to a participant ID string. */
export function crossoverSequenceForParticipantId(value: unknown): string | null {
  const number = extractParticipantNumber(value);
  return number === null ? null : crossoverSequenceForParticipantNumber(number);
}

/**
 * Generates the next sequential offline ID (BAB-101, BAB-102, ...).
 * The sequence is derived from the numeric `BAB-xxx` codes already present in
 * `albasar_master_records_v3`, so it survives export/import cycles and does
 * not depend on device-local record counts alone.
 */
export function generateParticipantId(existingIds: Iterable<unknown> = []): string {
  let highest = PARTICIPANT_ID_FIRST - 1;
  for (const id of existingIds) {
    const number = extractParticipantNumber(id);
    if (number !== null && number > highest) highest = number;
  }
  return `${PARTICIPANT_PREFIX}-${highest + 1}`;
}

/** True while the sequential counter is still inside the approved sample frame. */
export function isWithinProtocolSampleFrame(number: number): boolean {
  return number >= PARTICIPANT_ID_FIRST && number <= PARTICIPANT_ID_LAST;
}
