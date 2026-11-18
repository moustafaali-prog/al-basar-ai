/** Lightweight Supabase configuration check (no Supabase SDK import). */
const FALLBACK_SUPABASE_URL = 'https://trtdzybvatxvdqmklmwx.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_2Mi2teVgdMkaJlqOYWNqcQ_Ft7Y4vLW';

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

const SUPABASE_URL = isRealKey(ENV_SUPABASE_URL) ? ENV_SUPABASE_URL
  : isRealKey(LOCAL_SUPABASE_URL) ? LOCAL_SUPABASE_URL
  : FALLBACK_SUPABASE_URL;

const SUPABASE_ANON_KEY = isRealKey(ENV_SUPABASE_ANON_KEY) ? ENV_SUPABASE_ANON_KEY
  : isRealKey(LOCAL_SUPABASE_ANON_KEY) ? LOCAL_SUPABASE_ANON_KEY
  : FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean =>
  isRealKey(SUPABASE_URL) && isRealKey(SUPABASE_ANON_KEY);

export const SUPABASE_URL_VALUE = SUPABASE_URL;
export const SUPABASE_ANON_KEY_VALUE = SUPABASE_ANON_KEY;
