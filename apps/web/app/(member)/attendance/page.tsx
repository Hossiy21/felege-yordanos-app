import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import {
  attendance,
  db,
  departments,
  events,
  members,
  preMembers,
} from '@felege-yordanos/db/server';
import { Link2 } from 'lucide-react';
import Link from 'next/link';
import { Card, PageHead } from '@/components/ds';
import { deptShortLabel, hhmm, todayYmd } from '@/lib/events';
import { getLocale, getT } from '@/lib/i18n/server';
import { visibleAudiences } from '@/lib/permissions';
import { requireMemberOrPreMember } from '@/lib/session';
import { cn } from '@/lib/utils';
import { primaryBtn } from '@/components/events/button-classes';
import {
  AttendanceView,
  type AttnRow,
  type AttnStatus,
} from './attendance-view';

export default async function MyAttendancePage() {
  // Plain members need a linked member record, pre-members an active
  // pre-member record; staff may still open the page.
  const user = await requireMemberOrPreMember();
  const t = await getT();
  const locale = await getLocale();
  const audiences = visibleAudiences(user);

  // The record linked to this login (through the /claim flow): a member, or
  // an active pre-member (their attendance rows are on pre_member_id).
  const [linkedMember] = await db
    .select({ id: members.id, memberId: members.memberId })
    .from(members)
    .where(eq(members.authUserId, user.id))
    .limit(1);
  const [linkedPre] =
    !linkedMember && user.preMemberRecordId !== null
      ? await db
          .select({ id: preMembers.id, memberId: preMembers.code })
          .from(preMembers)
          .where(eq(preMembers.id, user.preMemberRecordId))
          .limit(1)
      : [];
  const member = linkedMember ?? (linkedPre?.memberId ? linkedPre : null);
  const ownRows = linkedMember
    ? eq(attendance.memberId, linkedMember.id)
    : eq(attendance.preMemberId, linkedPre?.id ?? 0);

  if (!member) {
    return (
      <div className="px-[18px] pb-6 pt-4 md:px-7 md:py-7">
        <PageHead
          en="My events"
          am="መርሃ ግብር"
          sub="Events you're part of and your attendance at each"
        />
        <Card className="mx-auto mt-6 flex max-w-md flex-col items-center gap-4 px-6 py-9 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/[0.14]">
            <Link2 className="h-5 w-5 text-gold-deep" />
          </div>
          <p className="text-sm text-ink-muted">
            {t('Link your member profile to see your attendance history')}
          </p>
          <Link
            href="/claim"
            className={cn(primaryBtn, 'px-5 py-2.5 text-[13px]')}
          >
            {t('Link member profile')}
          </Link>
        </Card>
      </div>
    );
  }

  const today = todayYmd();

  const [attendanceRecords, departmentRows, upcomingData] = await Promise.all([
    // Only the signed-in user's own records.
    db
      .select({
        id: attendance.id,
        status: attendance.status,
        events: events,
      })
      .from(attendance)
      .innerJoin(events, eq(events.id, attendance.eventId))
      .where(ownRows)
      .orderBy(desc(attendance.createdAt)),
    db.select().from(departments).orderBy(asc(departments.id)),
    // Next event for this user's audience (staff: any).
    db
      .select()
      .from(events)
      .where(
        audiences === null
          ? gte(events.eventDate, today)
          : and(
              gte(events.eventDate, today),
              inArray(events.audience, audiences),
            ),
      )
      .orderBy(asc(events.eventDate))
      .limit(1),
  ]);

  const deptLabel = (id: number | null) =>
    departmentRows.some((d) => d.id === id)
      ? deptShortLabel(id, locale)
      : deptShortLabel(null, locale);

  // The signed-in member's attendance records.
  const rows: AttnRow[] = attendanceRecords.map((r) => ({
    id: r.events.id,
    title: r.events.title,
    dept: deptLabel(r.events.departmentId),
    date: r.events.eventDate,
    time: hhmm(r.events.startTime),
    end: hhmm(r.events.endTime),
    status: (r.status as AttnStatus) ?? 'absent',
  }));

  const next = upcomingData[0];
  const nextEvent = next
    ? {
        title: next.title,
        date: next.eventDate,
        time: hhmm(next.startTime),
        dept: deptLabel(next.departmentId),
      }
    : null;

  // The next event is listed as "upcoming" unless it already has a record.
  if (next && !rows.some((r) => r.id === next.id)) {
    rows.push({
      id: next.id,
      title: next.title,
      dept: deptLabel(next.departmentId),
      date: next.eventDate,
      time: hhmm(next.startTime),
      end: hhmm(next.endTime),
      status: 'upcoming',
    });
  }

  // Most recent first by event date (the query returns them by record time).
  rows.sort(
    (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
  );

  return (
    <AttendanceView
      rows={rows}
      nextEvent={nextEvent}
      memberId={member.memberId}
      preMember={!linkedMember}
    />
  );
}
