/**
 * Claim suggestion (#139): when a signed-in account's verified email equals
 * the email of a pre-member record, /claim and the dashboard suggest that
 * record's FYP ID. Only a hint: the request still goes through
 * requestPreMemberLink and an admin approves it (the email given at /join
 * or by an admin was never verified by the app). Pure, safe anywhere; the
 * candidates are loaded by lib/pre-member-match-queries.ts.
 */
import type { PreMemberStatus } from '@felege-yordanos/db/schema';

/** Emails compared without case or surrounding spaces; blank = none. */
export const emailKey = (email: string | null | undefined): string | null =>
  (email ?? '').trim().toLowerCase() || null;

export type MatchAccount = {
  email: string;
  emailVerified: boolean;
  /** Linked to a member record, or to a pre-member record of any status. */
  linked: boolean;
  /** Has an open link request (member or pre-member). */
  pendingRequest: boolean;
  /** Pre-member records an admin already refused to link to this account. */
  rejectedPreMemberIds: readonly number[];
};

export type MatchCandidate = {
  id: number;
  code: string | null;
  status: PreMemberStatus;
  email: string | null;
  authUserId: string | null;
};

/**
 * The FYP ID to suggest, or null. Suggests only when exactly one active
 * record has the account's email and that record has no account yet:
 * two active records with the same email (duplicates) suggest nothing.
 * Pending, rejected, withdrawn and promoted records never match.
 */
export function suggestedPreMemberCode(
  account: MatchAccount,
  candidates: readonly MatchCandidate[],
): string | null {
  if (!account.emailVerified || account.linked || account.pendingRequest) {
    return null;
  }
  const key = emailKey(account.email);
  if (!key) return null;
  const active = candidates.filter(
    (c) => c.status === 'active' && emailKey(c.email) === key,
  );
  if (active.length !== 1) return null;
  const [record] = active;
  if (record.authUserId !== null || !record.code) return null;
  if (account.rejectedPreMemberIds.includes(record.id)) return null;
  return record.code;
}

/** Admin badge on a pending pre-member request; null = record has no email. */
export type EmailMatch = 'match' | 'different';

export function preMemberEmailMatch(
  account: { email: string; emailVerified: boolean },
  recordEmail: string | null,
): EmailMatch | null {
  const record = emailKey(recordEmail);
  if (!record) return null;
  return account.emailVerified && emailKey(account.email) === record
    ? 'match'
    : 'different';
}
