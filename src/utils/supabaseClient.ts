import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { StudentScreeningRecord } from '../types';
import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY_VALUE,
  SUPABASE_URL_VALUE,
} from './supabaseConfig';

/**
 * Supabase client for Al-Basar AI v3.
 * Returns null when config is missing or still placeholders, so the app
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

/**
 * Ensure an active Supabase session is fresh; if refresh fails or no session
 * exists, return false so callers can fall back to the public anon key.
 */
export async function ensureSessionValid(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return false;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000) {
      const { error } = await client.auth.refreshSession();
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a valid JWT for the signed-in examiner, or `null` when there is no
 * session.
 *
 * ⚠️ The public anon key is deliberately **never** returned here. The cloud
 * dataset is protected by `owner_id = auth.uid()` RLS policies, so an
 * anonymous write would either be rejected by the database or — worse —
 * require the very table-wide SELECT/UPDATE grants that expose every
 * child's record. Offline work stays in the device's local store until the
 * examiner signs in.
 */
export async function getAuthAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data } = await client.auth.getSession();
    const session = data.session;
    if (!session?.access_token) return null;

    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000) {
      try {
        const { data: refreshed, error } = await client.auth.refreshSession();
        if (!error && refreshed.session?.access_token) {
          return refreshed.session.access_token;
        }
      } catch {
        // fall through to the (possibly expired) cached token
      }
    }

    return session.access_token;
  } catch {
    return null;
  }
}

/**
 * Backwards-compatible alias. Kept as a named export so older call sites
 * fail loudly rather than silently downgrading to the anon key.
 */
export async function getBearerToken(): Promise<string | null> {
  return getAuthAccessToken();
}

/** Convert undefined to null so PostgREST receives explicit SQL NULL values. */
const n = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

/**
 * Explicit 1:1 mapper between the local `StudentScreeningRecord` shape and the
 * exact lowercase PostgreSQL columns declared in `supabase/schema.sql`.
 * Local-only fields such as `_syncStatus` are intentionally omitted.
 *
 * @param ownerId The signed-in Supabase account id. It is written to the
 *   `owner_id` column, which the RLS policies match against `auth.uid()` —
 *   this is what keeps one examiner's rows invisible to another.
 */
export function mapRecordToSupabaseRow(
  record: StudentScreeningRecord,
  ownerId?: string | null,
): Record<string, unknown> {
  return {
    child_id: record.Child_ID,
    owner_id: ownerId ?? n(record.Owner_ID),
    examiner_id: record.Examiner_ID,
    examiner_full_name: n(record.Examiner_Full_Name),
    device_id: n(record.Device_ID),
    paper_examiner_id: n(record.Paper_Examiner_ID),
    paper_started_at: n(record.Paper_Started_At),
    paper_completed_at: n(record.Paper_Completed_At),
    smart_examiner_id: n(record.Smart_Examiner_ID),
    smart_started_at: n(record.Smart_Started_At),
    smart_completed_at: n(record.Smart_Completed_At),
    parental_consent: record.Parental_Consent,
    child_assent: n(record.Child_Assent),
    school_name: record.School_Name,
    school_sector: record.School_Sector,
    grade_level: record.Grade_Level,
    age_years: record.Age_Years,
    gender: record.Gender,
    wears_glasses: record.Wears_Glasses,
    who_pre_screen: n(record.WHO_PreScreen),
    who_screening: n(record.WHO_Screening),
    external_eye_findings: n(record.WHO_Screening?.externalEyeFindings),
    who_referral_flag: n(record.WHO_Referral_Flag),
    crossover_sequence: record.Crossover_Sequence,
    paper_snellen_od: record.Paper_Snellen_OD,
    paper_logmar_od: record.Paper_LogMAR_OD,
    paper_snellen_os: record.Paper_Snellen_OS,
    paper_logmar_os: record.Paper_LogMAR_OS,
    paper_logmar_worse: n(record.Paper_LogMAR_Worse),
    paper_time_sec: record.Paper_Time_Sec,
    paper_referral: record.Paper_Referral,
    smart_snellen_od: record.Smart_Snellen_OD,
    smart_acuity_od_below_test_range: n(record.Smart_Acuity_OD_Below_Test_Range),
    smart_logmar_od: record.Smart_LogMAR_OD,
    smart_snellen_os: record.Smart_Snellen_OS,
    smart_acuity_os_below_test_range: n(record.Smart_Acuity_OS_Below_Test_Range),
    smart_logmar_os: record.Smart_LogMAR_OS,
    smart_logmar_worse: n(record.Smart_LogMAR_Worse),
    smart_iod_logmar: record.Smart_IOD_LogMAR,
    smart_time_sec: record.Smart_Time_Sec,
    hirschberg_asym_mm: record.Hirschberg_Asym_mm,
    hirschberg_prism_diopters: record.Hirschberg_Prism_Diopters,
    mrd1_min_mm: record.MRD1_Min_mm,
    triage_ocular_flag: record.Triage_Ocular_Flag,
    ai_quality_flag: n(record.AI_Quality_Flag),
    asthenopia_score: record.Asthenopia_Score,
    final_triage_referral: record.Final_Triage_Referral,
    referral_urgency: record.Referral_Urgency,
    referral_phcc: record.Referral_PHCC,
    follow_up_status: record.FollowUp_Status,
    spectacles_prescribed_fitted: n(record.Spectacles_Prescribed_Fitted),
    gold_standard_confirmed: n(record.Gold_Standard_Confirmed),
    gold_standard_method: n(record.Gold_Standard_Method),
    gold_standard_examiner_id: n(record.Gold_Standard_Examiner_ID),
    gold_standard_date: n(record.Gold_Standard_Date),
    gold_standard_criteria: n(record.Gold_Standard_Criteria),
    gold_standard_masked: n(record.Gold_Standard_Masked),
    eye_photo_url: n(record.Eye_Photo_URL),
    examination_date: record.Examination_Date,
  };
}

