/**
 * Reads for the people list and the person pages (/admin/people, /attendance).
 * Callers check canViewPeople / canViewPersonAttendance (lib/permissions.ts)
 * first. The rules (who was expected, lateness, streaks) are
 * lib/person-attendance.ts; the people list repeats them in one SQL query.
 */
import 'server-only';
import { and, eq, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  attendance,
  authUsers,
  db,
  events,
  members,
  preMembers,
  profiles,
} from '@felege-yordanos/db/server';
import { AUDIENCES, audienceIncludes, type PersonKind } from './audience';
import { eatDate } from './check-in-window';
import { PEOPLE_PAGE_SIZE, type PeopleFilters, type PeopleRow } from './people-list';
import {
  personTimeline,
  type PersonEventInput,
  type TimelineEntry,
} from './person-attendance';

/* ─── People list ───────────────────────────────────────────── */

const ORDER: Record<PeopleFilters['sort'], { asc: SQL; desc: SQL }> = {
  name: {
    asc: sql`lower(p.name) ASC, lower(p.father_name) ASC`,
    desc: sql`lower(p.name) DESC, lower(p.father_name) DESC`,
  },
  code: { asc: sql`p.code ASC`, desc: sql`p.code DESC` },
  expected: { asc: sql`expected ASC`, desc: sql`expected DESC` },
  attended: { asc: sql`attended ASC`, desc: sql`attended DESC` },
  rate: {
    asc: sql`rate_pct ASC NULLS LAST`,
    desc: sql`rate_pct DESC NULLS LAST`,
  },
  // Never seen first: the people who stopped coming (or never came).
  last_seen: {
    asc: sql`last_seen ASC NULLS FIRST`,
    desc: sql`last_seen DESC NULLS LAST`,
  },
  streak: { asc: sql`streak ASC`, desc: sql`streak DESC` },
};

interface RawPeopleRow {
  kind: 'm' | 'p';
  id: string;
  code: string | null;
  name: string;
  father_name: string;
  department_id: string | null;
  status: string | null;
  active: boolean;
  expected: number;
  attended: number;
  rate_pct: number | null;
  last_seen: string | null;
  streak: number;
  total: number;
}

/**
 * One page of the people list (or every row, for the CSV), in one query:
 * members and pre-members (active and withdrawn; promoted records are part of
 * their member) with their counts over closed events in the date range.
 * Rows of a promoted pre-member count for the member; an event with rows on
 * both counts once (attended beats a marked absent beats the close's; on a
 * tie the pre-member row, as in lib/person-attendance.ts). The search also
 * finds a member by the FYP code they had as a pre-member.
 */
