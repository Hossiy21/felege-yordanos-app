/**
 * Who is expected at an event, and who has an attendance row: the one place
 * the check-in screens, the close (automatic absents) and the summary get
 * their people from. The rules are lib/audience.ts (which kinds per audience)
 * and lib/event-people.ts (the list of an open or closed event).
 *
 * Expected: active members (members.status = 'Active') for 'members',
 * active pre-members for 'pre_members', both for 'everyone'.
 */
import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import {
  attendance,
  authUsers,
  db,
  members,
  preMembers,
  profiles,
  type AttendanceStatus,
  type CheckInMethod,
  type events,
} from '@felege-yordanos/db/server';
import {
  attendanceRowKey,
  audienceIncludes,
  expectedPeople,
  type Audience,
  type ExpectedPerson,
} from './audience';
import { eventPeople, type ListedPerson, type RowPerson } from './event-people';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const activeMembers = () =>
  db
    .select({
      id: members.id,
      code: members.memberId,
      name: members.name,
      fatherName: members.fatherName,
    })
    .from(members)
    .where(eq(members.status, 'Active'))
    .orderBy(asc(members.name));

const activePreMembers = () =>
  db
    .select({
      id: preMembers.id,
      // Active records always have a code (pre_members_code_check).
      code: sql<string>`${preMembers.code}`,
      name: preMembers.name,
      fatherName: preMembers.fatherName,
    })
    .from(preMembers)
    .where(eq(preMembers.status, 'active'))
    .orderBy(asc(preMembers.name));

/** The check-in list of an event, by name. */
export async function loadExpectedPeople(event: {
  audience: Audience;
}): Promise<ExpectedPerson[]> {
  const [memberRows, preMemberRows] = await Promise.all([
    audienceIncludes(event.audience, 'member')
      ? activeMembers()
      : Promise.resolve([]),
    audienceIncludes(event.audience, 'pre_member')
      ? activePreMembers()
      : Promise.resolve([]),
  ]);
  return expectedPeople(event.audience, memberRows, preMemberRows);
}

/** One attendance row of an event with the person it is for. */
export interface AttendanceRowWithPerson {
  key: string;
  status: AttendanceStatus;
  checkedInAt: Date | null;
  method: CheckInMethod | null;
  markedBy: string | null;
  markedByName: string | null;
  person: RowPerson;
}

/** Every attendance row of an event, with the person as stored today. */
export async function loadAttendanceRows(
  eventId: string,
): Promise<AttendanceRowWithPerson[]> {
  const rows = await db
    .select({
      memberId: attendance.memberId,
      preMemberId: attendance.preMemberId,
      status: attendance.status,
      checkedInAt: attendance.checkedInAt,
      method: attendance.method,
      markedBy: attendance.markedBy,
      markedByProfile: profiles.displayName,
      markedByLogin: authUsers.name,
      memberCode: members.memberId,
      memberName: members.name,
      memberFatherName: members.fatherName,
      memberStatus: members.status,
      preMemberCode: preMembers.code,
      preMemberName: preMembers.name,
      preMemberFatherName: preMembers.fatherName,
      preMemberStatus: preMembers.status,
    })
    .from(attendance)
    .leftJoin(members, eq(members.id, attendance.memberId))
    .leftJoin(preMembers, eq(preMembers.id, attendance.preMemberId))
    .leftJoin(profiles, eq(profiles.id, attendance.markedBy))
    .leftJoin(authUsers, eq(authUsers.id, attendance.markedBy))
    .where(eq(attendance.eventId, eventId));

  return rows.map((r) => {
    const isMember = r.memberId !== null;
    return {
      key: attendanceRowKey(r),
      status: r.status,
      checkedInAt: r.checkedInAt,
      method: r.method,
      markedBy: r.markedBy,
      markedByName: r.markedByProfile || r.markedByLogin,
      // Exactly one id is set (attendance_one_person_check); foreign
      // keys keep the person's row.
      person: isMember
        ? {
            kind: 'member',
            id: r.memberId ?? 0,
            code: r.memberCode ?? '',
            name: r.memberName ?? '',
            fatherName: r.memberFatherName ?? '',
            status: r.memberStatus,
          }
        : {
            kind: 'pre_member',
            id: r.preMemberId ?? 0,
            code: r.preMemberCode ?? '',
            name: r.preMemberName ?? '',
            fatherName: r.preMemberFatherName ?? '',
            status: r.preMemberStatus,
          },
    };
  });
}

/**
 * The list of an event (lib/event-people.ts) and its attendance rows: for an
 * open event the expected people plus anyone with a row, for a closed event
 * the rows only.
 */
export async function loadEventPeople(
  event: Pick<typeof events.$inferSelect, 'id' | 'audience' | 'closedAt'>,
): Promise<{ people: ListedPerson[]; rows: AttendanceRowWithPerson[] }> {
  const closed = event.closedAt !== null;
  const [expected, rows] = await Promise.all([
    closed ? Promise.resolve([]) : loadExpectedPeople(event),
    loadAttendanceRows(event.id),
  ]);
  const people = eventPeople({
    audience: event.audience,
    closed,
    expected,
    withRows: rows.map((r) => r.person),
  });
  return { people, rows };
}

/**
 * Closing an event: every expected person without a mark becomes absent
 * (method 'auto_close'). Only the expected people: people on the list only
 * because of an earlier row (promoted, withdrawn…) already have one.
 * Returns how many rows were added.
 */
export async function insertAutoAbsents(
  tx: Tx,
  event: Pick<typeof events.$inferSelect, 'id' | 'audience'>,
  userId: string,
): Promise<number> {
  let count = 0;
  if (audienceIncludes(event.audience, 'member')) {
    const inserted = await tx.execute(sql`
      INSERT INTO ${attendance} (event_id, member_id, status, marked_by, method)
      SELECT ${event.id}::uuid, ${members.id}, 'absent', ${userId}::uuid, 'auto_close'
      FROM ${members}
      WHERE ${members.status} = 'Active'
      ON CONFLICT (event_id, member_id) DO NOTHING
    `);
    count += inserted.count ?? 0;
  }
  if (audienceIncludes(event.audience, 'pre_member')) {
    const inserted = await tx.execute(sql`
      INSERT INTO ${attendance} (event_id, pre_member_id, status, marked_by, method)
      SELECT ${event.id}::uuid, ${preMembers.id}, 'absent', ${userId}::uuid, 'auto_close'
      FROM ${preMembers}
      WHERE ${preMembers.status} = 'active'
      ON CONFLICT (event_id, pre_member_id) DO NOTHING
    `);
    count += inserted.count ?? 0;
  }
  return count;
}
