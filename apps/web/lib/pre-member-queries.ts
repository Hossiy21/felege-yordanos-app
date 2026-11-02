/**
 * Pre-member reads and the history log, shared by the admin pages, their
 * actions and the pre-member's own profile. Callers check the rules in
 * lib/permissions.ts first.
 */
import 'server-only';
import { and, asc, eq, ne, or, sql, type AnyColumn } from 'drizzle-orm';
import {
  authUsers,
  db,
  members,
  preMemberHistory,
  preMembers,
  profiles,
  type PreMemberAction,
} from '@felege-yordanos/db/server';
import { nameKey, phoneKey } from './pre-members';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Appends one entry to a pre-member's history (append-only table; the time
 * is the database's). `actorUserId` null = the person themselves through
 * self-registration.
 */
export async function logPreMember(
  tx: Tx | typeof db,
  preMemberId: number,
  action: PreMemberAction,
  actorUserId: string | null,
  details: Record<string, unknown> = {},
) {
  await tx
    .insert(preMemberHistory)
    .values({ preMemberId, action, actorUserId, details });
}

export type PreMemberRow = typeof preMembers.$inferSelect;

export async function loadPreMember(id: number): Promise<PreMemberRow | null> {
  const [row] = await db
    .select()
    .from(preMembers)
    .where(eq(preMembers.id, id))
    .limit(1);
  return row ?? null;
}

/** Last 9 digits of a phone column, for matching (see phoneKey). */
export const phoneDigits = (col: AnyColumn) =>
  sql`right(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), 9)`;
export const normName = (col: AnyColumn) =>
  sql`lower(regexp_replace(trim(coalesce(${col}, '')), '\\s+', ' ', 'g'))`;

export interface DuplicateMatch {
  kind: 'member' | 'pre_member';
  id: number;
  code: string | null;
  name: string;
  status: string | null;
  /** Which fields match. */
  reasons: ('names' | 'phone' | 'email')[];
}

/**
 * Likely duplicates of a pre-member among other pre-members and members:
 * same name + father's name + grandfather's name, same phone (last 9
 * digits) or same email. A warning for the admin, never a block.
 */
export async function findDuplicates(p: {
  id?: number;
  name: string;
  fatherName: string;
  grandfatherName: string;
  phone: string | null;
  email: string | null;
}): Promise<DuplicateMatch[]> {
  const names = [
    nameKey(p.name),
    nameKey(p.fatherName),
    nameKey(p.grandfatherName),
  ];
  const phone = phoneKey(p.phone);
  const email = p.email?.trim().toLowerCase() || null;

  const preNames = and(
    sql`${normName(preMembers.name)} = ${names[0]}`,
    sql`${normName(preMembers.fatherName)} = ${names[1]}`,
    sql`${normName(preMembers.grandfatherName)} = ${names[2]}`,
  );
  const prePhone = phone
    ? sql`${phoneDigits(preMembers.phone)} = ${phone}`
    : sql`false`;
  const preEmail = email
    ? sql`lower(${preMembers.email}) = ${email}`
    : sql`false`;

  const memNames = and(
    sql`${normName(members.name)} = ${names[0]}`,
    sql`${normName(members.fatherName)} = ${names[1]}`,
    sql`${normName(members.grandfatherName)} = ${names[2]}`,
  );
  const memPhone = phone
    ? sql`(${phoneDigits(members.addressPhone)} = ${phone} OR ${phoneDigits(members.addressPhoneTwo)} = ${phone})`
    : sql`false`;
  const memEmail = email
    ? sql`lower(${members.addressEmail}) = ${email}`
    : sql`false`;

  const [preRows, memberRows] = await Promise.all([
    db
      .select({
        id: preMembers.id,
        code: preMembers.code,
        name: preMembers.name,
        fatherName: preMembers.fatherName,
        grandfatherName: preMembers.grandfatherName,
        status: preMembers.status,
        byNames: sql<boolean>`${preNames}`,
        byPhone: sql<boolean>`${prePhone}`,
        byEmail: sql<boolean>`${preEmail}`,
      })
      .from(preMembers)
      .where(
        and(
          p.id ? ne(preMembers.id, p.id) : undefined,
          or(preNames, prePhone, preEmail),
        ),
      )
      .orderBy(asc(preMembers.id))
      .limit(10),
    db
      .select({
        id: members.id,
        code: members.memberId,
        name: members.name,
        fatherName: members.fatherName,
        grandfatherName: members.grandfatherName,
        status: members.status,
        byNames: sql<boolean>`${memNames}`,
        byPhone: sql<boolean>`${memPhone}`,
        byEmail: sql<boolean>`${memEmail}`,
      })
      .from(members)
      .where(or(memNames, memPhone, memEmail))
      .orderBy(asc(members.id))
      .limit(10),
  ]);

  const reasons = (r: {
    byNames: boolean;
    byPhone: boolean;
    byEmail: boolean;
  }) =>
    [
      r.byNames && ('names' as const),
      r.byPhone && ('phone' as const),
      r.byEmail && ('email' as const),
    ].filter((x): x is 'names' | 'phone' | 'email' => !!x);
  const fullName = (r: {
    name: string;
    fatherName: string;
    grandfatherName: string | null;
  }) => [r.name, r.fatherName, r.grandfatherName].filter(Boolean).join(' ');

  return [
    ...memberRows.map((r) => ({
      kind: 'member' as const,
      id: r.id,
      code: r.code,
      name: fullName(r),
      status: r.status,
      reasons: reasons(r),
    })),
    ...preRows.map((r) => ({
      kind: 'pre_member' as const,
      id: r.id,
      code: r.code,
      name: fullName(r),
      status: r.status,
      reasons: reasons(r),
    })),
  ];
}

