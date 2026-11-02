/**
 * Who may do what. Single source of truth for authorization.
 *
 * These rules replace the Supabase RLS policies one for one. Every server
 * action and every page that reads or writes data must check the matching
 * rule here before touching the database. Hiding a button is not security.
 *
 * Phase 4 replaces the hardcoded department ids with configurable permissions.
 */
import {
  checkInState,
  checkInWindow,
  eventStartAt,
  type CheckInWindowEvent,
} from './check-in-window';
import type { Audience } from '@felege-yordanos/db/schema';
import { isAudioKey, isNoticeImageKey } from './media';
import type { CurrentUser } from './session';

/** Department ids that carry special permissions (see departments table). */
export const DEPARTMENT = {
  /** Programs & Events: can read all attendance. */
  PROGRAMS_EVENTS: 3,
  /** Songs & Celebrations: manages the songbook. */
  SONGS: 6,
  /** Budget & Asset Management: verifies donations and reads receipts. */
  BUDGET: 9,
} as const;

type User = Pick<CurrentUser, 'id' | 'role' | 'departmentId'>;

export const isAdmin = (u: User) =>
  u.role === 'admin' || u.role === 'super_admin';
export const isSuperAdmin = (u: User) => u.role === 'super_admin';
export const isDeptHeadOf = (
  u: User,
  departmentId: number | null | undefined,
) =>
  u.role === 'dept_head' &&
  departmentId != null &&
  u.departmentId === departmentId;

/** Admin area (/admin): everyone except plain members. */
export const canAccessAdmin = (u: User) => u.role !== 'member';

/** Department heads of Programs & Events run all gatherings. */
const isProgramsEventsHead = (u: User) =>
  isDeptHeadOf(u, DEPARTMENT.PROGRAMS_EVENTS);

/**
 * Member features (events, donations, notices): a verified email, and a
 * linked member record or a staff role. lib/session.ts re-exports this as
 * hasMemberAccess.
 */
export const hasMemberAccess = (
  u: Pick<CurrentUser, 'emailVerified' | 'role' | 'memberRecordId'>,
) => u.emailVerified && (u.role !== 'member' || u.memberRecordId !== null);

/**
 * Pre-member features (events and notices for pre-members, their own
 * attendance, their ID and QR): a verified email and a linked pre-member
 * record with status 'active' (lib/session.ts sets preMemberRecordId only
 * then). Members' features stay refused: hasMemberAccess is false for them.
 */
export const hasPreMemberAccess = (
  u: Pick<CurrentUser, 'emailVerified' | 'preMemberRecordId'>,
) => u.emailVerified && u.preMemberRecordId !== null;

/** What the app shows a user (CurrentUser.access). */
export type AccessLevel = 'guest' | 'pre_member' | 'member' | 'staff';

type AccessUser = Pick<
  CurrentUser,
  'emailVerified' | 'role' | 'memberRecordId' | 'preMemberRecordId'
>;

export function accessLevel(u: AccessUser): AccessLevel {
  if (u.emailVerified && u.role !== 'member') return 'staff';
  if (hasMemberAccess(u)) return 'member';
  if (hasPreMemberAccess(u)) return 'pre_member';
  return 'guest';
}

/* ─── Audience (events and notices) ────────────────────────── */

/**
 * Audiences whose events and notices this user sees: staff all (null),
 * members 'members' + 'everyone', pre-members 'pre_members' + 'everyone',
 * anyone else none.
 */
export function visibleAudiences(u: AccessUser): Audience[] | null {
  switch (accessLevel(u)) {
    case 'staff':
      return null;
    case 'member':
      return ['members', 'everyone'];
    case 'pre_member':
      return ['pre_members', 'everyone'];
    default:
      return [];
  }
}

/** Whether this user sees an event or notice meant for `audience`. */
export const canSeeAudience = (u: AccessUser, audience: Audience) => {
  const visible = visibleAudiences(u);
  return visible === null || visible.includes(audience);
};

