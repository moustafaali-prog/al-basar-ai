/**
 * Zero-friction local examiner identity.
 *
 * The clinical workflow must never be blocked by a pending email confirmation,
 * a missing network connection, or a Supabase outage. The examiner account is
 * therefore persisted on the device itself so the app can keep working offline
 * and resume cloud sync later.
 *
 * Plain-text passwords are NEVER written to localStorage by this module.
 */

export const DEVICE_ID_KEY = 'albasar_device_id';
export const EXAMINER_PROFILE_KEY = 'albasar_examiner_profile_v3';
export const LOCAL_ACCOUNTS_KEY = 'albasar_local_accounts_v3';
/** Explicit "lock this app" marker — cleared by a successful unlock. */
export const SESSION_LOCKED_KEY = 'albasar_session_locked_v1';

export interface ExaminerProfile {
  /** Full triple name, e.g. "أحمد محمد علي". */
  fullName: string;
  email: string;
  /** Stable per-device identifier used to attribute every screening record. */
  deviceId: string;
  /** Cloud account id (absent for purely local accounts). */
  userId: string;
  /** "Keep me signed in on this device" — drives silent session restore. */
  rememberMe: boolean;
  savedAt: string;
}

interface LocalAccount {
  username: string;
  email: string;
  fullName: string;
}

const safeGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
};

const safeSet = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch { /* storage may be full or blocked */ }
};

const safeRemove = (key: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
};

const randomToken = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Return the stable device identifier, creating (and persisting) it on first
 * use. Every record created on this device carries the same `device_id`.
 */
export const getOrCreateDeviceId = (): string => {
  const existing = safeGet(DEVICE_ID_KEY)?.trim();
  if (existing) return existing;
  const created = `ALD-${randomToken()}`;
  safeSet(DEVICE_ID_KEY, created);
  return created;
};

/** Read the persisted examiner profile, or null when the device has no account. */
export const loadExaminerProfile = (): ExaminerProfile | null => {
  const raw = safeGet(EXAMINER_PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ExaminerProfile>;
    if (!parsed || typeof parsed !== 'object') return null;
    const fullName = typeof parsed.fullName === 'string' ? parsed.fullName.trim() : '';
    const email = typeof parsed.email === 'string' ? parsed.email.trim() : '';
    if (!fullName && !email) return null;
    return {
      fullName,
      email,
      deviceId: typeof parsed.deviceId === 'string' && parsed.deviceId.trim()
        ? parsed.deviceId.trim()
        : getOrCreateDeviceId(),
      userId: typeof parsed.userId === 'string' ? parsed.userId.trim() : '',
      rememberMe: parsed.rememberMe !== false,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
};

/** Persist the examiner profile. No password is accepted or stored. */
export const saveExaminerProfile = (
  profile: {
    fullName: string;
    email: string;
    deviceId?: string;
    userId?: string;
    rememberMe?: boolean;
  },
): ExaminerProfile => {
  const previous = loadExaminerProfile();
  const saved: ExaminerProfile = {
    fullName: profile.fullName.trim(),
    email: profile.email.trim(),
    deviceId: profile.deviceId?.trim() || getOrCreateDeviceId(),
    userId: profile.userId?.trim() ?? previous?.userId ?? '',
    rememberMe: profile.rememberMe ?? previous?.rememberMe ?? true,
    savedAt: new Date().toISOString(),
  };
  safeSet(EXAMINER_PROFILE_KEY, JSON.stringify(saved));
  return saved;
};

/** Remove the local profile (used by the one-tap sign-out). */
export const clearExaminerProfile = (): void => {
  safeRemove(EXAMINER_PROFILE_KEY);
};

/**
 * Persists the examiner's "keep me signed in" preference without touching the
 * rest of the profile (used by the auth screen checkbox).
 */
export const setRememberMe = (rememberMe: boolean): void => {
  const profile = loadExaminerProfile();
  if (!profile) return;
  safeSet(EXAMINER_PROFILE_KEY, JSON.stringify({ ...profile, rememberMe }));
};

/* ------------------------------------------------------------------ *
 * Session lock
 * ------------------------------------------------------------------ */

/** True when the examiner explicitly locked the app on this device. */
export const isSessionLocked = (): boolean => safeGet(SESSION_LOCKED_KEY) === '1';

/** Marks the app as locked (the gate is shown on the next launch). */
export const setSessionLocked = (locked: boolean): void => {
  if (locked) safeSet(SESSION_LOCKED_KEY, '1');
  else safeRemove(SESSION_LOCKED_KEY);
};

/** Normalised username derived from the triple name, e.g. "أحمد محمد علي" -> "أحمد". */
export const usernameFromFullName = (fullName: string): string => {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first.replace(/[^\p{L}\p{N}_-]/gu, '');
};

/** Compact label for the top-bar badge: first name, else the email prefix. */
export const shortDisplayName = (fullName: string, email: string): string => {
  const fromName = fullName.trim().split(/\s+/)[0] ?? '';
  if (fromName) return fromName;
  const fromEmail = email.trim().split('@')[0] ?? '';
  return fromEmail || 'فاحص';
};

const readLocalAccounts = (): LocalAccount[] => {
  const raw = safeGet(LOCAL_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalAccount =>
        !!item && typeof item.email === 'string' && typeof item.username === 'string',
    );
  } catch {
    return [];
  }
};

/**
 * Remember accounts created on this device so the examiner can sign in with
 * the short name instead of typing the full email again.
 */
export const registerLocalAccount = (account: { fullName: string; email: string }): void => {
  const email = account.email.trim().toLowerCase();
  if (!email) return;
  const username = usernameFromFullName(account.fullName);
  if (!username) return;
  const accounts = readLocalAccounts().filter((item) => item.email !== email);
  accounts.push({ username, email, fullName: account.fullName.trim() });
  safeSet(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts.slice(-20)));
};

/** Resolve a locally known username to its email, or null when unknown. */
export const findLocalAccountEmail = (identifier: string): string | null => {
  const account = findLocalAccount(identifier);
  return account ? account.email : null;
};

/** Resolve a locally known username (or email) to the stored account. */
export const findLocalAccount = (identifier: string): LocalAccount | null => {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;
  const accounts = readLocalAccounts();
  const byEmail = accounts.find((item) => item.email === value);
  if (byEmail) return byEmail;
  const byUsername = accounts.find((item) => item.username.toLowerCase() === value);
  return byUsername ?? null;
};
