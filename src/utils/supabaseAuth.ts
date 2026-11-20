import { isSupabaseConfigured } from './supabaseConfig';

/**
 * Authenticated cloud session helpers for Al-Basar AI v3.
 *
 * The Supabase SDK is still loaded dynamically through `supabaseClient.ts`,
 * so the initial PWA bundle remains unchanged. These helpers only return
 * plain account objects to React and never block local, offline screening.
 */

/**
 * Server-trusted role.
 *
 * The role is read **exclusively** from `app_metadata`, which Supabase stores
 * in `auth.users.raw_app_meta_data` and which a user can never change from the
 * client (`auth.updateUser()` only writes `user_metadata`).
 *
 * Reading `user_metadata.role` would let any signed-up examiner promote
 * themselves to admin with a single REST call, so it is never consulted.
 */
export type CloudRole = 'admin' | 'examiner';

export interface CloudAuthUser {
  id: string;
  email: string | null;
  /** Full triple name supplied at sign-up (or restored from the profile). */
  fullName: string | null;
  /**
   * Server-trusted role. `admin` only when the JWT carries
   * `app_metadata.role = 'admin'`, which is set server-side from the
   * Supabase dashboard or the `service_role` key.
   */
  role: CloudRole;
}

/** True only for a role granted server-side in `raw_app_meta_data`. */
export function isAdminUser(user: CloudAuthUser | null | undefined): boolean {
  return user?.role === 'admin';
}

export class CloudAuthError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'CLOUD_AUTH_ERROR', status = 0) {
    super(message);
    this.name = 'CloudAuthError';
    this.code = code;
    this.status = status;
  }
}

const getClient = async () => {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseClient } = await import('./supabaseClient');
  return getSupabaseClient();
};

/**
 * Normalises a Supabase user into the app's account shape.
 *
 * `full_name` comes from `user_metadata` (the user may legitimately set their
 * own display name), but the **role** comes from `app_metadata` only — never
 * from `user_metadata`, which is client-writable.
 */
const toCloudUser = (
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  } | null | undefined,
): CloudAuthUser | null => {
  if (!user) return null;
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};
  const rawFullName = userMeta.full_name;
  const rawRole = appMeta.role;
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: typeof rawFullName === 'string' ? rawFullName.trim() || null : null,
    role: typeof rawRole === 'string' && rawRole === 'admin' ? 'admin' : 'examiner',
  };
};

/** Restore a persisted session without making a network request first. */
export async function loadCloudAuthUser(): Promise<CloudAuthUser | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    const session = data.session;
    if (!session?.user) return null;
    
    // Refresh if token expires within 5 minutes
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    if (expiresAt && expiresAt - now < 5 * 60 * 1000) {
      try {
        const { data: refreshed } = await client.auth.refreshSession();
        if (refreshed.session?.user) {
          return toCloudUser(refreshed.session.user);
        }
      } catch {
        // ignore refresh errors, fall back to existing session
      }
    }
    return toCloudUser(session.user);
  } catch {
    return null;
  }
}

/**
 * Force a token refresh in the background.
 *
 * Used by the "keep me signed in" restore path so a silent unlock always ends
 * up with a fresh Supabase JWT. Returns the refreshed user, or the currently
 * cached user when the network is unavailable (offline fieldwork keeps working).
 */
export async function refreshCloudSession(): Promise<CloudAuthUser | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.refreshSession();
    if (error) return loadCloudAuthUser();
    return toCloudUser(data.session?.user);
  } catch {
    return loadCloudAuthUser();
  }
}

/** Sign in with an account provisioned by the project supervisor. */
export async function signInToCloud(email: string, password: string): Promise<CloudAuthUser> {
  const client = await getClient();
  if (!client) {
    throw new CloudAuthError('Supabase is not configured.', 'CLOUD_NOT_CONFIGURED');
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    const code = (error as { code?: string }).code ?? 'SIGN_IN_FAILED';
    const status = (error as { status?: number }).status ?? 0;
    throw new CloudAuthError(error.message, code, status);
  }

  const user = toCloudUser(data.user);
  if (!user) {
    throw new CloudAuthError('The cloud account returned no user.', 'NO_USER');
  }
  return user;
}

export interface CloudSignUpResult {
  user: CloudAuthUser | null;
  /** True when Supabase created the account but requires inbox confirmation. */
  needsEmailConfirmation: boolean;
  /** True when Supabase returned the anti-enumeration existing-user response. */
  alreadyRegistered: boolean;
}

/**
 * Create a new examiner account through Supabase Auth
 * (`POST /auth/v1/signup`, invoked by the SDK).
 *
 * The full triple name is attached to the account as `user_metadata.full_name`
 * so every synced record can be attributed to the examiner.
 *
 * The project supervisor may disable public sign-ups in Supabase; in that case
 * the returned error is translated by the modal into a clear Arabic message.
 */
export async function signUpToCloud(
  email: string,
  password: string,
  fullName = '',
): Promise<CloudSignUpResult> {
  const client = await getClient();
  if (!client) {
    throw new CloudAuthError('Supabase is not configured.', 'CLOUD_NOT_CONFIGURED');
  }

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });

  if (error) {
    const code = (error as { code?: string }).code ?? 'SIGN_UP_FAILED';
    const status = (error as { status?: number }).status ?? 0;
    throw new CloudAuthError(error.message, code, status);
  }

  const user = toCloudUser(data.user);
  const identities = (data.user as { identities?: unknown[] } | null)?.identities;
  const alreadyRegistered = Array.isArray(identities) && identities.length === 0;

  return {
    user,
    needsEmailConfirmation: !data.session && Boolean(user),
    alreadyRegistered,
  };
}

/** Clear the local session; local screening records are never touched. */
export async function signOutOfCloud(): Promise<void> {
  const client = await getClient();
  if (!client) return;
  await client.auth.signOut();
}

/** Keep React in sync with sign-in, token refresh, and sign-out events. */
export async function subscribeToCloudAuth(
  onChange: (user: CloudAuthUser | null) => void,
): Promise<() => void> {
  const client = await getClient();
  if (!client) return () => undefined;

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onChange(toCloudUser(session?.user));
  });

  return () => data.subscription.unsubscribe();
}