/* ─── Songbook ─────────────────────────────────────────────── */

/** Read the songbook and play song recordings: every signed-in user. */
export const canViewSongbook = (u: User) => !!u.id;

/** Create, edit and delete songs and categories (and upload song audio). */
export const canManageSongs = (u: User) =>
  isAdmin(u) || isDeptHeadOf(u, DEPARTMENT.SONGS);

/* ─── Notices ──────────────────────────────────────────────── */

type MemberAccessUser = User &
  Pick<CurrentUser, 'emailVerified' | 'memberRecordId' | 'preMemberRecordId'>;

/**
 * Read the notice board: members (and staff) and pre-members. Which notices
 * each sees: canViewNotice.
 */
export const canViewNotices = (u: MemberAccessUser) =>
  hasMemberAccess(u) || hasPreMemberAccess(u);

/** Read one notice: the notice board, and the notice is for this user. */
export const canViewNotice = (
  u: MemberAccessUser,
  notice: { audience: Audience },
) => canViewNotices(u) && canSeeAudience(u, notice.audience);

/** Staff also see expired notices (members only see active ones). */
export const canSeeExpiredNotices = (u: User) => canAccessAdmin(u);

/**
 * Post a notice for `departmentId` (null = everyone): admins for everyone or
 * any department, department heads for their own department only.
 */
export const canPostNotice = (u: User, departmentId: number | null) =>
  isAdmin(u) || isDeptHeadOf(u, departmentId);

/**
 * Edit or delete a notice: the department heads of its department, admins
 * for all. (Not tied to the author, same as events.)
 */
export const canEditNotice = (
  u: User,
  notice: { departmentId: number | null },
) => canPostNotice(u, notice.departmentId);

/** Open /admin/notices: admins, and department heads with a department. */
export const canManageNotices = (u: User) =>
  isAdmin(u) || (u.role === 'dept_head' && u.departmentId != null);

/* ─── Media files ──────────────────────────────────────────── */

/**
 * Open a media file (/api/media/<key>): song audio for songbook readers,
 * notice images for notice board readers. Anything else is refused.
 */
export const canViewMedia = (u: MemberAccessUser, key: string) =>
  (isAudioKey(key) && canViewSongbook(u)) ||
  (isNoticeImageKey(key) && canViewNotices(u));

/* ─── Events ───────────────────────────────────────────────── */

/**
 * See an event in the member area (dashboard, /attendance): members and
 * pre-members for their audience, staff all.
 */
export const canViewEvent = (
  u: MemberAccessUser,
  event: { audience: Audience },
) =>
  (hasMemberAccess(u) || hasPreMemberAccess(u)) &&
  canSeeAudience(u, event.audience);

/**
 * Create, edit and delete events of any department (and general events):
 * admins and Programs & Events department heads.
 */
export const canManageAllEvents = (u: User) =>
  isAdmin(u) || isProgramsEventsHead(u);

/**
 * Create an event for `departmentId`: department heads for their own
 * department, plus canManageAllEvents.
 */
export const canCreateEvent = (u: User, departmentId: number | null) =>
  canManageAllEvents(u) || isDeptHeadOf(u, departmentId);

/**
 * Edit or delete an existing event: the department heads of the event's
 * department, plus canManageAllEvents. (Not tied to who created it, so a
 * co-head can fix it and a former head loses access.)
 */
export const canEditEvent = (u: User, event: { departmentId: number | null }) =>
  canCreateEvent(u, event.departmentId);

/* ─── Attendance ───────────────────────────────────────────── */

/** Mark or change attendance for an event (same people as canEditEvent). */
export const canMarkAttendance = (
  u: User,
  event: { departmentId: number | null },
) => canEditEvent(u, event);

/** Read attendance of every event (any role in Programs & Events, or admins). */
export const canViewAllAttendance = (u: User) =>
  isAdmin(u) || u.departmentId === DEPARTMENT.PROGRAMS_EVENTS;

