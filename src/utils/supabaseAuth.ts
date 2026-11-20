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
}

export class CloudAuthError extends Error {
  code: string;

  constructor(message: string, code = 'CLOUD_AUTH_ERROR') {
    super(message);
    this.name = 'CloudAuthError';
    this.code = code;
  }
}

const getClient = async () => {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseClient } = await import('./supabaseClient');
  return getSupabaseClient();
};

const toCloudUser = (
  user: { id: string; email?: string | null } | null | undefined,
): CloudAuthUser | null => (user ? { id: user.id, email: user.email ?? null } : null);

/** Restore a persisted session without making a network request first. */
export async function loadCloudAuthUser(): Promise<CloudAuthUser | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    return toCloudUser(data.session?.user);
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
    throw new CloudAuthError(error.message, code);
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
 * The project supervisor may disable public sign-ups in Supabase; in that case
 * the returned error is translated by the modal into a clear Arabic message.
 */
export async function signUpToCloud(email: string, password: string): Promise<CloudSignUpResult> {
  const client = await getClient();
  if (!client) {
    throw new CloudAuthError('Supabase is not configured.', 'CLOUD_NOT_CONFIGURED');
  }

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    const code = (error as { code?: string }).code ?? 'SIGN_UP_FAILED';
    throw new CloudAuthError(error.message, code);
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
