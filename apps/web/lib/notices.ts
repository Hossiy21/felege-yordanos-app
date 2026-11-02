/**
 * Notice board helpers that are safe anywhere (no server code).
 *
 * Expiry is chosen as a date in the form and stored as the end of that day in
 * Ethiopia (UTC+3, no daylight saving): a notice "until 20 Oct" is visible to
 * members for all of 20 Oct.
 */

import type { Audience, NoticeCategory } from '@felege-yordanos/db/schema';

export const NOTICE_TITLE_MAX = 120;
export const NOTICE_SUMMARY_MAX = 160;
export const NOTICE_BODY_MAX = 4000;

const ETHIOPIA_OFFSET = '+03:00';
const ETHIOPIA_OFFSET_MS = 3 * 60 * 60 * 1000;

/** "2026-10-20" -> 2026-10-20T23:59:59.999+03:00 */
export const expiryFromDate = (date: string) =>
  new Date(`${date}T23:59:59.999${ETHIOPIA_OFFSET}`);

/** The expiry's day in Ethiopia, as "YYYY-MM-DD" (for the date input). */
export const expiryToDate = (expiresAt: Date | string) =>
  new Date(new Date(expiresAt).getTime() + ETHIOPIA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

/** Today in Ethiopia, as "YYYY-MM-DD". */
export const todayInEthiopia = () => expiryToDate(new Date());

/** A notice as pages and components receive it (dates as ISO strings). */
export interface NoticeView {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  category: NoticeCategory;
  departmentId: number | null;
  /** Who sees it: members, pre-members or everyone. */
  audience: Audience;
  departmentNameEn: string | null;
  departmentNameAm: string | null;
  imageKey: string | null;
  pinned: boolean;
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
  authorName: string | null;
  /** The current user opened it (unread dots and count). */
  read: boolean;
  /** The current user may edit it (set by the page). */
  canEdit?: boolean;
}