export async function loadPeople(
  f: PeopleFilters,
  { all = false }: { all?: boolean } = {},
): Promise<{ rows: PeopleRow[]; total: number }> {
  const eventRange = sql.join(
    [
      sql`TRUE`,
      f.from ? sql`e.event_date >= ${f.from}::date` : undefined,
      f.to ? sql`e.event_date <= ${f.to}::date` : undefined,
    ].filter((c): c is SQL => !!c),
    sql` AND `,
  );

  const q = f.q.trim();
  const where = sql.join(
    [
      sql`TRUE`,
      f.type ? sql`p.kind = ${f.type === 'member' ? 'm' : 'p'}` : undefined,
      f.status === 'active' ? sql`p.active` : undefined,
      f.status === 'inactive' ? sql`NOT p.active` : undefined,
      f.dept ? sql`p.department_id = ${f.dept}` : undefined,
      f.rateBelow
        ? sql`expected > 0 AND attended * 100 < ${f.rateBelow} * expected`
        : undefined,
      f.streakMin ? sql`streak >= ${f.streakMin}` : undefined,
      f.notSeenSince
        ? sql`(last_seen IS NULL OR last_seen < ${f.notSeenSince}::date)`
        : undefined,
      q
        ? sql`(p.name || ' ' || p.father_name ILIKE ${`%${q}%`} OR p.code ILIKE ${`%${q}%`} OR p.former_code ILIKE ${`%${q}%`})`
        : undefined,
    ].filter((c): c is SQL => !!c),
    sql` AND `,
  );

  const page = all
    ? sql``
    : sql`LIMIT ${PEOPLE_PAGE_SIZE} OFFSET ${(f.page - 1) * PEOPLE_PAGE_SIZE}`;

  const rows = (await db.execute(sql`
    WITH person_rows AS (
      SELECT
        CASE WHEN a.member_id IS NOT NULL OR pm.status = 'promoted' THEN 'm' ELSE 'p' END AS kind,
        CASE
          WHEN a.member_id IS NOT NULL THEN a.member_id
          WHEN pm.status = 'promoted' THEN pm.promoted_member_id
          ELSE a.pre_member_id
        END AS pid,
        a.event_id,
        a.status,
        a.method,
        a.member_id IS NOT NULL AS on_member,
        a.checked_in_at,
        e.event_date,
        e.event_date + coalesce(e.start_time, time '00:00') AS starts,
        e.closed_at IS NOT NULL AS closed
      FROM attendance a
      JOIN events e ON e.id = a.event_id
      LEFT JOIN pre_members pm ON pm.id = a.pre_member_id
      WHERE ${eventRange}
    ),
    per_event AS (
      SELECT DISTINCT ON (kind, pid, event_id) *
      FROM person_rows
      ORDER BY kind, pid, event_id,
        CASE WHEN status <> 'absent' THEN 0
             WHEN method IS DISTINCT FROM 'auto_close' THEN 1
             ELSE 2 END,
        checked_in_at ASC NULLS LAST,
        on_member ASC
    ),
    with_last AS (
      SELECT *,
        max(starts) FILTER (WHERE closed AND status <> 'absent')
          OVER (PARTITION BY kind, pid) AS last_attended
      FROM per_event
    ),
    counts AS (
      SELECT kind, pid,
        count(*) FILTER (WHERE closed)::int AS expected,
        count(*) FILTER (WHERE closed AND status <> 'absent')::int AS attended,
        max(event_date) FILTER (WHERE status <> 'absent') AS last_seen,
        count(*) FILTER (
          WHERE closed AND status = 'absent'
            AND (last_attended IS NULL OR starts > last_attended)
        )::int AS streak
      FROM with_last
      GROUP BY kind, pid
    ),
    people AS (
      SELECT 'm' AS kind, m.id, m.member_id AS code, m.name, m.father_name,
        m.department_id, m.status, coalesce(m.status = 'Active', FALSE) AS active,
        fp.code AS former_code
      FROM members m
      LEFT JOIN pre_members fp
        ON fp.promoted_member_id = m.id AND fp.status = 'promoted'
      UNION ALL
      SELECT 'p', x.id, x.code, x.name, x.father_name,
        NULL, x.status, x.status = 'active', NULL
      FROM pre_members x
      WHERE x.status IN ('active', 'withdrawn')
    ),
    listed AS (
      SELECT p.*,
        coalesce(c.expected, 0) AS expected,
        coalesce(c.attended, 0) AS attended,
        CASE WHEN coalesce(c.expected, 0) > 0
          THEN round(c.attended * 100.0 / c.expected)::int END AS rate_pct,
        c.last_seen,
        coalesce(c.streak, 0) AS streak
      FROM people p
      LEFT JOIN counts c ON c.kind = p.kind AND c.pid = p.id
    )
    SELECT p.kind, p.id::text AS id, p.code, p.name, p.father_name,
      p.department_id::text AS department_id, p.status, p.active,
      p.expected, p.attended, p.rate_pct,
      to_char(p.last_seen, 'YYYY-MM-DD') AS last_seen, p.streak,
      count(*) OVER ()::int AS total
    FROM listed p
    WHERE ${where}
    ORDER BY ${ORDER[f.sort][f.dir]}, p.kind, p.id
    ${page}
  `)) as unknown as RawPeopleRow[];

  return {
    total: rows[0]?.total ?? 0,
    rows: rows.map((r) => ({
      kind: r.kind === 'm' ? 'member' : 'pre_member',
      id: Number(r.id),
      code: r.code ?? '',
      name: r.name,
      fatherName: r.father_name,
      departmentId: r.department_id === null ? null : Number(r.department_id),
      status: r.status,
      active: r.active,
      expected: r.expected,
      attended: r.attended,
      ratePct: r.rate_pct,
      lastSeen: r.last_seen,
      missedStreak: r.streak,
    })),
  };
}

/* ─── One person ────────────────────────────────────────────── */

export interface PersonRecord {
  kind: PersonKind;
  id: number;
  /** SSU member ID or FYP code ('' for records without one). */
  code: string;
  name: string;
  fatherName: string;
  grandfatherName: string | null;
  /** Members only. */
  departmentId: number | null;
  status: string | null;
  /** Expected at events now (members.status 'Active', pre-members 'active'). */
  active: boolean;
  /** Login account linked to the record. */
  authUserId: string | null;
  /** Members: the pre-member record promoted into this member. */
  formerPreMember: { id: number; code: string | null } | null;
  /** Pre-members: the member row they were promoted into. */
  promotedMemberId: number | null;
  /** Pre-members: approval (no "not marked" events before it). */
  approvedAt: Date | null;
}

