'use client';

/**
 * Totals, filters and timeline of one person's attendance: the staff person
 * page (/admin/people/m|p/[id]) and the self view (/attendance). Numbers come
 * from lib/person-attendance.ts on the server; `staff` adds the staff-only
 * filter and columns (check-in method, marked by).
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Repeat } from 'lucide-react';
import { Card, StatusPill, type StatusTone } from '@/components/ds';
import { AudienceTag } from '@/components/forms/audience-tag';
import { DeptChip, secondaryBtn } from '@/components/events/event-ui';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { AUDIENCE_LABEL } from '@/lib/audience';
import { eatTime } from '@/lib/check-in-window';
import { csvFileName, toCsv } from '@/lib/csv';
import { formatYmd, hhmm, parseYmd } from '@/lib/events';
import type { SummaryMethod } from '@/lib/event-summary';
import { useLocale, useT } from '@/lib/i18n/client';
import type {
  PersonTotals,
  TimelineEntry,
  TimelineStatus,
} from '@/lib/person-attendance';
import { cn } from '@/lib/utils';
import {
  ClearFilters,
  CollapsibleFilters,
  FilterDate,
  FilterSearch,
  FilterSelect,
  PeriodSelect,
  type FilterOption,
} from './url-filters';

const PAGE_SIZE = 20;

export const STATUS_LABEL: Record<TimelineStatus, string> = {
  on_time: 'On time',
  late: 'Late',
  no_time: 'Present (no time)',
  absent: 'Absent',
  not_marked: 'Not marked',
};

const STATUS_TONE: Record<TimelineStatus, StatusTone> = {
  on_time: 'present',
  late: 'late',
  no_time: 'present',
  absent: 'absent',
  not_marked: 'neutral',
};

export const METHOD_LABEL: Record<SummaryMethod, string> = {
  qr: 'QR scan',
  quick_id: 'Quick ID',
  list: 'List',
  auto_close: 'On close',
};

/** "−13 min" / "+7 min" / "0 min". */
export function vsStartText(min: number | null, unit: string): string {
  if (min === null) return '—';
  if (min === 0) return `0 ${unit}`;
  return `${min > 0 ? '+' : '−'}${Math.abs(min)} ${unit}`;
}

export interface PersonAttendanceViewProps {
  /** Rows after every filter, newest first. */
  entries: TimelineEntry[];
  /** Totals of the filtered period. */
  totals: PersonTotals;
  staff: boolean;
  /** Short department label by id ('general' for none). */
  deptLabels: Record<string, string>;
  deptOptions: FilterOption[];
  seriesOptions: FilterOption[];
  periods: { key: string; label: string; from: string; to: string }[];
  /** Series title by recurrence group (CSV). */
  seriesLabels: Record<string, string>;
  /** A member who was a pre-member: the "before membership" section. */
  promoted: boolean;
  /** Base of the CSV file name. */
  exportName: string;
}

const FILTER_NAMES = [
  'from',
  'to',
  'dept',
  'series',
  'audience',
  'status',
  'method',
  'q',
];