/**
 * Mark attendance right now: department heads only inside the event's
 * check-in window (lib/check-in-window.ts), admins and super admins at any
 * time.
 */
export const canCheckInNow = (
  u: User,
  event: { departmentId: number | null } & CheckInWindowEvent,
  now: Date = new Date(),
) =>
  canMarkAttendance(u, event) &&
  (isAdmin(u) || checkInState(checkInWindow(event), now) === 'open');

/** Whether the check-in window applies to this user (department heads). */
export const isLimitedToCheckInWindow = (u: User) => !isAdmin(u);

/** Read attendance of one event. Members can always read their own records. */
export const canViewEventAttendance = (
  u: User,
  event: { departmentId: number | null },
) => canViewAllAttendance(u) || canMarkAttendance(u, event);

/**
 * Close an event (unmarked members become absent, check-in stops): the people
 * who mark its attendance. Department heads only once the event has started
 * (even after the check-in window), admins and super admins at any time.
 */
export const canCloseEvent = (
  u: User,
  event: { departmentId: number | null } & CheckInWindowEvent,
  now: Date = new Date(),
) =>
  canMarkAttendance(u, event) && (isAdmin(u) || now >= eventStartAt(event));

/**
 * From when this user may close the event (epoch ms; 0 = any time), or null
 * when they may not: what the check-in screen needs to show "Close event"
 * without asking the server again. Same rule as canCloseEvent.
 */
export const closableFrom = (
  u: User,
  event: { departmentId: number | null } & CheckInWindowEvent,
): number | null =>
  !canMarkAttendance(u, event)
    ? null
    : isAdmin(u)
      ? 0
      : eventStartAt(event).getTime();

/** Reopen a closed event (to fix a mistaken close): admins and super admins. */
export const canReopenEvent = (u: User) => isAdmin(u);

/** See the summary of a closed event: whoever can read its attendance. */
export const canViewEventSummary = (
  u: User,
  event: { departmentId: number | null },
) => canViewEventAttendance(u, event);

/* ─── Donations ────────────────────────────────────────────── */

/** See all donations, verify or reject them, open any receipt. */
export const canReviewDonations = (u: User) =>
  isAdmin(u) || isDeptHeadOf(u, DEPARTMENT.BUDGET);

/**
 * Strict shape of a receipt key: "<donor user id>/<file name>".
 * Rejects anything else ("..", extra folders, encoded separators) so a key can
 * never point into another user's folder.
 */
const RECEIPT_KEY = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/;
export const isValidReceiptKey = (receiptKey: string) =>
  RECEIPT_KEY.test(receiptKey);

/** Open a receipt file. Receipt keys start with the donor's user id. */
export const canViewReceipt = (u: User, receiptKey: string) =>
  isValidReceiptKey(receiptKey) &&
  (receiptKey.startsWith(`${u.id}/`) || canReviewDonations(u));

/* ─── Users & members ──────────────────────────────────────── */

/** Change anyone's role or department. */
export const canManageUsers = (u: User) => isSuperAdmin(u);

/** See all profiles (user list). */
export const canViewAllProfiles = (u: User) => isAdmin(u);

/** Edit any member record. */
export const canEditMembers = (u: User) => isAdmin(u);

/**
 * Approve or reject member link requests, and link an account to a member
 * record directly. Member ids are sequential, so an admin always confirms.
 */
export const canApproveMemberLinks = (u: User) => isAdmin(u);

/* ─── Pre-members ──────────────────────────────────────────── */

/**
 * Pre-member records: list, register, approve, reject, edit, withdraw,
 * reinstate, link accounts, see the history. Admins and super admins only.
 */
export const canManagePreMembers = (u: User) => isAdmin(u);

/** Open and close self-registration sessions (/join QR). */
export const canManageRegistrationSessions = (u: User) => isAdmin(u);

/** Promote a pre-member to member, and undo a promotion. */
export const canPromotePreMembers = (u: User) => isAdmin(u);
