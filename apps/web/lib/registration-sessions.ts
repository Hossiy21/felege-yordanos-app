/**
 * Self-registration sessions (/join). Pure helpers, safe anywhere.
 */

export type SessionState = 'scheduled' | 'open' | 'closed';

export interface SessionTimes {
  opensAt: Date | string;
  closesAt: Date | string;
  closedAt: Date | string | null;
}

/** Open from opens_at (inclusive) to closes_at (exclusive), unless closed early. */
export function sessionState(
  s: SessionTimes,
  now: Date = new Date(),
): SessionState {
  if (s.closedAt) return 'closed';
  const t = now.getTime();
  if (t < new Date(s.opensAt).getTime()) return 'scheduled';
  if (t >= new Date(s.closesAt).getTime()) return 'closed';
  return 'open';
}

const TOKEN_BYTES = 24;

/** A random URL-safe token (192 bits). */
export function newSessionToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Tokens have this shape; anything else is refused before a lookup. */
export const isSessionToken = (v: string | null | undefined): v is string =>
  !!v && /^[A-Za-z0-9_-]{32}$/.test(v);

/**
 * Short reference shown after self-registration ("R-42"), so a volunteer can
 * find the pending record (admin search accepts it).
 */
export const registrationReference = (preMemberId: number) =>
  `R-${preMemberId}`;

/** The pre-member id in a reference ("R-42", "r42"), or null. */
export function parseRegistrationReference(q: string): number | null {
  const m = /^r-?(\d{1,12})$/i.exec(q.trim());
  return m ? Number(m[1]) : null;
}

/** What /join says for a closed, expired or unknown session. */
export const REGISTRATION_CLOSED =
  'Registration is closed. Please ask a volunteer at the desk.';
