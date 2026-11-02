/**
 * Pre-member (ቅድመ አባል) IDs and display helpers. Safe anywhere (no database).
 *
 * IDs look like "FYP-2019-0001": the Ethiopian year of the approval date and
 * a number per year, given out by lib/pre-member-ids.ts on approval.
 */
import type { PreMemberStatus } from '@felege-yordanos/db/schema';
import { toEthiopic } from './events';

export const PRE_MEMBER_CODE_PREFIX = 'FYP-';
const NUMBER_DIGITS = 4;

/** "FYP-2019-0001". Numbers past 9999 keep all their digits. */
export function formatPreMemberCode(year: number, n: number): string {
  return `${PRE_MEMBER_CODE_PREFIX}${year}-${String(n).padStart(NUMBER_DIGITS, '0')}`;
}

const CODE_RE = /^FYP-(\d{4})-(\d{1,6})$/i;

/**
 * Normalizes a typed or scanned pre-member ID ("fyp-2019-1" ->
 * "FYP-2019-0001"), or null when it is not one.
 */
export function parsePreMemberCode(input: string): string | null {
  const m = CODE_RE.exec(input.trim().replace(/\s+/g, ''));
  if (!m) return null;
  return formatPreMemberCode(Number(m[1]), Number(m[2]));
}

/** Whether the input starts like a pre-member ID (case-insensitive). */
export const looksLikePreMemberCode = (input: string) =>
  input.trim().toUpperCase().startsWith(PRE_MEMBER_CODE_PREFIX);

/**
 * Ethiopian year of a date in Ethiopian time (the year in new IDs). The
 * server runs in UTC, so the date is first moved to Addis Ababa time.
 */
export function ethiopianYearOf(at: Date): number {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  const [y, m, d] = ymd.split('-').map(Number);
  return toEthiopic(new Date(y, m - 1, d)).year;
}

export type PreMemberNames = {
  name: string;
  fatherName: string;
  grandfatherName?: string | null;
};

export const preMemberFullName = (p: PreMemberNames) =>
  [p.name, p.fatherName, p.grandfatherName].filter(Boolean).join(' ');

/** Statuses that can still be approved, withdrawn, etc. (UI and actions). */
export const PRE_MEMBER_STATUS_LABEL: Record<PreMemberStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  promoted: 'Promoted',
};

/** Phone numbers compared by digits only, the last 9 (drops +251 / 0). */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/** Names compared without case or extra spaces. */
export const nameKey = (s: string | null | undefined) =>
  (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
