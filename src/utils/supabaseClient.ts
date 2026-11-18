import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY_VALUE,
  SUPABASE_URL_VALUE,
} from './supabaseConfig';

/**
 * Supabase client for Al-Basar AI v3.
 * Returns null when env vars are missing or still placeholders, so the app
 * remains 100% offline-first and the localStorage fallback is never disrupted.
 *
 * This module is dynamically imported only when the examiner taps the sync
 * action, keeping the Supabase SDK out of the initial PWA bundle.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;
  if (!isSupabaseConfigured()) return null;
  try {
    _client = createClient(SUPABASE_URL_VALUE, SUPABASE_ANON_KEY_VALUE, {
      auth: {
        // Persist the examiner session locally so the account survives
        // offline reloads. Screening itself never requires a session.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'albasar_cloud_auth_v1',
      },
      global: { headers: { 'X-Client-Info': 'albasar-ai-v3' } },
    });
    return _client;
  } catch {
    return null;
  }
}

export const supabase = getSupabaseClient();
