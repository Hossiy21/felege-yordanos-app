'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { departments, events } from '@felege-yordanos/db/schema';
import { ChevronRight, Pencil, Plus, Repeat, Users } from 'lucide-react';
import { Card, PageHead, StatusPill } from '@/components/ds';
import { useLocale, useT } from '@/lib/i18n/client';
import {
  deptColor,
  deptShortLabel,
  formatYmd,
  hhmm,
  parseYmd,
  todayYmd,
} from '@/lib/events';
import { cn } from '@/lib/utils';
import { eventStartAt } from '@/lib/check-in-window';
import { EventFormDialog } from './event-form-dialog';
import { AudienceTag } from '@/components/forms/audience-tag';
import {
  EventsCalendar,
  type CalEvent,
  type CalLegendItem,
} from '@/components/events/events-calendar';
import {
  BackLink,
  DeptChip,
  ListLabel,
  RecurBadge,
  ViewToggle,
  primaryBtn,
  type ListCalView,
} from '@/components/events/event-ui';

type EventRow = typeof events.$inferSelect;

/**
 * Where an event stands: closed (summary), ongoing (today and started, until
 * someone closes it), upcoming, or past and never closed.
 */
type EventPhase = 'closed' | 'ongoing' | 'upcoming' | 'past';

function eventPhase(e: EventRow, today: string, now: number): EventPhase {
  if (e.closedAt) return 'closed';
  if (e.eventDate === today && now >= eventStartAt(e).getTime()) return 'ongoing';
  return e.eventDate >= today ? 'upcoming' : 'past';
}

/** Status pill for an event that is not simply past. */
function PhasePill({ phase }: { phase: EventPhase }) {
  const t = useT();
  if (phase === 'closed') return <StatusPill tone="neutral">{t('closed')}</StatusPill>;
  if (phase === 'ongoing') return <StatusPill tone="present">{t('ongoing')}</StatusPill>;
  if (phase === 'upcoming') return <StatusPill tone="upcoming">{t('upcoming')}</StatusPill>;
  return null;
}
type Department = typeof departments.$inferSelect;

interface EventsListProps {
  events: EventRow[];
  departments: Department[];
  attendanceCounts: Record<string, number>;
  attendedIds: string[];
  userDeptId: number | null;
  /** Events this user may edit or delete (canEditEvent). */
  editableIds: string[];
  /** May create events (canCreateEvent for some department). */
  canCreate: boolean;
  /** May choose any department, or none (canManageAllEvents). */
  canPickDepartment: boolean;
}

type DialogState = {
  mode: 'create' | 'edit';
  event: EventRow | null;
  date?: string;
};

/**
 * Desktop table columns. Narrow desktops (with the sidebar open) drop
 * columns so the event title keeps room:
 * - md: event (department, date and time on a second line), attendance, actions
 * - lg: event, department, date + time, attendance, actions
 * - xl: event, department, date, time, attendance, actions
 */
const COLS =
  'grid-cols-[minmax(0,1fr)_104px_44px] lg:grid-cols-[minmax(0,1fr)_84px_96px_104px_48px] xl:grid-cols-[minmax(0,1.7fr)_130px_90px_80px_150px_56px]';

/** Visibility of each desktop column, in order (matches COLS). */
const COL_SHOW = [
  '',
  'hidden lg:block',
  'hidden lg:block',
  'hidden xl:block',
  '',
  '',
];

