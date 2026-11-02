/**
 * What a scanned QR or a typed Quick ID refers to: a member ID from the SSU
 * register ("ssu/01/03/05/00042", or just "42"), or a pre-member ID
 * ("FYP-2019-0001", any case). Pure, shared by the check-in screen and tests.
 */
import { normalizeMemberId } from './member-id';
import { looksLikePreMemberCode, parsePreMemberCode } from './pre-members';

export type ScanCode =
  | { kind: 'member'; memberId: string }
  | { kind: 'pre_member'; code: string }
  | { kind: 'invalid' };

export function classifyScanCode(input: string): ScanCode {
  const v = input.trim();
  if (!v) return { kind: 'invalid' };
  if (looksLikePreMemberCode(v)) {
    const code = parsePreMemberCode(v);
    return code ? { kind: 'pre_member', code } : { kind: 'invalid' };
  }
  return { kind: 'member', memberId: normalizeMemberId(v) };
}

/** Lookup key for the check-in list: same for a code and its typed forms. */
export function scanLookupKey(input: string): string | null {
  const c = classifyScanCode(input);
  if (c.kind === 'member') return c.memberId.toLowerCase();
  if (c.kind === 'pre_member') return c.code.toLowerCase();
  return null;
}
