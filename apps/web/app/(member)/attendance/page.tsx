import { and, asc, gte, inArray } from 'drizzle-orm';
import { db, events } from '@felege-yordanos/db/server';
import { Link2 } from 'lucide-react';
import Link from 'next/link';
import { Card, PageHead } from '@/components/ds';
import { PersonAttendanceSection } from '@/components/people/person-attendance-section';
import { deptShortLabel, hhmm, todayYmd } from '@/lib/events';
import { getLocale, getT } from '@/lib/i18n/server';
import { loadOwnRecord, loadPersonTimeline } from '@/lib/people-queries';
import {
  personTotals,
  withoutStaffColumns,
  type TimelineStatus,
} from '@/lib/person-attendance';
import { canViewPersonAttendance, visibleAudiences } from '@/lib/permissions';
import { requireMemberOrPreMember } from '@/lib/session';
import { cn } from '@/lib/utils';
import { primaryBtn } from '@/components/events/button-classes';
import {
  AttendanceView,
  type AttnRow,
  type AttnStatus,
} from './attendance-view';

const CALENDAR_STATUS: Record<TimelineStatus, AttnStatus> = {
  on_time: 'present',
  no_time: 'present',
  late: 'late',
  absent: 'absent',
  not_marked: 'not_marked',
};

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Plain members need a linked member record, pre-members an active
  // pre-member record; staff may still open the page.
  const user = await requireMemberOrPreMember();
  const [t, locale, sp] = await Promise.all([getT(), getLocale(), searchParams]);
  const audiences = visibleAudiences(user);

  // The record linked to this login (through the /claim flow): a member
  // (with their pre-member history, if promoted), or an active pre-member.
  const own = await loadOwnRecord(user);
  const member =
    own && own.code && canViewPersonAttendance(user, own) ? own : null;

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

  const [timeline, upcomingData] = await Promise.all([
    // Only the signed-in user's own records, without the staff-only columns.
    loadPersonTimeline(member, today).then(withoutStaffColumns),
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
      .orderBy(asc(events.eventDate), asc(events.startTime))
      .limit(1),
  ]);
  const totals = personTotals(timeline);

  const rows: AttnRow[] = timeline.map((e) => ({
    id: e.eventId,
    title: e.title,
    dept: deptShortLabel(e.departmentId, locale),
    date: e.eventDate,
    time: hhmm(e.startTime),
    end: '',
    status: CALENDAR_STATUS[e.status],
  }));

  const next = upcomingData[0];
  const nextEvent = next
    ? {
        title: next.title,
        date: next.eventDate,
        time: hhmm(next.startTime),
        dept: deptShortLabel(next.departmentId, locale),
      }
    : null;

  // The next event is on the calendar as "upcoming" unless it already is.
  if (next && !rows.some((r) => r.id === next.id)) {
    rows.push({
      id: next.id,
      title: next.title,
      dept: deptShortLabel(next.departmentId, locale),
      date: next.eventDate,
      time: hhmm(next.startTime),
      end: hhmm(next.endTime),
      status: 'upcoming',
    });
  }

  return (
    <AttendanceView
      rows={rows}
      attended={totals.attended}
      expected={totals.expected}
      history={
        <PersonAttendanceSection
          person={member}
          searchParams={sp}
          staff={false}
          timeline={timeline}
        />
      }
      nextEvent={nextEvent}
      memberId={member.code}
      preMember={member.kind === 'pre_member'}
    />
  );
}
