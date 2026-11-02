/**
 * Server-side helpers for the signed-in user.
 *
 * Wrapped in React cache(): a layout and a page in the same request share
 * one lookup instead of repeating it.
 */
import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  db,
  members,
  preMembers,
  profiles,
  type Role,
} from '@felege-yordanos/db/server';
import { auth } from './auth';
import {
  accessLevel,
  hasMemberAccess,
  hasPreMemberAccess,
  type AccessLevel,
} from './permissions';

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export type CurrentUser = {
  id: string;
  email: string;
  /**
   * Name shown in the app: the profile name, else the registered name of the
   * linked member (name + father's name), else the email.
   */
  displayName: string;
  /**
   * Role in effect: 'member' until the email is verified, so every rule in
   * lib/permissions.ts treats an unverified admin or dept head as a member.
   */
  role: Role;
  /** null until the email is verified (see role). */
  departmentId: number | null;
  /** Role in the profile, even before it is in effect. UI text only, never permission checks. */
  assignedRole: Role;
  emailVerified: boolean;
  /** members.id of the linked member record, or null when not linked yet. */
  memberRecordId: number | null;
  /**
   * pre_members.id of the linked pre-member record while it is active, else
   * null (pending, withdrawn or promoted records give no access).
   */
  preMemberRecordId: number | null;
  /**
   * What the app shows this user: 'staff' (any staff role), 'member'
   * (hasMemberAccess), 'pre_member' (hasPreMemberAccess) or 'guest'
   * (songbook and profile only). Derived from the fields above.
   */
  access: AccessLevel;
};

/** The signed-in user with their profile, or null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({
      profile: profiles,
      memberRecordId: members.id,
      memberName: members.name,
      memberFatherName: members.fatherName,
      preMemberId: preMembers.id,
      preMemberStatus: preMembers.status,
      preMemberName: preMembers.name,
      preMemberFatherName: preMembers.fatherName,
    })
    .from(profiles)
    .leftJoin(members, eq(members.authUserId, profiles.id))
    .leftJoin(preMembers, eq(preMembers.authUserId, profiles.id))
    .where(eq(profiles.id, session.user.id))
    .limit(1);
  const profile = row?.profile;
  const emailVerified = session.user.emailVerified;
  const assignedRole = profile?.role ?? 'member';

  // New accounts start with their email as name (sign-up, old Supabase
  // trigger): that does not count as a real name.
  const email = session.user.email;
  const realName = (n: string | null | undefined) => {
    const v = n?.trim();
    return v && v.toLowerCase() !== email.toLowerCase() ? v : '';
  };
  const memberName = [row?.memberName, row?.memberFatherName]
    .filter(Boolean)
    .join(' ');
  const preMemberActive = row?.preMemberStatus === 'active';
  const preMemberName = preMemberActive
    ? [row?.preMemberName, row?.preMemberFatherName].filter(Boolean).join(' ')
    : '';

  const role = emailVerified ? assignedRole : 'member';
  const memberRecordId = row?.memberRecordId ?? null;
  const preMemberRecordId = preMemberActive ? (row?.preMemberId ?? null) : null;

  return {
    id: session.user.id,
    email,
    // Profile name (editable on /profile), then the member register, then
    // the login account's name.
    displayName:
      realName(profile?.displayName) ||
      memberName ||
      preMemberName ||
      realName(session.user.name) ||
      email,
    role,
    departmentId: emailVerified ? (profile?.departmentId ?? null) : null,
    assignedRole,
    emailVerified,
    memberRecordId,
    preMemberRecordId,
    access: accessLevel({
      emailVerified,
      role,
      memberRecordId,
      preMemberRecordId,
    }),
  };
});

/** Use in pages, layouts and server actions that need a signed-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Redirects to the dashboard when the user's role is not in `roles`. */
export async function requireRole(
  roles: readonly Role[],
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/dashboard');
  return user;
}

/** Sends users without a verified email to /verify-email. */
export async function requireVerifiedEmail(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.emailVerified) redirect('/verify-email?required=1');
  return user;
}

/**
 * For member features (events, donations, notices): the email must be
 * verified, and plain members must have a linked member record, otherwise
 * they are sent to /verify-email or /claim. Staff roles keep access without
 * a member record.
 */
export async function requireLinkedMember(): Promise<CurrentUser> {
  const user = await requireVerifiedEmail();
  if (hasMemberAccess(user)) return user;
  // Pre-members are linked already: this feature is not for them.
  if (hasPreMemberAccess(user)) redirect('/dashboard');
  redirect('/claim?required=1');
}

/**
 * For the features members and pre-members share (events of their audience,
 * their attendance, notices): member access or an active pre-member record.
 */
export async function requireMemberOrPreMember(): Promise<CurrentUser> {
  const user = await requireVerifiedEmail();
  if (!hasMemberAccess(user) && !hasPreMemberAccess(user))
    redirect('/claim?required=1');
  return user;
}

/**
 * Verified email, and a linked member or a staff role. Same rule for pages
 * and server actions (defined in lib/permissions.ts).
 */
export { hasMemberAccess, hasPreMemberAccess } from './permissions';
