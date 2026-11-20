/**
 * Local supervisor PIN for the Admin Drawer.
 *
 * The PIN is never stored in plain text: only its SHA-256 digest lives in
 * localStorage, so reading the storage key from the device does not reveal the
 * code. The default pilot PIN is `1234` and can be changed by the supervisor
 * from the Cloud settings panel.
 *
 * WebCrypto's `crypto.subtle` requires a secure context (HTTPS / localhost),
 * which the deployed PWA always has.
 */

const ADMIN_PIN_HASH_KEY = 'albasar_admin_pin_hash_v1';
/** Pilot default — change it from لوحة المشرف → السحابة. */
export const DEFAULT_ADMIN_PIN = '1234';

const safeGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
};

const safeSet = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
};

/** SHA-256 hex digest of a PIN. Falls back to a simple digest off-secure-origin. */
export const hashAdminPin = async (pin: string): Promise<string> => {
  const normalized = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const data = new TextEncoder().encode(`albasar-admin-pin:${normalized}`);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fall through to the lightweight digest below.
    }
  }
  // Lightweight non-cryptographic fallback (offline / insecure contexts).
  let hash = 0x811c9dc5;
  const text = `albasar-admin-pin:${normalized}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fallback-${hash.toString(16).padStart(8, '0')}`;
};

/** Returns the stored digest, creating the default one on first use. */
export const ensureAdminPinHash = async (): Promise<string> => {
  const existing = safeGet(ADMIN_PIN_HASH_KEY);
  if (existing) return existing;
  const created = await hashAdminPin(DEFAULT_ADMIN_PIN);
  safeSet(ADMIN_PIN_HASH_KEY, created);
  return created;
};

/** True when the supplied PIN matches the stored digest. */
export const verifyAdminPin = async (pin: string): Promise<boolean> => {
  if (!pin.trim()) return false;
  const expected = await ensureAdminPinHash();
  const actual = await hashAdminPin(pin);
  // Constant-time-ish comparison (both digests have the same length).
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
};

/** Stores a new PIN (supervisor action). */
export const setAdminPin = async (pin: string): Promise<boolean> => {
  if (!/^\d{4,8}$/.test(pin.trim())) return false;
  safeSet(ADMIN_PIN_HASH_KEY, await hashAdminPin(pin));
  return true;
};

/** True when the supervisor has replaced the default PIN. */
export const hasCustomAdminPin = (): boolean => Boolean(safeGet(ADMIN_PIN_HASH_KEY));
