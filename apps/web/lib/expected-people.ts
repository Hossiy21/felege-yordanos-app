/**
 * Who is expected at an event: the one place the check-in screens, the close
 * (automatic absents) and the summary get their list from. The rule itself
 * (which kinds per audience) is lib/audience.ts.
 *
 * Expected: active members (members.status = 'Active') for 'members',
 * active pre-members for 'pre_members', both for 'everyone'.
 */
import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import {
  attendance,
  db,
  members,
  preMembers,
  type events,
} from '@felege-yordanos/db/server';
import {
  audienceIncludes,
  expectedPeople,
  type Audience,
  type ExpectedPerson,
} from './audience';

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

/**
 * Closing an event: every expected person without a mark becomes absent
 * (method 'auto_close'). Returns how many rows were added.
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