export interface HistoryEntry {
  id: string;
  action: PreMemberAction;
  at: string;
  actorName: string | null;
  details: Record<string, unknown>;
}

/** A pre-member's history, oldest first, with the actor's name. */
export async function loadHistory(
  preMemberId: number,
): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      id: preMemberHistory.id,
      action: preMemberHistory.action,
      at: preMemberHistory.at,
      details: preMemberHistory.details,
      displayName: profiles.displayName,
      loginName: authUsers.name,
      email: authUsers.email,
    })
    .from(preMemberHistory)
    .leftJoin(authUsers, eq(authUsers.id, preMemberHistory.actorUserId))
    .leftJoin(profiles, eq(profiles.id, preMemberHistory.actorUserId))
    .where(eq(preMemberHistory.preMemberId, preMemberId))
    .orderBy(asc(preMemberHistory.at), asc(preMemberHistory.id));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    at: r.at.toISOString(),
    actorName: r.displayName || r.loginName || r.email || null,
    details: r.details,
  }));
}

/** Pre-members waiting for approval (admin home and nav). */
export const countPendingPreMembers = () =>
  db.$count(preMembers, eq(preMembers.status, 'pending'));

/**
 * SQL: the member row `m` matches pre-member `p` (same three names, same
 * phone or same email) and is not already someone's promotion. Shared by
 * the "Ready to promote" tab and the suggestions on the promote screen.
 */
export const memberMatchesPreMember = sql`(
  (${normName(members.name)} = ${normName(preMembers.name)}
    AND ${normName(members.fatherName)} = ${normName(preMembers.fatherName)}
    AND ${normName(members.grandfatherName)} = ${normName(preMembers.grandfatherName)})
  OR (length(${phoneDigits(preMembers.phone)}) = 9 AND (
    ${phoneDigits(members.addressPhone)} = ${phoneDigits(preMembers.phone)}
    OR ${phoneDigits(members.addressPhoneTwo)} = ${phoneDigits(preMembers.phone)}))
  OR (${preMembers.email} IS NOT NULL AND lower(${members.addressEmail}) = lower(${preMembers.email}))
) AND NOT EXISTS (
  SELECT 1 FROM pre_members promoted
  WHERE promoted.status = 'promoted' AND promoted.promoted_member_id = ${members.id}
)`;

/** Member rows that could be this pre-member's own (suggestions), best first. */
export async function suggestedMembers(preMemberId: number) {
  return db
    .select({
      id: members.id,
      memberId: members.memberId,
      name: members.name,
      fatherName: members.fatherName,
      grandfatherName: members.grandfatherName,
      phone: members.addressPhone,
      linked: sql<boolean>`${members.authUserId} IS NOT NULL`,
    })
    .from(members)
    .innerJoin(preMembers, eq(preMembers.id, preMemberId))
    .where(memberMatchesPreMember)
    .orderBy(asc(members.name))
    .limit(10);
}
