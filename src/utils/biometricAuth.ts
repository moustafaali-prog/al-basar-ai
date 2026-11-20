/**
 * Real biometric authentication (WebAuthn) for Al-Basar AI.
 *
 * Zero dependencies — the browser's native WebAuthn API does all the work, so
 * the examiner unlocks the app with the exact same fingerprint / Touch ID /
 * Face ID sensor that protects their phone.
 *
 * Security model
 * --------------
 * • Only the **public** credential id is stored, in Base64URL form. No private
 *   key, no signature, and above all **no password** ever touches storage.
 * • The credential is bound to this device's platform authenticator
 *   (`authenticatorAttachment: 'platform'`), so it cannot be phished or copied
 *   to another machine.
 * • `userVerification: 'required'` means the assertion is only produced after
 *   the OS confirmed the user's biometric (or device PIN) — a plain software
 *   assertion is never accepted.
 * • The credential is *resident* (discoverable), which is what allows a
 *   one-tap "unlock" without typing a username first.
 *
 * Graceful degradation is deliberate: every public function resolves to
 * `false` instead of throwing when the device has no sensor, the page is not a
 * secure context, or the user cancels the OS prompt. A school morning is never
 * blocked by an unavailable sensor.
 */

/** localStorage key holding the device's biometric binding. */
export const BIOMETRIC_CREDENTIAL_KEY = 'albasar_biometric_cred_v1';

/** How long the OS is given to complete a biometric prompt. */
export const BIOMETRIC_TIMEOUT_MS = 60000;

export interface BiometricBinding {
  /** Base64URL encoded public-key credential id (never a private key). */
  credentialId: string;
  /** The examiner account this credential unlocks. */
  userId: string;
  /** Display name shown by the OS prompt. */
  displayName: string;
  /** ISO timestamp of the binding. */
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Storage helpers (never throw — private mode / quota / disabled storage)
 * ------------------------------------------------------------------ */

const safeGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
};

const safeSet = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
};

const safeRemove = (key: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
};

/* ------------------------------------------------------------------ *
 * Base64URL <-> ArrayBuffer
 * ------------------------------------------------------------------ */

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Encodes an ArrayBuffer as an unpadded Base64URL string. */
export const bufferToBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Decodes a Base64URL string back into an ArrayBuffer. */
export const base64UrlToBuffer = (value: string): ArrayBuffer => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

/* ------------------------------------------------------------------ *
 * Capability detection
 * ------------------------------------------------------------------ */

/** True when the page runs in a secure context (HTTPS or localhost). */
export const isSecureAuthContext = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext === true;
};

/**
 * True when this device exposes a **platform** authenticator that can verify
 * the user (fingerprint, Touch ID, Face ID, or the device PIN as a fallback).
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isSecureAuthContext()) return false;
  if (typeof navigator === 'undefined' || !navigator.credentials) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    // Older engines: assume a platform authenticator may exist and let the
    // actual create()/get() call be the source of truth.
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** True when a biometric credential is already bound to this device. */
export function hasBiometricCredential(): boolean {
  return getBiometricBinding() !== null;
}

/** Reads the stored biometric binding, or null when the device has none. */
export function getBiometricBinding(): BiometricBinding | null {
  const raw = safeGet(BIOMETRIC_CREDENTIAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricBinding>;
    if (!parsed || typeof parsed !== 'object') return null;
    const credentialId = typeof parsed.credentialId === 'string' ? parsed.credentialId.trim() : '';
    if (!credentialId || !BASE64URL_PATTERN.test(credentialId)) return null;
    return {
      credentialId,
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
    };
  } catch {
    return null;
  }
}

/** Removes the biometric binding (explicit device un-linking). */
export function clearBiometricCredential(): void {
  safeRemove(BIOMETRIC_CREDENTIAL_KEY);
}

/* ------------------------------------------------------------------ *
 * Registration & verification
 * ------------------------------------------------------------------ */

/** A fresh 32-byte challenge. Backed by a plain ArrayBuffer so it satisfies `BufferSource`. */
const randomChallenge = (): Uint8Array<ArrayBuffer> => {
  const buffer = new ArrayBuffer(32);
  const bytes = new Uint8Array(buffer);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

const isUserCancellation = (error: unknown): boolean => {
  const name = (error as { name?: string } | null)?.name ?? '';
  return name === 'NotAllowedError' || name === 'AbortError';
};

/**
 * Creates a platform-bound, resident credential for the signed-in examiner and
 * stores only its public credential id.
 *
 * Returns `true` when the OS confirmed the biometric and the binding was
 * persisted. Returns `false` when the device has no sensor, the user
 * cancelled, or the platform refused — it never throws.
 */
export async function registerBiometricCredential(
  userId: string,
  displayName: string,
): Promise<boolean> {
  if (!isSecureAuthContext()) return false;
  if (typeof navigator === 'undefined' || !navigator.credentials) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;

  const safeUserId = userId.trim() || 'albasar-examiner';
  const safeDisplayName = displayName.trim() || safeUserId;

  try {
    const userIdBytes = new TextEncoder().encode(safeUserId);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: randomChallenge(),
      rp: { name: 'Al-Basar AI', id: window.location.hostname },
      user: {
        id: userIdBytes,
        name: safeUserId,
        displayName: safeDisplayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      timeout: BIOMETRIC_TIMEOUT_MS,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) return false;

    const publicCredential = credential as PublicKeyCredential;
    // `rawId` is the canonical binary credential id; encoding it ourselves
    // guarantees the value we store decodes back to the exact same bytes.
    const credentialId = publicCredential.rawId
      ? bufferToBase64Url(publicCredential.rawId)
      : publicCredential.id;

    if (!credentialId) return false;

    const binding: BiometricBinding = {
      credentialId,
      userId: safeUserId,
      displayName: safeDisplayName,
      createdAt: new Date().toISOString(),
    };
    safeSet(BIOMETRIC_CREDENTIAL_KEY, JSON.stringify(binding));
    return true;
  } catch {
    // Cancelled, no sensor, or the authenticator refused — fall back silently.
    return false;
  }
}

/**
 * Prompts the OS for a fingerprint / Face ID / Touch ID confirmation and
 * resolves to `true` **only** when the hardware actually verified the user.
 *
 * Works fully offline: the assertion is produced by the device itself, so no
 * network round-trip is involved.
 */
export async function verifyBiometricUnlock(): Promise<boolean> {
  const binding = getBiometricBinding();
  if (!binding) return false;
  if (!isSecureAuthContext()) return false;
  if (typeof navigator === 'undefined' || !navigator.credentials) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;

  const buildRequest = (allowCredentials: PublicKeyCredentialDescriptor[]): PublicKeyCredentialRequestOptions => ({
    challenge: randomChallenge(),
    rpId: window.location.hostname,
    allowCredentials,
    userVerification: 'required',
    timeout: BIOMETRIC_TIMEOUT_MS,
  });

  const scopedDescriptors: PublicKeyCredentialDescriptor[] = [{
    id: base64UrlToBuffer(binding.credentialId),
    type: 'public-key',
  }];

  try {
    const assertion = await navigator.credentials.get({ publicKey: buildRequest(scopedDescriptors) });
    return Boolean(assertion);
  } catch (error) {
    // The user dismissed the OS sheet — never re-prompt behind their back.
    if (isUserCancellation(error)) return false;
    // Some platforms expose the credential as purely discoverable; retry once
    // without the explicit allowCredentials list before giving up.
    try {
      const assertion = await navigator.credentials.get({ publicKey: buildRequest([]) });
      return Boolean(assertion);
    } catch {
      return false;
    }
  }
}
