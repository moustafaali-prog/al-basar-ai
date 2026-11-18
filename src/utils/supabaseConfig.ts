/** Lightweight Supabase configuration check (no Supabase SDK import). */
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/**
 * A key is considered configured only when it is non-empty and not one of the
 * placeholders shipped in `.env.example`.
 */
const isRealKey = (value: string): boolean =>
  value.length > 0 && !/YOUR-|PROJECT-REF|PUBLIC-ANON-KEY/i.test(value);

export const isSupabaseConfigured = (): boolean =>
  isRealKey(SUPABASE_URL) && isRealKey(SUPABASE_ANON_KEY);

export const SUPABASE_URL_VALUE = SUPABASE_URL;
export const SUPABASE_ANON_KEY_VALUE = SUPABASE_ANON_KEY;
