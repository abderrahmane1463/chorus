import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * A short fingerprint of an account's password, carried in its sessions.
 *
 * Sessions are JWTs, which stay valid until they expire. Signed with the
 * server's secret over the stored hash, the stamp changes whenever the
 * password does, so a session issued before a password change stops being
 * accepted: changing the password signs out every other device. It reveals
 * nothing about the password, and cannot be forged without the secret.
 *
 * Accounts with no password (Google) have no stamp.
 */
export function passwordStamp(passwordHash: string | null): string | null {
  if (!passwordHash) return null;
  return createHmac('sha256', process.env.AUTH_SECRET ?? '')
    .update(passwordHash)
    .digest('base64url')
    .slice(0, 22);
}

/** Whether a session was issued under the account's current password. */
export function stampMatches(sessionStamp: string | null | undefined, passwordHash: string | null) {
  const current = passwordStamp(passwordHash);
  return current === null || sessionStamp === current;
}
