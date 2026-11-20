/** Lightweight Supabase configuration check (no Supabase SDK import). */
const FALLBACK_SUPABASE_URL = 'https://trtdzybvatxvdqmklmwx.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_2Mi2teVgdMkaJlqOYWNqcQ_Ft7Y4vLW';

const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const ENV_SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const getStored = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

const normalizeUrl = (u: string) => u.replace(/\/+$/, '');

const RESOLVED_SUPABASE_URL = normalizeUrl(
  getStored('albasar_supabase_url') || ENV_SUPABASE_URL || FALLBACK_SUPABASE_URL
);
const RESOLVED_SUPABASE_ANON_KEY =
  getStored('albasar_supabase_anon_key') || ENV_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

/**
 * A key is considered configured only when it is non-empty and not one of the
 * placeholders shipped in `.env.example`.
 */
const isRealKey = (value: string): boolean =>
  value.length > 0 && !/YOUR-|PROJECT-REF|PUBLIC-ANON-KEY/i.test(value);

const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const ENV_SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const LOCAL_SUPABASE_URL = (localStorage.getItem('albasar_supabase_url') ?? '').trim();
const LOCAL_SUPABASE_ANON_KEY = (localStorage.getItem('albasar_supabase_anon_key') ?? '').trim();

const SUPABASE_URL = (isRealKey(ENV_SUPABASE_URL) ? ENV_SUPABASE_URL
  : isRealKey(LOCAL_SUPABASE_URL) ? LOCAL_SUPABASE_URL
  : FALLBACK_SUPABASE_URL).replace(/\/+$/, '');

const SUPABASE_ANON_KEY = (isRealKey(ENV_SUPABASE_ANON_KEY) ? ENV_SUPABASE_ANON_KEY
  : isRealKey(LOCAL_SUPABASE_ANON_KEY) ? LOCAL_SUPABASE_ANON_KEY
  : FALLBACK_SUPABASE_ANON_KEY).trim();

/**
 * The URL must be an HTTPS Supabase project URL. This prevents silently
 * sending screening data to a misconfigured or trailing-slash URL.
 */
const isValidSupabaseUrl = (value: string): boolean =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value);

export const isSupabaseConfigured = (): boolean =>
  isRealKey(RESOLVED_SUPABASE_URL) && isRealKey(RESOLVED_SUPABASE_ANON_KEY);

export const SUPABASE_URL_VALUE = RESOLVED_SUPABASE_URL;
export const SUPABASE_ANON_KEY_VALUE = RESOLVED_SUPABASE_ANON_KEY;

/* Allow runtime overrides from CloudAuthModal UI */
export const setSupabaseLocalOverrides = (url?: string, key?: string) => {
  if (typeof window === 'undefined') return;
  try {
    if (url !== undefined) localStorage.setItem('albasar_supabase_url', url.trim());
    if (key !== undefined) localStorage.setItem('albasar_supabase_anon_key', key.trim());
  } catch {}
};

export const clearSupabaseLocalOverrides = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('albasar_supabase_url');
    localStorage.removeItem('albasar_supabase_anon_key');
  } catch {}
};
