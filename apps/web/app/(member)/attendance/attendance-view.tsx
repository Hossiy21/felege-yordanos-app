'use client';

import { useMemo, useState } from 'react';
import { Clock, QrCode, X } from 'lucide-react';
import { Card, PageHead, SectionHeader, StatusPill } from '@/components/ds';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { MemberQR } from '@/components/member-qr';
import { useLocale, useT } from '@/lib/i18n/client';
import { formatYmd, parseYmd } from '@/lib/events';
import { cn } from '@/lib/utils';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import {
  EventsCalendar,
  type CalEvent,
  type CalLegendItem,
} from '@/components/events/events-calendar';
import {
  DeptChip,
  ViewToggle,
  type ListCalView,
} from '@/components/events/event-ui';

export type AttnStatus = 'present' | 'late' | 'absent' | 'upcoming';

export interface AttnRow {
  /** Event id. */
  id: string;
  title: string;
  /** Short department label in the current language. */
  dept: string;
  /** ISO event date (YYYY-MM-DD). */
  date: string;
  /** "08:30" or "". */
  time: string;
  end: string;
  status: AttnStatus;
}

export interface NextEvent {
  title: string;
  date: string;
  time: string;
  dept: string;
}

interface AttendanceViewProps {
  /** Most recent first; an upcoming next event may lead the list. */
  rows: AttnRow[];
  nextEvent: NextEvent | null;
  /** SSU member ID, or the FYP code when `preMember`. */
  memberId: string | null;
  preMember?: boolean;
}

const STATUS_COLOR: Record<AttnStatus, string> = {
  present: 'rgb(var(--fy-present))',
  late: 'rgb(var(--fy-late))',
  absent: 'rgb(var(--fy-absent))',
  upcoming: 'rgb(var(--fy-gold))',
};

const COLS = 'grid-cols-[minmax(0,1.5fr)_120px_90px_80px_110px]';