export function PersonAttendanceView(props: PersonAttendanceViewProps) {
  const { entries, totals, staff } = props;
  const t = useT();
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  // New filters: back to the first page.
  useEffect(() => setPage(0), [entries]);
  const shown = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const dept = (e: TimelineEntry) =>
    props.deptLabels[e.departmentId === null ? 'general' : String(e.departmentId)] ??
    '';
  const date = (ymd: string) =>
    formatYmd(ymd, locale, { month: 'short', day: '2-digit', year: 'numeric' });
  const checkIn = (e: TimelineEntry) =>
    e.checkedInAt ? eatTime(new Date(e.checkedInAt)) : '—';
  const method = (e: TimelineEntry) =>
    e.method && e.status !== 'absent' ? t(METHOD_LABEL[e.method]) : '—';
  const absentNote = (e: TimelineEntry) =>
    e.status === 'absent'
      ? t(e.absentSource === 'auto' ? 'On close' : 'Marked')
      : null;

  function exportCsv() {
    const header = [
      t('Event'),
      t('Date'),
      t('Start'),
      t('Department'),
      t('Series'),
      t('Audience'),
      t('Status'),
      t('Counted'),
      t('Checked in'),
      t('Minutes vs start'),
      ...(staff ? [t('Method'), t('Marked by')] : []),
      ...(props.promoted ? [t('Before membership')] : []),
    ];
    const lines = entries.map((e) => [
      e.title,
      e.eventDate,
      hhmm(e.startTime),
      dept(e),
      e.recurrenceGroup ? (props.seriesLabels[e.recurrenceGroup] ?? '') : '',
      t(AUDIENCE_LABEL[e.audience]),
      e.status === 'absent' && staff
        ? `${t('Absent')} (${absentNote(e)})`
        : t(STATUS_LABEL[e.status]),
      e.closed ? t('Yes') : t('No'),
      e.checkedInAt ? eatTime(new Date(e.checkedInAt)) : '',
      e.minutesVsStart,
      ...(staff
        ? [e.method ? t(METHOD_LABEL[e.method]) : '', e.markedByName ?? '']
        : []),
      ...(props.promoted ? [e.beforeMembership ? t('Yes') : ''] : []),
    ]);
    const blob = new Blob([toCsv([header, ...lines])], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(`attendance-${props.exportName}`);
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Filters ── */
  const filters = (
    <CollapsibleFilters
      names={FILTER_NAMES}
      className="grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-8"
    >
      <PeriodSelect label={t('Period')} periods={props.periods} />
      <FilterDate name="from" label={t('From')} />
      <FilterDate name="to" label={t('To')} />
      <FilterSelect
        name="dept"
        label={t('Department')}
        allLabel={t('All')}
        options={props.deptOptions}
      />
      <FilterSelect
        name="series"
        label={t('Series')}
        allLabel={t('All')}
        options={props.seriesOptions}
      />
      <FilterSelect
        name="audience"
        label={t('Audience')}
        allLabel={t('All')}
        options={(['members', 'pre_members', 'everyone'] as const).map(
          (a) => ({ value: a, label: t(AUDIENCE_LABEL[a]) }),
        )}
      />
      <FilterSelect
        name="status"
        label={t('Status')}
        allLabel={t('All')}
        options={[
          { value: 'attended', label: t('Attended') },
          { value: 'on_time', label: t('On time') },
          { value: 'late', label: t('Late') },
          { value: 'absent', label: t('Absent') },
          { value: 'not_marked', label: t('Not marked') },
        ]}
      />
      {staff ? (
        <FilterSelect
          name="method"
          label={t('Method')}
          allLabel={t('All')}
          options={(['qr', 'quick_id', 'list', 'auto_close'] as const).map(
            (m) => ({ value: m, label: t(METHOD_LABEL[m]) }),
          )}
        />
      ) : null}
      <FilterSearch
        label={t('Event')}
        placeholder={t('Search event titles…')}
        className="col-span-2 md:col-span-3 lg:col-span-2"
      />
      <div className="col-span-2 flex items-end justify-end gap-2 md:col-span-1 lg:col-span-6">
        <ClearFilters names={FILTER_NAMES} />
        <button
          type="button"
          onClick={exportCsv}
          disabled={entries.length === 0}
          className={cn(secondaryBtn, 'h-9 py-0')}
        >
          <Download className="h-[13px] w-[13px]" />
          {t('Export CSV')}
        </button>
      </div>
    </CollapsibleFilters>
  );

  /* ── Totals ── */
  const rate = totals.ratePct;
  const totalsBlock = (
    <>
      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 md:gap-4">
        <section className="sacred-gradient relative col-span-3 overflow-hidden rounded-xl border border-gold/30 px-4 py-4 shadow-[0_10px_26px_-14px_rgba(10,60,54,0.55)] md:col-span-1 md:px-[22px] md:py-5">
          <div className="tibeb-gold absolute inset-0 opacity-[0.55]" />
          <div className="relative">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-gold-light">
              {t('Attended')}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[36px] font-medium leading-[0.9] tabular-nums lining-nums text-cream md:text-[42px]">
                  {totals.attended}
                </span>
                <span className="font-mono text-[12px] text-gold-light/80 md:text-[13px]">
                  / {totals.expected} {t('expected')}
                </span>
              </div>
              <span className="font-display text-[20px] italic leading-none text-gold-light md:text-[24px]">
                {rate === null ? '—' : `${rate}%`}
              </span>
            </div>
            <div className="mt-3.5 h-1 rounded bg-cream/15">
              <div
                className="h-full rounded bg-gradient-to-r from-gold-deep to-gold shadow-[0_0_8px_rgba(212,168,67,0.6)]"
                style={{ width: `${Math.min(100, rate ?? 0)}%` }}
              />
            </div>
          </div>
        </section>
        <Stat
          dot="bg-status-present"
          label={t('On time')}
          labelClass="text-status-present"
          value={totals.onTime}
          sub={
            totals.noTime > 0
              ? t('+{n} without a time', { n: totals.noTime })
              : undefined
          }
        />
        <Stat
          dot="bg-status-late"
          label={t('Late')}
          labelClass="text-status-late"
          value={totals.late}
          sub={
            totals.avgLateMin === null
              ? undefined
              : t('avg +{n} min after start', { n: totals.avgLateMin })
          }
        />
        <Stat
          dot="bg-status-absent"
          label={t('Absent')}
          labelClass="text-status-absent"
          value={totals.absent}
          sub={
            totals.absent > 0
              ? t('{a} marked · {b} on close', {
                  a: totals.absentMarked,
                  b: totals.absentOnClose,
                })
              : undefined
          }
        />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2.5 md:mt-4 md:gap-4">
        <Fact
          label={t('Missed in a row')}
          value={String(totals.missedStreak)}
          warn={totals.missedStreak >= 3}
        />
        <Fact
          label={t('Last seen')}
          value={totals.lastSeen ? date(totals.lastSeen) : t('Never')}
        />
        <Fact
          label={t('Not marked')}
          value={String(totals.notMarked)}
          hint={t('Events not closed yet, not counted')}
        />
      </div>
    </>
  );

  /* ── Timeline ── */
  const cols = staff
    ? 'grid-cols-[minmax(0,1.7fr)_104px_96px_132px_70px_64px_84px_minmax(0,0.9fr)]'
    : 'grid-cols-[minmax(0,1.7fr)_110px_110px_140px_64px_72px]';

  const sectionStart = (i: number) =>
    props.promoted &&
    shown[i].beforeMembership &&
    (i === 0 ? page === 0 || !entries[page * PAGE_SIZE - 1]?.beforeMembership : !shown[i - 1].beforeMembership);

  const sectionLabel = (
    <div className="flex items-center gap-2 px-1 pb-1.5 pt-4">
      <PreMemberBadge />
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-pre">
        {t('Before membership')}
      </span>
      <span className="h-px flex-1 bg-parchment-edge" />
    </div>
  );

  const pill = (e: TimelineEntry) => (
    <span className="flex flex-col gap-0.5">
      <StatusPill tone={STATUS_TONE[e.status]}>
        {t(STATUS_LABEL[e.status])}
      </StatusPill>
      {!e.closed && e.status !== 'not_marked' && (
        <span className="text-[9.5px] text-ink-faint">
          {t('Not closed yet')}
        </span>
      )}
      {staff && absentNote(e) && (
        <span className="text-[9.5px] text-ink-faint">{absentNote(e)}</span>
      )}
    </span>
  );

  const tags = (e: TimelineEntry) =>
    (e.recurrenceGroup || e.audience !== 'members') && (
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {e.recurrenceGroup && (
          <span className="inline-flex items-center gap-[3px] text-[9.5px] font-semibold text-gold-deep">
            <Repeat className="h-[9px] w-[9px]" />
            {t('Series')}
          </span>
        )}
        <AudienceTag audience={e.audience} className="px-1.5 py-px text-[9.5px]" />
      </span>
    );

  const empty = (
    <p className="py-10 text-center text-sm text-ink-muted">
      {t('No events match these filters.')}
    </p>
  );

  const pager = pages > 1 && (
    <div className="mt-3 flex items-center justify-between gap-3">
      <span className="font-mono text-[11px] text-ink-muted">
        {page * PAGE_SIZE + 1}–{Math.min(entries.length, (page + 1) * PAGE_SIZE)} /{' '}
        {entries.length}
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label={t('Previous')}
          className={cn(secondaryBtn, 'px-2.5 py-1.5')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          disabled={page >= pages - 1}
          aria-label={t('Next')}
          className={cn(secondaryBtn, 'px-2.5 py-1.5')}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-xl p-3.5 md:p-4">{filters}</Card>
      {totalsBlock}

      {/* Desktop table */}
      <Card className="hidden p-[22px] md:block">
        {entries.length === 0 ? (
          empty
        ) : (
          <>
            <div
              className={cn(
                'grid gap-3 border-b border-parchment-edge-strong px-1 pb-[9px]',
                cols,
              )}
            >
              {[
                t('Event'),
                t('Date'),
                t('Department'),
                t('Status'),
                t('Check-in'),
                t('vs start'),
                ...(staff ? [t('Method'), t('Marked by')] : []),
              ].map((h) => (
                <span
                  key={h}
                  className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
                >
                  {h}
                </span>
              ))}
            </div>
            {shown.map((e, i) => (
              <div key={`${e.eventId}`}>
                {sectionStart(i) && sectionLabel}
                <div
                  className={cn(
                    'grid items-center gap-3 border-b border-parchment-edge px-1 py-2.5',
                    cols,
                  )}
                >
                  <div className="min-w-0">
                    <span className="block truncate font-display text-[15px] font-medium text-brand-ink">
                      {e.title}
                    </span>
                    {tags(e)}
                  </div>
                  <span className="font-mono text-[11px] text-ink">
                    {date(e.eventDate)}
                    {e.startTime && (
                      <span className="block text-[10px] text-ink-muted">
                        {hhmm(e.startTime)}
                      </span>
                    )}
                  </span>
                  <DeptChip label={dept(e)} />
                  {pill(e)}
                  <span className="font-mono text-[11px] text-ink">
                    {checkIn(e)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[11px]',
                      e.status === 'late' ? 'text-status-late' : 'text-ink-muted',
                    )}
                  >
                    {vsStartText(e.minutesVsStart, t('min'))}
                  </span>
                  {staff && (
                    <>
                      <span className="text-[11px] text-ink-muted">
                        {method(e)}
                      </span>
                      <span className="truncate text-[11px] text-ink-muted">
                        {e.markedByName ?? '—'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
            {pager}
          </>
        )}
      </Card>

      {/* Phone cards */}
      <div className="md:hidden">
        {entries.length === 0 ? (
          empty
        ) : (
          <div className="flex flex-col gap-1.5">
            {shown.map((e, i) => (
              <div key={e.eventId}>
                {sectionStart(i) && sectionLabel}
                <div className="flex items-start gap-3 rounded-xl border border-parchment-edge bg-parchment-soft px-3.5 py-[11px]">
                  <div className="flex w-[42px] shrink-0 flex-col text-center">
                    <span className="font-display text-[19px] font-semibold leading-none text-brand dark:text-gold">
                      {String(parseYmd(e.eventDate).getDate()).padStart(2, '0')}
                    </span>
                    <span className="text-[8.5px] uppercase tracking-[0.12em] text-ink-muted">
                      {formatYmd(e.eventDate, locale, { month: 'short' })}
                    </span>
                    <span className="font-mono text-[8.5px] text-ink-faint">
                      {parseYmd(e.eventDate).getFullYear()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-base font-medium leading-[1.15] text-brand-ink">
                      {e.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-ink-muted">
                      <span className="text-gold-deep">{dept(e)}</span>
                      {e.startTime && (
                        <span className="font-mono">· {hhmm(e.startTime)}</span>
                      )}
                      {e.checkedInAt && (
                        <span className="font-mono">
                          · {t('in')} {checkIn(e)} (
                          {vsStartText(e.minutesVsStart, t('min'))})
                        </span>
                      )}
                    </div>
                    {tags(e)}
                    {staff && (e.markedByName || method(e) !== '—') && (
                      <div className="mt-0.5 truncate text-[10px] text-ink-faint">
                        {[method(e) !== '—' ? method(e) : null, e.markedByName]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">{pill(e)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {pager}
      </div>
    </div>
  );
}

function Stat({
  dot,
  label,
  labelClass,
  value,
  sub,
}: {
  dot: string;
  label: string;
  labelClass: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card className="rounded-xl px-3 py-3.5 md:px-[22px] md:py-5">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className={cn('h-[7px] w-[7px] rounded-full', dot)} />
        <span
          className={cn(
            'truncate text-[9px] font-bold uppercase tracking-[0.12em] md:text-[9.5px] md:tracking-[0.18em]',
            labelClass,
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-2 font-display text-[30px] font-medium leading-none tabular-nums lining-nums text-brand-ink md:text-[36px]">
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[10.5px] text-ink-muted">{sub}</div>}
    </Card>
  );
}

function Fact({
  label,
  value,
  hint,
  warn = false,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card className="rounded-xl px-3 py-3 md:px-[22px] md:py-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gold-deep md:text-[9.5px]">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 font-mono text-[14px] font-bold tabular-nums md:text-[16px]',
          warn ? 'text-status-absent' : 'text-ink',
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 hidden text-[10px] text-ink-muted md:block">
          {hint}
        </div>
      )}
    </Card>
  );
}
