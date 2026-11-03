import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { db, departments, events } from '@felege-yordanos/db/server';
import { checkInWindow } from '@/lib/check-in-window';
import { loadAttendanceRows, loadExpectedPeople } from '@/lib/expected-people';
import { loadEventSummary } from '@/lib/event-summary-queries';
import {
  canReopenEvent,
  canViewEventAttendance,
  canViewEventSummary,
  closableFrom,
  isLimitedToCheckInWindow,
} from '@/lib/permissions';
import { requireUser } from '@/lib/session';
import { CheckInTabs } from './check-in-tabs';
import { EventSummaryView } from './event-summary-view';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await requireUser();
  if (!UUID_RE.test(eventId)) notFound();

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) notFound();
  if (!canViewEventAttendance(user, event)) redirect('/dashboard');

  // A closed event shows its summary instead of the check-in screen.
  if (event.closedAt) {
    if (!canViewEventSummary(user, event)) redirect('/dashboard');
    const [summary, [department]] = await Promise.all([
      loadEventSummary(event),
      event.departmentId
        ? db
            .select({ nameEn: departments.nameEn, nameAm: departments.nameAm })
            .from(departments)
            .where(eq(departments.id, event.departmentId))
            .limit(1)
        : Promise.resolve([]),
    ]);
    return (
      <EventSummaryView
        eventId={event.id}
        event={{
          title: event.title,
          eventDate: event.eventDate,
          startTime: event.startTime,
          endTime: event.endTime,
          departmentId: event.departmentId,
          department: department ?? null,
          audience: event.audience,
          closedAt: event.closedAt.toISOString(),
        }}
        summary={summary}
        canReopen={canReopenEvent(user)}
      />
    );
  }

  // The screen lists these plus anyone with a row (lib/event-people.ts).
  const [people, attendanceRows] = await Promise.all([
    loadExpectedPeople(event),
    loadAttendanceRows(event.id),
  ]);

  const times = checkInWindow(event);

  return (
    <CheckInTabs
      eventId={event.id}
      checkIn={{
        opensAt: times.opensAt.toISOString(),
        closesAt: times.closesAt.toISOString(),
        now: Date.now(),
        limited: isLimitedToCheckInWindow(user),
      }}
      people={people}
      attendance={attendanceRows.map((r) => ({
        key: r.key,
        status: r.status,
        person: r.person,
      }))}
      audience={event.audience}
      event={{
        title: event.title,
        eventDate: event.eventDate,
        startTime: event.startTime,
        endTime: event.endTime,
        description: event.description,
      }}
      back={{ href: '/admin/attendance', label: 'Events' }}
      closableFrom={closableFrom(user, event)}
      canReopen={canReopenEvent(user)}
    />
  );
}

