'use client';

import { useMemo, useState } from 'react';
import { Clock, QrCode, X } from 'lucide-react';
import { PageHead, SectionHeader } from '@/components/ds';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { MemberQR } from '@/components/member-qr';
import { useLocale, useT } from '@/lib/i18n/client';
import { formatYmd } from '@/lib/events';
import { cn } from '@/lib/utils';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import {
  EventsCalendar,
  type CalEvent,
  type CalLegendItem,
} from '@/components/events/events-calendar';
import {
  ViewToggle,
  type ListCalView,
} from '@/components/events/event-ui';

export type AttnStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'upcoming'
  | 'not_marked';

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
  /** Calendar entries; an upcoming next event may lead the list. */
  rows: AttnRow[];
  /** Totals and timeline (PersonAttendanceSection), the list view. */
  history: React.ReactNode;
  /** All-time count for the header: attended of the closed events. */
  attended: number;
  expected: number;
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
  not_marked: 'rgb(var(--fy-ink-faint))',
};

const STATUS_TEXT: Record<AttnStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  upcoming: 'Upcoming',
  not_marked: 'Not marked',
};

export function AttendanceView({
  rows,
  history,
  attended,
  expected,
  nextEvent,
  memberId,
  preMember = false,
}: AttendanceViewProps) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<ListCalView>('list');
  const [qrOpen, setQrOpen] = useState(false);

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
        status: t(STATUS_TEXT[r.status]),
        hollow: r.status === 'upcoming' || r.status === 'not_marked',
        strike: r.status === 'absent',
      })),
    [rows, t],
  );
  const legend: CalLegendItem[] = [
    { label: t('Present'), color: STATUS_COLOR.present },
    { label: t('Late'), color: STATUS_COLOR.late },
    { label: t('Absent'), color: STATUS_COLOR.absent },
    { label: t('Upcoming'), color: STATUS_COLOR.upcoming, hollow: true },
    {
      label: t('Not marked'),
      color: STATUS_COLOR.not_marked,
      hollow: true,
    },
  ];
  const calendar = <EventsCalendar events={calEvents} legend={legend} />;

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
      <div className="px-[18px] pt-4 md:hidden">
        <PageHead
          en="My events"
          am="መርሃ ግብር"
          className="mb-0"
          actions={
            <div className="text-right">
              <div className="font-mono text-[15px] text-brand dark:text-gold-light">
                {attended}/{expected}
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
      </div>

      {/* ───────────── DESKTOP ───────────── */}
      <div className="hidden px-7 pt-7 md:block">
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
      </div>

      {/* List (totals and timeline) or calendar, phone and desktop */}
      <div className="px-[18px] pb-6 md:px-7 md:pb-7">
        {view === 'calendar' ? (
          calendar
        ) : (
          <>
            <div className="mb-3 hidden md:block">
              <SectionHeader en="Attendance history" am="የመገኘት ታሪክ" />
            </div>
            {history}
          </>
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