export async function loadMemberRecord(
  id: number,
): Promise<PersonRecord | null> {
  const [[m], former] = await Promise.all([
    db
      .select({
        id: members.id,
        code: members.memberId,
        name: members.name,
        fatherName: members.fatherName,
        grandfatherName: members.grandfatherName,
        departmentId: members.departmentId,
        status: members.status,
        authUserId: members.authUserId,
      })
      .from(members)
      .where(eq(members.id, id))
      .limit(1),
    db
      .select({ id: preMembers.id, code: preMembers.code })
      .from(preMembers)
      .where(
        and(
          eq(preMembers.promotedMemberId, id),
          eq(preMembers.status, 'promoted'),
        ),
      )
      .limit(1),
  ]);
  if (!m) return null;
  return {
    kind: 'member',
    ...m,
    active: m.status === 'Active',
    formerPreMember: former[0] ?? null,
    promotedMemberId: null,
    approvedAt: null,
  };
}

export async function loadPreMemberRecord(
  id: number,
): Promise<PersonRecord | null> {
  const [p] = await db
    .select({
      id: preMembers.id,
      code: preMembers.code,
      name: preMembers.name,
      fatherName: preMembers.fatherName,
      grandfatherName: preMembers.grandfatherName,
      status: preMembers.status,
      authUserId: preMembers.authUserId,
      promotedMemberId: preMembers.promotedMemberId,
      approvedAt: preMembers.approvedAt,
    })
    .from(preMembers)
    .where(eq(preMembers.id, id))
    .limit(1);
  if (!p) return null;
  return {
    kind: 'pre_member',
    ...p,
    code: p.code ?? '',
    departmentId: null,
    active: p.status === 'active',
    formerPreMember: null,
    promotedMemberId: p.status === 'promoted' ? p.promotedMemberId : null,
  };
}

/** The record linked to a login: the member row, else an active pre-member. */
export async function loadOwnRecord(user: {
  memberRecordId: number | null;
  preMemberRecordId: number | null;
}): Promise<PersonRecord | null> {
  if (user.memberRecordId !== null)
    return loadMemberRecord(user.memberRecordId);
  if (user.preMemberRecordId !== null)
    return loadPreMemberRecord(user.preMemberRecordId);
  return null;
}

/**
 * The timeline of a person (lib/person-attendance.ts): their rows (a member's
 * include the rows of their former pre-member record) and the events not
 * closed yet, up to today, that they are expected at now.
 */
export async function loadPersonTimeline(
  person: PersonRecord,
  today: string,
): Promise<TimelineEntry[]> {
  const ownRows: SQL =
    person.kind === 'member'
      ? (or(
          eq(attendance.memberId, person.id),
          person.formerPreMember
            ? eq(attendance.preMemberId, person.formerPreMember.id)
            : undefined,
        ) as SQL)
      : eq(attendance.preMemberId, person.id);

  const eventCols = {
    id: events.id,
    title: events.title,
    eventDate: events.eventDate,
    startTime: events.startTime,
    departmentId: events.departmentId,
    recurrenceGroup: events.recurrenceGroup,
    audience: events.audience,
    closedAt: events.closedAt,
  };
  const toEvent = ({
    closedAt,
    ...e
  }: Omit<PersonEventInput, 'closed'> & {
    closedAt: Date | null;
  }): PersonEventInput => ({ ...e, closed: closedAt !== null });

  const audiences = AUDIENCES.filter((a) => audienceIncludes(a, person.kind));
  const [rows, open] = await Promise.all([
    db
      .select({
        event: eventCols,
        memberId: attendance.memberId,
        status: attendance.status,
        checkedInAt: attendance.checkedInAt,
        method: attendance.method,
        markedByProfile: profiles.displayName,
        markedByLogin: authUsers.name,
      })
      .from(attendance)
      .innerJoin(events, eq(events.id, attendance.eventId))
      .leftJoin(profiles, eq(profiles.id, attendance.markedBy))
      .leftJoin(authUsers, eq(authUsers.id, attendance.markedBy))
      .where(ownRows),
    person.active
      ? db
          .select(eventCols)
          .from(events)
          .where(
            and(
              isNull(events.closedAt),
              lte(events.eventDate, today),
              inArray(events.audience, audiences),
              person.approvedAt
                ? gte(events.eventDate, eatDate(person.approvedAt))
                : undefined,
            ),
          )
      : Promise.resolve([]),
  ]);

  return personTimeline({
    rows: rows.map((r) => ({
      event: toEvent(r.event),
      on: r.memberId !== null ? 'member' : 'pre_member',
      status: r.status,
      checkedInAt: r.checkedInAt,
      method: r.method,
      markedByName: r.markedByProfile || r.markedByLogin,
    })),
    openEvents: open.map(toEvent),
    promoted: person.formerPreMember !== null,
  });
}
