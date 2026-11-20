import { isSupabaseConfigured } from './supabaseConfig';

/**
 * Authenticated cloud session helpers for Al-Basar AI v3.
 *
 * The Supabase SDK is still loaded dynamically through `supabaseClient.ts`,
 * so the initial PWA bundle remains unchanged. These helpers only return
 * plain account objects to React and never block local, offline screening.
 */
export interface CloudAuthUser {
  id: string;
  email: string | null;
  /** Full triple name supplied at sign-up (or restored from the profile). */
  fullName: string | null;
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

const toCloudUser = (
  user: {
    id: string;
    email?: string | null;
    user_metadata?: { full_name?: string | null } | null;
  } | null | undefined,
): CloudAuthUser | null => (user ? {
  id: user.id,
  email: user.email ?? null,
  fullName: user.user_metadata?.full_name?.trim() || null,
} : null);

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