/**
 * Reverse mapper: Supabase lowercase row -> local `StudentScreeningRecord`.
 * Mirrors `mapRecordToSupabaseRow` so pulled records keep the exact same
 * 1:1 field contract used when pushing them.
 */
export function mapSupabaseRowToRecord(row: Record<string, unknown>): StudentScreeningRecord {
  const str = (value: unknown): string | undefined =>
    value === null || value === undefined ? undefined : String(value);
  const num = (value: unknown): number | undefined =>
    value === null || value === undefined ? undefined : Number(value);
  const bool = (value: unknown): boolean | undefined =>
    value === null || value === undefined ? undefined : Boolean(value);

  const whoScreening = (row.who_screening ?? null) as StudentScreeningRecord['WHO_Screening'];
  const externalFindings = row.external_eye_findings;

  return {
    Child_ID: String(row.child_id ?? ''),
    Examiner_ID: String(row.examiner_id ?? ''),
    Examiner_Full_Name: str(row.examiner_full_name),
    Device_ID: str(row.device_id),
    Owner_ID: str(row.owner_id),
    _syncStatus: 'synced',
    Paper_Examiner_ID: str(row.paper_examiner_id),
    Paper_Started_At: str(row.paper_started_at),
    Paper_Completed_At: str(row.paper_completed_at),
    Smart_Examiner_ID: str(row.smart_examiner_id),
    Smart_Started_At: str(row.smart_started_at),
    Smart_Completed_At: str(row.smart_completed_at),
    Parental_Consent: num(row.parental_consent) ?? 0,
    Child_Assent: str(row.child_assent) as StudentScreeningRecord['Child_Assent'],
    Examination_Date: str(row.examination_date) ?? new Date().toISOString(),
    School_Name: str(row.school_name) ?? '',
    School_Sector: str(row.school_sector) ?? '',
    Grade_Level: num(row.grade_level) ?? 0,
    Age_Years: num(row.age_years) ?? 0,
    Gender: str(row.gender) ?? '',
    Wears_Glasses: num(row.wears_glasses) ?? 0,
    WHO_PreScreen: (row.who_pre_screen ?? undefined) as StudentScreeningRecord['WHO_PreScreen'],
    WHO_Screening: whoScreening ?? undefined,
    WHO_Referral_Flag: num(row.who_referral_flag),
    Crossover_Sequence: str(row.crossover_sequence) ?? '',
    Paper_Snellen_OD: str(row.paper_snellen_od) ?? '',
    Paper_LogMAR_OD: num(row.paper_logmar_od) ?? 0,
    Paper_Snellen_OS: str(row.paper_snellen_os) ?? '',
    Paper_LogMAR_OS: num(row.paper_logmar_os) ?? 0,
    Paper_LogMAR_Worse: num(row.paper_logmar_worse),
    Paper_Time_Sec: num(row.paper_time_sec) ?? 0,
    Paper_Referral: num(row.paper_referral) ?? 0,
    Smart_Snellen_OD: str(row.smart_snellen_od) ?? '',
    Smart_Acuity_OD_Below_Test_Range: bool(row.smart_acuity_od_below_test_range),
    Smart_LogMAR_OD: num(row.smart_logmar_od) ?? 0,
    Smart_Snellen_OS: str(row.smart_snellen_os) ?? '',
    Smart_Acuity_OS_Below_Test_Range: bool(row.smart_acuity_os_below_test_range),
    Smart_LogMAR_OS: num(row.smart_logmar_os) ?? 0,
    Smart_LogMAR_Worse: num(row.smart_logmar_worse),
    Smart_IOD_LogMAR: num(row.smart_iod_logmar) ?? 0,
    Smart_Time_Sec: num(row.smart_time_sec) ?? 0,
    Hirschberg_Asym_mm: num(row.hirschberg_asym_mm) ?? 0,
    Hirschberg_Prism_Diopters: num(row.hirschberg_prism_diopeters) ?? 0,
    MRD1_Min_mm: num(row.mrd1_min_mm) ?? 0,
    Triage_Ocular_Flag: num(row.triage_ocular_flag) ?? 0,
    AI_Quality_Flag: num(row.ai_quality_flag),
    Asthenopia_Score: num(row.asthenopia_score) ?? 0,
    Final_Triage_Referral: num(row.final_triage_referral) ?? 0,
    Referral_Urgency: (str(row.referral_urgency) ?? 'ROUTINE') as StudentScreeningRecord['Referral_Urgency'],
    Referral_PHCC: str(row.referral_phcc) ?? '',
    FollowUp_Status: num(row.follow_up_status) ?? 0,
    Spectacles_Prescribed_Fitted: num(row.spectacles_prescribed_fitted),
    Gold_Standard_Confirmed: num(row.gold_standard_confirmed),
    Gold_Standard_Method: str(row.gold_standard_method),
    Gold_Standard_Examiner_ID: str(row.gold_standard_examiner_id),
    Gold_Standard_Date: str(row.gold_standard_date),
    Gold_Standard_Criteria: str(row.gold_standard_criteria),
    Gold_Standard_Masked: str(row.gold_standard_masked) as StudentScreeningRecord['Gold_Standard_Masked'],
    Eye_Photo_URL: str(row.eye_photo_url),
    // The dedicated column mirrors WHO_Screening.externalEyeFindings for the
    // supervisor review workflow; keep both in sync when reading a row.
    ...(Array.isArray(externalFindings) && whoScreening
      ? { WHO_Screening: { ...whoScreening, externalEyeFindings: externalFindings as string[] } }
      : {}),
  };
}

