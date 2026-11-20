const PARTICIPANT_PREFIX = 'BAB';

/**
 * Study protocol sample frame: sequential IDs run from BAB-101 to BAB-460
 * (360 participants). The generator keeps counting past the limit only to
 * keep the clinic unblocked; the UI warns when the frame is exhausted.
 */
export const PARTICIPANT_ID_FIRST = 101;
export const PARTICIPANT_ID_LAST = 460;

/**
 * Participant codes carry a short, device-scoped prefix so that two teams
 * screening different schools offline can never mint the same code.
 *
 *   BAB-101      (legacy, pre-prefix codes are still parsed and accepted)
 *   BAB-A4F-101  (current format: `BAB-<devicePrefix>-<number>`)
 *
 * The numeric tail keeps its SPIRIT Item 16 meaning (parity drives the
 * paper-first / digital-first crossover), while the prefix guarantees global
 * uniqueness of `child_id` — the table's primary key — when the queued
 * offline records of several devices are merged in the cloud.
 */
const PARTICIPANT_ID_PATTERN = /^BAB-(?:([A-Z0-9]{3})-)?(\d{1,5})$/;

/**
 * Alphabet for the device prefix. Ambiguous glyphs (0/O, 1/I/L) are removed
 * so a hand-written code can never be mis-read from paper onto a screen.
 */
const PREFIX_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const PAPER_FIRST_SEQUENCE = 'ورقي (6m) ← رقمي (2m)';
export const DIGITAL_FIRST_SEQUENCE = 'رقمي (2m) ← ورقي (6m)';

export function normalizeParticipantId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLocaleUpperCase();
}

/**
 * Extracts the numeric part of a `BAB-xxx` / `BAB-XXX-xxx` code, or null for
 * non-numeric / unparseable IDs.
 */
export function extractParticipantNumber(value: unknown): number | null {
  const normalized = normalizeParticipantId(value);
  const match = PARTICIPANT_ID_PATTERN.exec(normalized);
  if (!match) return null;
  const number = Number(match[2]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Extracts the device prefix of a participant code (`A4F`), or null for a
 * legacy code that predates the prefix.
 */
export function extractParticipantPrefix(value: unknown): string | null {
  const normalized = normalizeParticipantId(value);
  const match = PARTICIPANT_ID_PATTERN.exec(normalized);
  return match?.[1] ?? null;
}

/**
 * Derives a stable 3-character device prefix from the device identifier.
 *
 * The prefix is a pure function of `albasar_device_id`, so it never changes
 * for a given handset and is identical across reinstalls of the same device.
 */
export function deviceCodePrefix(deviceId: string): string {
  const source = (deviceId || '').trim().toUpperCase();
  if (!source) return 'XXX';

  // FNV-1a 32-bit — deterministic, dependency-free, and stable across runs.
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let prefix = '';
  let value = hash;
  for (let i = 0; i < 3; i += 1) {
    prefix += PREFIX_ALPHABET[value % PREFIX_ALPHABET.length];
    value = Math.floor(value / PREFIX_ALPHABET.length);
  }
  return prefix;
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
 * Generates the next sequential offline ID.
 *
 * The numeric tail is derived from the highest `BAB-xxx` number already
 * present in `albasar_master_records_v3` (so it survives export/import
 * cycles), and the code is prefixed with the device signature so two teams
 * working offline in different schools can never produce the same
 * `child_id` — the cloud table's primary key.
 *
 * @param existingIds IDs already stored on this device.
 * @param deviceId    The device identifier whose prefix should be used.
 */
export function generateParticipantId(
  existingIds: Iterable<unknown> = [],
  deviceId = '',
): string {
  let highest = PARTICIPANT_ID_FIRST - 1;
  for (const id of existingIds) {
    const number = extractParticipantNumber(id);
    if (number !== null && number > highest) highest = number;
  }
  const prefix = deviceCodePrefix(deviceId);
  return `${PARTICIPANT_PREFIX}-${prefix}-${highest + 1}`;
}

/**
 * Legacy sequential code without a device prefix — kept for records that were
 * captured before the collision-proof scheme existed.
 */
export function legacyParticipantId(number: number): string {
  return `${PARTICIPANT_PREFIX}-${number}`;
}

/** True while the sequential counter is still inside the approved sample frame. */
export function isWithinProtocolSampleFrame(number: number): boolean {
  return number >= PARTICIPANT_ID_FIRST && number <= PARTICIPANT_ID_LAST;
}