export function EventsList({
  events,
  departments,
  attendanceCounts,
  attendedIds,
  userDeptId,
  editableIds,
  canCreate,
  canPickDepartment,
}: EventsListProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<ListCalView>('list');
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const today = todayYmd();
  const now = Date.now();
  const attendedSet = useMemo(() => new Set(attendedIds), [attendedIds]);
  const editableSet = useMemo(() => new Set(editableIds), [editableIds]);
  const canEdit = (event: EventRow) => editableSet.has(event.id);

  // Upcoming soonest first, then past most recent first (events arrive newest first).
  const upcoming = useMemo(
    () => events.filter((e) => e.eventDate >= today).reverse(),
    [events, today],
  );
  const past = useMemo(
    () => events.filter((e) => e.eventDate < today),
    [events, today],
  );
  const rows = useMemo(() => [...upcoming, ...past], [upcoming, past]);

  const seriesEvents = useMemo(() => {
    const g = dialog?.event?.recurrenceGroup;
    if (!g) return dialog?.event ? [dialog.event] : [];
    return events.filter((e) => e.recurrenceGroup === g);
  }, [dialog, events]);

  function deptFullName(id: number | null): string {
    if (!id) return t('General');
    const d = departments.find((x) => x.id === id);
    if (!d) return deptShortLabel(id, locale);
    return locale === 'am' ? d.nameAm : d.nameEn;
  }

  const openCreate = (date?: string) =>
    setDialog({ mode: 'create', event: null, date });
  const openEdit = (event: EventRow) => {
    if (canEdit(event)) setDialog({ mode: 'edit', event });
  };

  // Calendar data: coloured by department, recurring series marked.
  const calEvents: CalEvent[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        date: e.eventDate,
        start: hhmm(e.startTime),
        end: hhmm(e.endTime),
        title: e.title,
        color: deptColor(e.departmentId),
        sub: deptShortLabel(e.departmentId, 'am'),
        recur: !!e.recurrenceGroup,
      })),
    [events],
  );
  const legend: CalLegendItem[] = useMemo(() => {
    const ids = [...new Set(events.map((e) => e.departmentId))].sort(
      (a, b) => (a ?? 99) - (b ?? 99),
    );
    return ids.map((id) => ({
      label: deptShortLabel(id, 'en'),
      sub: deptShortLabel(id, 'am'),
      color: deptColor(id),
    }));
  }, [events]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const dayMonth = (ymd: string) => ({
    day: String(parseYmd(ymd).getDate()).padStart(2, '0'),
    month: formatYmd(ymd, locale, { month: 'short' }),
  });

  const newEventBtn = (label: string) =>
    canCreate && (
      <button
        type="button"
        onClick={() => openCreate()}
        className={cn(primaryBtn, 'px-4 py-[9px] text-[13px]')}
      >
        <Plus className="h-3.5 w-3.5 text-gold" />
        {label}
      </button>
    );

  const empty = (
    <p className="py-12 text-center text-sm text-ink-muted">
      {t('No events yet. Create one to get started.')}
    </p>
  );

  const calendar = (
    <EventsCalendar
      events={calEvents}
      legend={legend}
      legendNote={
        <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-muted">
          <Repeat className="h-2.5 w-2.5 text-gold-deep" /> {t('recurring')}
        </span>
      }
      onSelectEvent={(id) => {
        const ev = byId.get(id);
        if (ev) openEdit(ev);
      }}
      onCreateAt={canCreate ? openCreate : undefined}
    />
  );

  return (
    <>
      {/* ───────────── PHONE ───────────── */}
      <div className="px-[18px] pb-6 pt-3.5 md:hidden">
        <div className="mb-2.5">
          <BackLink href="/admin">{t('Admin panel')}</BackLink>
        </div>
        <PageHead
          en="Events & attendance"
          am="የስብሰባ ክትትል"
          className="mb-0 items-end [&_h1]:text-[26px]"
          actions={newEventBtn(t('Event'))}
        />
        <div className="my-3.5">
          <ViewToggle view={view} onChange={setView} variant="mobile" />
        </div>

        {view === 'calendar' ? (
          calendar
        ) : events.length === 0 ? (
          empty
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <ListLabel
                  right={
                    upcoming.length === 1
                      ? t('1 event')
                      : t('{n} events', { n: upcoming.length })
                  }
                >
                  {t('Upcoming')}
                </ListLabel>
                <div className="flex flex-col gap-1.5">
                  {upcoming.map((event) => {
                    const { day, month } = dayMonth(event.eventDate);
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-2.5 rounded-xl border border-parchment-edge bg-parchment-soft py-[11px] pl-[18px] pr-3"
                      >
                        <div className="w-10 shrink-0 border-r border-parchment-edge pr-2.5 text-center">
                          <div className="font-display text-[17px] font-medium leading-none tabular-nums lining-nums text-brand dark:text-gold-light">
                            {day}
                          </div>
                          <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-ink-muted">
                            {month}
                          </div>
                        </div>
                        <Link
                          href={`/admin/attendance/${event.id}`}
                          className="min-w-0 flex-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-display text-[15px] font-medium leading-[1.1] text-brand-ink">
                              {event.title}
                            </span>
                            {event.recurrenceGroup && (
                              <Repeat className="h-[11px] w-[11px] shrink-0 text-gold" />
                            )}
                            <AudienceTag
                              audience={event.audience}
                              className="shrink-0 px-1.5 py-px text-[9.5px]"
                            />
                            {eventPhase(event, today, now) !== 'upcoming' && (
                              <PhasePill phase={eventPhase(event, today, now)} />
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-[5px]">
                            <span
                              className={cn(
                                'truncate text-[10px] text-gold-deep',
                                locale === 'am' ? 'font-ethiopic' : 'font-body',
                              )}
                            >
                              {deptShortLabel(event.departmentId, locale)}
                            </span>
                            {event.startTime && (
                              <>
                                <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-ink-faint" />
                                <span className="font-mono text-[10px] text-ink-muted">
                                  {hhmm(event.startTime)}
                                </span>
                              </>
                            )}
                          </div>
                        </Link>
                        {canEdit(event) && (
                          <button
                            type="button"
                            onClick={() => openEdit(event)}
                            className="rounded-md p-1.5 text-ink-faint hover:bg-parchment-deep hover:text-ink"
                            aria-label={t('Edit event')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <Link
                          href={`/admin/attendance/${event.id}`}
                          className="text-ink-faint"
                          aria-label={t('Open event')}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {past.length > 0 && (
              <>
                <ListLabel className={upcoming.length > 0 ? 'mt-5' : undefined}>
                  {t('Past')}
                </ListLabel>
                <div className="overflow-hidden rounded-xl border border-parchment-edge bg-parchment-soft">
                  {past.map((event, i) => (
                    <Link
                      key={event.id}
                      href={`/admin/attendance/${event.id}`}
                      className={cn(
                        'flex items-center gap-2.5 px-3.5 py-[11px] transition-colors hover:bg-parchment-deep/50',
                        i < past.length - 1 && 'border-b border-parchment-edge',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-display text-[15px] font-medium leading-[1.1] text-brand-ink">
                            {event.title}
                          </span>
                          {event.recurrenceGroup && (
                            <Repeat className="h-[11px] w-[11px] shrink-0 text-gold" />
                          )}
                          <AudienceTag
                            audience={event.audience}
                            className="shrink-0 px-1.5 py-px text-[9.5px]"
                          />
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
                          {formatYmd(event.eventDate, locale, {
                            month: 'short',
                            day: '2-digit',
                          })}
                        </div>
                      </div>
                      {event.closedAt && <PhasePill phase="closed" />}
                      <span className="inline-flex items-center gap-1 rounded-md bg-gold/[0.14] px-[9px] py-1 dark:bg-gold/10">
                        <Users className="h-[11px] w-[11px] text-gold-deep" />
                        <span className="font-mono text-[11px] font-semibold text-gold-deep">
                          {attendanceCounts[event.id] ?? 0}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ───────────── DESKTOP ───────────── */}
      <div className="hidden px-7 py-7 md:block">
        <PageHead
          en="Events & attendance"
          am="የስብሰባ ክትትል"
          sub="Create events and manage attendance records"
          actions={
            <>
              <ViewToggle view={view} onChange={setView} variant="desktop" />
              {newEventBtn(t('New event'))}
            </>
          }
        />

        {view === 'calendar' ? (
          calendar
        ) : (
          <Card>
            {events.length === 0 ? (
              empty
            ) : (
              <>
                <div
                  className={cn(
                    'grid gap-3 border-b border-parchment-edge-strong px-1 pb-[9px]',
                    COLS,
                  )}
                >
                  {[
                    t('Event'),
                    t('Department'),
                    t('Date'),
                    t('Time'),
                    t('Attendance'),
                    '',
                  ].map((h, i) => (
                    <span
                      key={i}
                      className={cn(
                        'truncate text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep',
                        COL_SHOW[i],
                      )}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {rows.map((event) => {
                  const phase = eventPhase(event, today, now);
                  return (
                    <div
                      key={event.id}
                      role="link"
                      tabIndex={0}
                      onClick={() =>
                        router.push(`/admin/attendance/${event.id}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          router.push(`/admin/attendance/${event.id}`);
                      }}
                      className={cn(
                        'group grid cursor-pointer items-center gap-3 border-b border-parchment-edge px-1 py-3 transition-colors hover:bg-gold/[0.06]',
                        COLS,
                      )}
                    >
                      <div className="min-w-0 pl-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-display text-base font-medium text-brand-ink">
                            {event.title}
                          </span>
                          <RecurBadge recurrence={event.recurrence} />
                          <AudienceTag
                            audience={event.audience}
                            className="shrink-0"
                          />
                        </div>
                        {/* Narrow desktops: the hidden columns, on one line. */}
                        <div className="mt-1 flex min-w-0 items-center gap-2 lg:hidden">
                          <DeptChip
                            label={deptShortLabel(event.departmentId, locale)}
                            title={deptFullName(event.departmentId)}
                          />
                          <span className="truncate font-mono text-[11px] text-ink-muted">
                            {formatYmd(event.eventDate, locale, {
                              month: 'short',
                              day: '2-digit',
                            })}
                            {event.startTime
                              ? ` · ${hhmm(event.startTime)}`
                              : ''}
                          </span>
                        </div>
                      </div>
                      <div className={cn('min-w-0', COL_SHOW[1])}>
                        <DeptChip
                          label={deptShortLabel(event.departmentId, locale)}
                          title={deptFullName(event.departmentId)}
                        />
                      </div>
                      <span
                        className={cn(
                          'whitespace-nowrap font-mono text-[11px] text-ink',
                          COL_SHOW[2],
                        )}
                      >
                        {formatYmd(event.eventDate, locale, {
                          month: 'short',
                          day: '2-digit',
                        })}
                        {/* Time shares this column until xl. */}
                        {event.startTime && (
                          <span className="text-ink-muted xl:hidden">
                            {` · ${hhmm(event.startTime)}`}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-[11px] text-ink-muted',
                          COL_SHOW[3],
                        )}
                      >
                        {hhmm(event.startTime) || '—'}
                      </span>
                      {phase === 'upcoming' ? (
                        <PhasePill phase={phase} />
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[11.5px] text-ink">
                            {attendanceCounts[event.id] ?? 0}{' '}
                            <span className="font-body text-[10px] text-ink-faint">
                              {t('present')}
                            </span>
                          </span>
                          <PhasePill phase={phase} />
                        </span>
                      )}
                      <div className="flex items-center justify-end gap-1">
                        {canEdit(event) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(event);
                            }}
                            className="rounded-md p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-parchment-deep hover:text-ink focus:opacity-100 group-hover:opacity-100"
                            aria-label={t('Edit event')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </Card>
        )}
      </div>

      {/* ───────────── Create / Edit dialog ───────────── */}
      <EventFormDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        mode={dialog?.mode ?? 'create'}
        event={dialog?.event ?? null}
        defaultDate={dialog?.date ?? null}
        departments={departments}
        userDeptId={userDeptId}
        lockDepartment={!canPickDepartment}
        seriesEvents={seriesEvents}
        attendedIds={attendedSet}
      />
    </>
  );
}