/**
 * Fetch every screening row the current role may read. Uses the Supabase
 * client so PostgreSQL RLS decides visibility:
 *   * an examiner sees only the rows whose `owner_id` matches their `auth.uid()`
 *   * an admin (`app_metadata.role = 'admin'`) sees every row
 *
 * There is no anon fallback: an unauthenticated call is rejected by the
 * database rather than silently widening the blast radius.
 */
export async function fetchScreeningRecords(): Promise<StudentScreeningRecord[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');

  const token = await getAuthAccessToken();
  if (!token) {
    throw new Error('تسجيل الدخول مطلوب لقراءة السجلات السحابية.');
  }

  const { data, error } = await client.from(TABLE).select('*');
  if (error) {
    throw new Error(`HTTP ${(error as { status?: number }).status ?? ''}: ${error.message}`);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map(mapSupabaseRowToRecord);
}

/**
 * Resolve a stored eye-photo path into a temporary, signed URL.
 *
 * The `screening-photos` bucket is **private** (IRB): the object path is the
 * only thing persisted in `eye_photo_url`, and every view resolves it through
 * a short-lived signed URL. `path` may also be a legacy public URL, in which
 * case it is returned unchanged.
 */
export async function createSignedPhotoUrl(
  path: string | undefined | null,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const value = (path ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value; // legacy public URL

  const client = getSupabaseClient();
  if (!client) return null;
  const token = await getAuthAccessToken();
  if (!token) return null;

  try {
    const { data, error } = await client.storage
      .from('screening-photos')
      .createSignedUrl(value, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export interface SupabaseDiagnostic {
  ok: boolean;
  status?: number;
  code?: string;
  message: string;
  details?: string;
  hint?: string;
  droppedColumns?: string[];
}

interface PgErrorBody {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function parsePgError(text: string): PgErrorBody {
  try {
    const parsed = JSON.parse(text) as PgErrorBody;
    return {
      code: parsed.code,
      message: parsed.message ?? text,
      details: parsed.details ?? undefined,
      hint: parsed.hint ?? undefined,
    };
  } catch {
    return { message: text };
  }
}

function extractMissingColumn(message: string): string | null {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column\s+[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)\s+does not exist/i,
    /column\s+"([^"]+)"\s+does not exist/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function formatError(status: number, body: PgErrorBody): string {
  const code = body.code ? ` (${body.code})` : '';
  const details = body.details ? ` — ${body.details}` : '';
  const hint = body.hint ? ` — hint: ${body.hint}` : '';
  return `HTTP ${status}${code}: ${body.message ?? 'Unknown Supabase error'}${details}${hint}`;
}

const TABLE = 'student_screening_records';

/**
 * Upsert one screening record through the PostgREST endpoint. The function
 * surfaces the exact Supabase error text and, when PostgREST reports a stale
 * schema cache for an optional column, removes that column and retries instead
 * of silently swallowing the failure.
 *
 * ⚠️ A real, signed-in session is **required**. The previous implementation
 * silently downgraded to the public anon key on a 401/403, which combined
 * with table-wide SELECT/UPDATE grants made the whole children's dataset
 * readable by anyone holding the publishable key. Records created offline stay
 * queued in the device's local store until the examiner signs in.
 *
 * @param ownerId The signed-in Supabase account id written to `owner_id`.
 */
export async function upsertScreeningRecord(
  record: StudentScreeningRecord,
  ownerId?: string | null,
): Promise<SupabaseDiagnostic> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured: missing project URL or anon key.');
  }

  const token = await getAuthAccessToken();
  if (!token) {
    throw new Error('يلزم تسجيل الدخول قبل مزامنة السجلات — السجلات محفوظة محلياً بأمان.');
  }

  const payload = mapRecordToSupabaseRow(record, ownerId);
  const droppedColumns: string[] = [];
  const url = `${SUPABASE_URL_VALUE}/rest/v1/${TABLE}?on_conflict=child_id`;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY_VALUE,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      const aborted = networkError instanceof DOMException && networkError.name === 'AbortError';
      throw new Error(
        aborted
          ? 'Network error while contacting Supabase: request timed out after 30 seconds.'
          : `Network error while contacting Supabase: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      return { ok: true, status: response.status, message: 'Upsert succeeded.', droppedColumns };
    }

    const text = await response.text();
    const body = parsePgError(text);

    // A stale or revoked JWT is a hard stop: it is never retried with the
    // public anon key, because that would defeat the `owner_id` policies.
    if (response.status === 401 || response.status === 403) {
      const error = new Error(
        `HTTP ${response.status}${body.code ? ` (${body.code})` : ''}: ${
          response.status === 401
            ? 'انتهت صلاحية الجلسة. سجّل الدخول مجدداً ثم أعد المزامنة — السجلات محفوظة محلياً.'
            : 'رفضت الخادم عملية الكتابة. تحقّق من سياسات RLS أو من صلاحية حسابك.'
        }`,
      );
      (error as Error & { status?: number; code?: string }).status = response.status;
      (error as Error & { status?: number; code?: string }).code = body.code;
      throw error;
    }

    const missingColumn = extractMissingColumn(body.message ?? '');
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn];
      droppedColumns.push(missingColumn);
      continue;
    }

    const error = new Error(formatError(response.status, body));
    (error as Error & { status?: number; code?: string }).status = response.status;
    (error as Error & { status?: number; code?: string }).code = body.code;
    throw error;
  }

  throw new Error(
    `HTTP 400: Too many schema mismatches while syncing. Dropped columns: ${droppedColumns.join(', ') || 'none'}`,
  );
}

/**
 * Lightweight GET diagnostic used by the connection tester.
 *
 * The probe runs with the signed-in JWT when a session exists. Without a
 * session it deliberately uses the public anon key so the supervisor can still
 * confirm that the project endpoint and the table are reachable — an anon
 * `401` here is the **expected, healthy** state of a protected dataset, and
 * is reported as "protected" rather than as a failure.
 */
export async function testSupabaseConnection(
  overrideUrl?: string,
  overrideKey?: string,
): Promise<SupabaseDiagnostic> {
  const baseUrl = (overrideUrl || SUPABASE_URL_VALUE).trim().replace(/\/+$/, '');
  const anonKey = (overrideKey || SUPABASE_ANON_KEY_VALUE).trim();
  if (!baseUrl || !anonKey) {
    return { ok: false, message: 'Supabase URL or anon key is empty.' };
  }

  const sessionToken = overrideKey ? null : await getAuthAccessToken();
  const token = sessionToken ?? anonKey;
  const url = `${baseUrl}/rest/v1/${TABLE}?select=child_id&limit=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    const text = await response.text();
    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        message: sessionToken
          ? 'GET succeeded and the table is reachable.'
          : 'GET succeeded (anonymous read allowed).',
      };
    }
    const body = parsePgError(text);

    // The dataset is owner-scoped: an anonymous read is rejected on purpose.
    if (!sessionToken && (response.status === 401 || response.status === 403)) {
      return {
        ok: true,
        status: response.status,
        code: body.code,
        message: '✅ الخادم متصل والجدول محمي بسياسات RLS (رفض القراءةAnon — الوضع الصحيح). سجّل الدخول لقراءة سجلاتك.',
      };
    }

    return {
      ok: false,
      status: response.status,
      code: body.code,
      message: body.message ?? text,
      details: body.details,
      hint: body.hint,
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      ok: false,
      message: aborted
        ? 'Network error: request timed out after 30 seconds — check your internet connection and try again.'
        : `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Live UPSERT diagnostic; inserts a clearly labelled DIAG row. */
export async function testSupabaseUpsert(): Promise<SupabaseDiagnostic> {
  const now = new Date().toISOString();
  const client = getSupabaseClient();
  const ownerId = client ? (await client.auth.getUser()).data.user?.id ?? null : null;
  const testRecord: StudentScreeningRecord = {
    Child_ID: 'DIAG-CONNECTION-TEST',
    Examiner_ID: 'DIAGNOSTIC',
    Parental_Consent: 1,
    Examination_Date: now,
    School_Name: 'DIAGNOSTIC',
    School_Sector: 'DIAGNOSTIC',
    Grade_Level: 1,
    Age_Years: 7,
    Gender: 'DIAGNOSTIC',
    Wears_Glasses: 0,
    Crossover_Sequence: 'DIAGNOSTIC',
    Paper_Snellen_OD: '6/6',
    Paper_LogMAR_OD: 0,
    Paper_Snellen_OS: '6/6',
    Paper_LogMAR_OS: 0,
    Paper_Time_Sec: 1,
    Paper_Referral: 0,
    Smart_Snellen_OD: '6/6',
    Smart_LogMAR_OD: 0,
    Smart_Snellen_OS: '6/6',
    Smart_LogMAR_OS: 0,
    Smart_IOD_LogMAR: 0,
    Smart_Time_Sec: 1,
    Hirschberg_Asym_mm: 0,
    Hirschberg_Prism_Diopters: 0,
    MRD1_Min_mm: 0,
    Triage_Ocular_Flag: 0,
    Asthenopia_Score: 0,
    Final_Triage_Referral: 0,
    Referral_Urgency: 'ROUTINE',
    Referral_PHCC: 'DIAGNOSTIC',
    FollowUp_Status: 0,
    _syncStatus: 'pending',
  };

  try {
    return await upsertScreeningRecord(testRecord, ownerId);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
