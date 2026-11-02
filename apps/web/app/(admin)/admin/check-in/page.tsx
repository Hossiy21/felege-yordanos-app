import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { DoorOpen, Lock } from 'lucide-react';
import {
  attendance as attendanceTable,
  db,
  events as eventsTable,
} from '@felege-yordanos/db/server';
import { attendanceRowKey } from '@/lib/audience';
import { loadExpectedPeople } from '@/lib/expected-people';
import { PageHead } from '@/components/ds';
import { checkInWindow } from '@/lib/check-in-window';
import { todayYmd } from '@/lib/events';
import {
  canMarkAttendance,
  canReopenEvent,
  canViewEventAttendance,
  closableFrom,
  isLimitedToCheckInWindow,
} from '@/lib/permissions';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import {
  CheckInTabs,
  type CheckInAttendance,
} from '../attendance/[eventId]/check-in-tabs';
import { BackLink } from '@/components/events/event-ui';
import { secondaryBtn } from '@/components/events/button-classes';
import { CheckInEventPicker, type PickerEvent } from './check-in-event-picker';

type Event = typeof eventsTable.$inferSelect;

export default async function CheckInHubPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: eventParam } = await searchParams;
  const user = await requireUser();
  const t = await getT();

  const today = todayYmd();

  const allEvents = await db
    .select()
    .from(eventsTable)
    .orderBy(desc(eventsTable.eventDate));

  // Only events this user can check people in at.
  const events = allEvents.filter((e) => canMarkAttendance(user, e));
  const todayEvents = events.filter((e) => e.eventDate === today);

  // Default selection: an explicit ?event wins; otherwise auto-pick today's
  // event when there's exactly one (zero-tap for the common door case).
  const validParam =
    eventParam && events.some((e) => e.id === eventParam) ? eventParam : null;
  const selectedId =
    validParam ?? (todayEvents.length === 1 ? todayEvents[0].id : null);
  const selectedEvent = selectedId
    ? (events.find((e) => e.id === selectedId) ?? null)
    : null;

  // Existing attendance is shown only when the user may read it.
  const canView =
    !!selectedEvent && canViewEventAttendance(user, selectedEvent);
  let attendance: CheckInAttendance[] = [];
  if (selectedEvent && canView) {
    const rows = await db
      .select({
        memberId: attendanceTable.memberId,
        preMemberId: attendanceTable.preMemberId,
        status: attendanceTable.status,
      })
      .from(attendanceTable)
      .where(eq(attendanceTable.eventId, selectedEvent.id));
    attendance = rows.map((r) => ({
      key: attendanceRowKey(r),
      status: r.status,
    }));
  }

  const toPicker = (e: Event): PickerEvent => ({
    id: e.id,
    title: e.title,
    eventDate: e.eventDate,
    startTime: e.startTime,
  });

  const picker = (
    <CheckInEventPicker
      events={events.map(toPicker)}
      selectedId={selectedId}
      todayEvents={todayEvents.map(toPicker)}
    />
  );

  // A closed event has no check-in: point to its summary instead.
  if (selectedEvent?.closedAt) {
    return (
      <div className="px-[18px] pb-6 pt-3 md:px-7 md:py-7">
        <div className="mb-2.5 md:hidden">
          <BackLink href="/admin">{t('Admin panel')}</BackLink>
        </div>
        <PageHead
          en="Check-in"
          am="መግቢያ"
          sub="Pick an event, then scan or mark members present."
          actions={<div className="hidden md:block">{picker}</div>}
        />
        <div className="md:hidden">{picker}</div>
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-parchment-edge bg-parchment-soft/50 py-12 text-center md:mt-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/[0.14]">
            <Lock className="h-5 w-5 text-gold-deep" />
          </div>
          <p className="text-sm text-ink-muted">
            {t('This event is closed.')}
          </p>
          {canView && (
            <Link
              href={`/admin/attendance/${selectedEvent.id}`}
              className={secondaryBtn}
            >
              {t('View summary')}
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (selectedEvent) {
    const times = checkInWindow(selectedEvent);
    // Who is expected depends on the event's audience.
    const people = await loadExpectedPeople(selectedEvent);
    return (
      <CheckInTabs
        key={selectedEvent.id}
        eventId={selectedEvent.id}
        checkIn={{
          opensAt: times.opensAt.toISOString(),
          closesAt: times.closesAt.toISOString(),
          now: Date.now(),
          limited: isLimitedToCheckInWindow(user),
        }}
        people={people}
        attendance={attendance}
        audience={selectedEvent.audience}
        event={{
          title: selectedEvent.title,
          eventDate: selectedEvent.eventDate,
          startTime: selectedEvent.startTime,
          endTime: selectedEvent.endTime,
          description: selectedEvent.description,
        }}
        back={{ href: '/admin', label: 'Admin panel' }}
        picker={picker}
        canExport={canView}
        closableFrom={closableFrom(user, selectedEvent)}
        canReopen={canReopenEvent(user)}
      />
    );
  }

  return (
    <div className="px-[18px] pb-6 pt-3 md:px-7 md:py-7">
      <div className="mb-2.5 md:hidden">
        <BackLink href="/admin">{t('Admin panel')}</BackLink>
      </div>
      <PageHead
        en="Check-in"
        am="መግቢያ"
        sub="Pick an event, then scan or mark members present."
        actions={<div className="hidden md:block">{picker}</div>}
      />
      <div className="md:hidden">{picker}</div>

      <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-parchment-edge bg-parchment-soft/50 py-12 text-center md:mt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/[0.14]">
          <DoorOpen className="h-5 w-5 text-gold-deep" />
        </div>
        <p className="text-sm text-ink-muted">
          {t('Select an event above to start check-in.')}
        </p>
      </div>
    </div>
  );
}