export function AttendanceView({
  rows,
  nextEvent,
  memberId,
  preMember = false,
}: AttendanceViewProps) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<ListCalView>('list');
  const [qrOpen, setQrOpen] = useState(false);

  const attended = rows.filter(
    (r) => r.status === 'present' || r.status === 'late',
  ).length;
  const pastTotal = rows.filter((r) => r.status !== 'upcoming').length;

  const calEvents: CalEvent[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        date: r.date,
        start: r.time,
        end: r.end,
        title: r.title,
        color: STATUS_COLOR[r.status],
        sub: r.dept,
        status: t(r.status),
        hollow: r.status === 'upcoming',
        strike: r.status === 'absent',
      })),
    [rows, t],
  );
  const legend: CalLegendItem[] = [
    { label: t('Present'), color: STATUS_COLOR.present },
    { label: t('Late'), color: STATUS_COLOR.late },
    { label: t('Absent'), color: STATUS_COLOR.absent },
    { label: t('Upcoming'), color: STATUS_COLOR.upcoming, hollow: true },
  ];
  const calendar = <EventsCalendar events={calEvents} legend={legend} />;

  const empty = (
    <p className="py-10 text-center text-sm text-ink-muted">
      {t('No attendance records yet.')}
    </p>
  );

  const qrButton = (variant: 'banner' | 'chip') =>
    memberId && (
      <button
        type="button"
        onClick={() => setQrOpen(true)}
        className={cn(
          'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold transition-colors',
          variant === 'banner'
            ? 'rounded-lg border border-gold/40 bg-cream/10 px-3 py-1.5 text-[11.5px] text-gold-light hover:bg-cream/15'
            : 'rounded-lg border border-gold/40 bg-cream/10 px-2.5 py-1.5 text-[11px] text-gold-light',
        )}
      >
        <QrCode className="h-3.5 w-3.5" />
        {t('Check-in code')}
      </button>
    );

  const nextLabel = nextEvent
    ? `${formatYmd(nextEvent.date, locale)}${nextEvent.time ? ` · ${nextEvent.time}` : ''}`
    : '';

  return (
    <>
      {/* ───────────── PHONE ───────────── */}
      <div className="px-[18px] pb-6 pt-4 md:hidden">
        <PageHead
          en="My events"
          am="መርሃ ግብር"
          className="mb-0"
          actions={
            <div className="text-right">
              <div className="font-mono text-[15px] text-brand dark:text-gold-light">
                {attended}/{pastTotal}
              </div>
              <div className="text-[8.5px] uppercase tracking-[0.14em] text-ink-muted">
                {t('attended')}
              </div>
            </div>
          }
        />

        {/* Next event */}
        <div className="sacred-gradient relative mt-3.5 overflow-hidden rounded-[14px] border border-gold/30 px-4 py-3 shadow-[0_10px_26px_-14px_rgba(10,60,54,0.55)]">
          <div className="tibeb-gold absolute inset-0 opacity-[0.55]" />
          <div className="relative flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold-light">
                {t('Next event')}
              </div>
              {nextEvent ? (
                <>
                  <div className="mt-0.5 truncate font-display text-[17px] font-medium leading-tight text-cream">
                    {nextEvent.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-gold-light">
                    <Clock className="h-[11px] w-[11px]" />
                    {nextLabel}
                  </div>
                </>
              ) : (
                <div className="mt-0.5 font-display text-[15px] italic text-cream/70">
                  {t('No upcoming events')}
                </div>
              )}
            </div>
            {qrButton('chip')}
          </div>
        </div>

        <div className="my-3.5">
          <ViewToggle view={view} onChange={setView} variant="mobile" />
        </div>

        {view === 'calendar' ? (
          calendar
        ) : rows.length === 0 ? (
          empty
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-parchment-edge bg-parchment-soft px-3.5 py-[11px]"
              >
                <div className="flex w-[42px] shrink-0 flex-col text-center">
                  <span className="font-display text-[19px] font-semibold leading-none text-brand dark:text-gold">
                    {String(parseYmd(r.date).getDate()).padStart(2, '0')}
                  </span>
                  <span className="text-[8.5px] uppercase tracking-[0.12em] text-ink-muted">
                    {formatYmd(r.date, locale, { month: 'short' })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-medium leading-[1.15] text-brand-ink">
                    {r.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        'truncate text-[10.5px] text-gold-deep',
                        locale === 'am' ? 'font-ethiopic' : 'font-body',
                      )}
                    >
                      {r.dept}
                    </span>
                    {r.time && (
                      <span className="shrink-0 font-mono text-[9.5px] text-ink-faint">
                        · {r.time}
                      </span>
                    )}
                  </div>
                </div>
                <StatusPill tone={r.status} className="shrink-0 text-[10px]">
                  {t(r.status)}
                </StatusPill>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───────────── DESKTOP ───────────── */}
      <div className="hidden px-7 py-7 md:block">
        <PageHead
          en="My events"
          am="መርሃ ግብር"
          sub="Events you're part of and your attendance at each"
          actions={
            <ViewToggle view={view} onChange={setView} variant="desktop" />
          }
        />

        {/* Next event */}
        <div className="sacred-gradient relative mb-4 flex flex-wrap items-center gap-4 overflow-hidden rounded-[14px] border border-gold/30 px-5 py-3.5 shadow-[0_10px_26px_-14px_rgba(10,60,54,0.55)]">
          <div className="tibeb-gold pointer-events-none absolute inset-0 opacity-[0.55]" />
          <div className="relative whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.2em] text-gold-light">
            {t('Next event')}
          </div>
          {nextEvent ? (
            <>
              <div className="relative whitespace-nowrap font-display text-xl font-medium leading-[1.1] text-cream">
                {nextEvent.title}
              </div>
              <div className="relative flex items-center gap-2 whitespace-nowrap font-mono text-[11.5px] text-gold-light">
                <Clock className="h-3 w-3" />
                {nextLabel}
              </div>
              <div
                className={cn(
                  'relative ml-auto whitespace-nowrap text-xs text-cream/85',
                  locale === 'am' ? 'font-ethiopic' : 'font-body',
                )}
              >
                {nextEvent.dept}
              </div>
            </>
          ) : (
            <div className="relative font-display text-lg italic text-cream/70">
              {t('No upcoming events')}
            </div>
          )}
          <div className={cn('relative', !nextEvent && 'ml-auto')}>
            {qrButton('banner')}
          </div>
        </div>

        {view === 'calendar' ? (
          calendar
        ) : (
          <Card className="p-[22px]">
            <div className="mb-3.5 flex items-center justify-between">
              <SectionHeader en="Events" am="የክትትል ታሪክ" />
              <span className="whitespace-nowrap font-mono text-xs text-gold-deep">
                {attended} / {pastTotal}{' '}
                <span className="font-body text-[9.5px] text-ink-muted">
                  {t('attended')}
                </span>
              </span>
            </div>

            {rows.length === 0 ? (
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
                    t('Status'),
                  ].map((h) => (
                    <span
                      key={h}
                      className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      'grid items-center gap-3 border-b border-parchment-edge px-1 py-3',
                      COLS,
                    )}
                  >
                    <div className="min-w-0 pl-3">
                      <span className="block truncate font-display text-base font-medium text-brand-ink">
                        {r.title}
                      </span>
                    </div>
                    <DeptChip label={r.dept} />
                    <span className="font-mono text-[11px] text-ink">
                      {formatYmd(r.date, locale, {
                        month: 'short',
                        day: '2-digit',
                      })}
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {r.time || '—'}
                    </span>
                    <StatusPill tone={r.status}>{t(r.status)}</StatusPill>
                  </div>
                ))}
              </>
            )}
          </Card>
        )}
      </div>

      {/* Check-in code */}
      {memberId && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-[340px] gap-0 rounded-[20px] border-parchment-edge bg-parchment p-6 text-center sm:rounded-[20px] [&>button:last-child]:hidden">
            <div className="flex items-start justify-between">
              <div className="text-left">
                <div
                  className={cn(
                    'text-[11px] tracking-[0.06em] text-gold-deep',
                    locale === 'am' ? 'font-display text-xs' : 'font-ethiopic',
                  )}
                >
                  {locale === 'am' ? 'Check-in code' : 'የመገኘት ኮድ'}
                </div>
                <DialogTitle
                  className={cn(
                    'text-brand-ink',
                    locale === 'am'
                      ? 'font-ethiopic text-xl font-semibold'
                      : 'font-display text-2xl font-medium',
                  )}
                >
                  {t('Check-in code')}
                </DialogTitle>
              </div>
              <DialogClose
                className="flex h-8 w-8 items-center justify-center rounded-full border border-parchment-edge bg-parchment-soft text-ink-muted hover:text-ink"
                aria-label={t('Close')}
              >
                <X className="h-[15px] w-[15px]" />
              </DialogClose>
            </div>
            <div className="mx-auto mt-4 w-fit rounded-xl border border-parchment-edge bg-parchment-soft p-3 shadow-[0_8px_20px_-12px_rgba(12,69,61,0.35)]">
              <MemberQR
                value={memberId}
                size={196}
                variant={preMember ? 'pre_member' : 'member'}
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[13px] tracking-[0.08em] text-ink">
              {memberId}
              {preMember && <PreMemberBadge />}
            </div>
            <DialogDescription className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              {t('Show this code at the door to check in.')}
            </DialogDescription>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
