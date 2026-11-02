'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { Card, Chip, SectionHeader, StatusPill } from '@/components/ds';
import { ReopenEventButton } from '@/components/events/event-close';
import { BackLink, DeptChip, secondaryBtn } from '@/components/events/event-ui';
import { Input } from '@/components/ui/input';
import { eatTime } from '@/lib/check-in-window';
import { deptShortLabel, formatYmd, hhmm } from '@/lib/events';
import type {
  EventSummary,
  SummaryMethod,
  SummaryRecord,
  SummaryStatus,
} from '@/lib/event-summary';
import type { Audience, PersonKind } from '@/lib/audience';
import { AudienceTag } from '@/components/forms/audience-tag';
import { useLocale, useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { MemberIdText } from './check-in-tabs';

interface SummaryEvent {
  title: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  departmentId: number | null;
  department: { nameEn: string; nameAm: string } | null;
  closedAt: string;
  audience: Audience;
}

/** Record filter: a computed status, or everyone. */
type RecordFilter = 'all' | SummaryStatus;

const PAGE_SIZE = 12;

const METHOD_LABEL: Record<SummaryMethod, string> = {
  qr: 'QR scan',
  quick_id: 'Quick ID',
  list: 'List',
  auto_close: 'On close',
};

const TAP_LETTER = { present: 'P', late: 'L', absent: 'A' } as const;

/** Small uppercase label inside a card ("CHECK-IN METHOD"). */
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[9.5px] font-semibold uppercase tracking-[0.18em] text-gold-deep',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** "−13 min" / "+7 min" / "0 min" (`unit` is the translated "min"). */
function vsStart(min: number | null, unit: string): string {
  if (min === null) return '—';
  if (min === 0) return `0 ${unit}`;
  return `${min > 0 ? '+' : '−'}${Math.abs(min)} ${unit}`;
}

const timeOf = (iso: string | null | undefined) =>
  iso ? eatTime(new Date(iso)) : '—';

export function EventSummaryView({
  eventId,
  event,
  summary: s,
  canReopen,
}: {
  eventId: string;
  event: SummaryEvent;
  summary: EventSummary & { closedByName: string | null };
  canReopen: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RecordFilter>('all');
  // Members and pre-members apart (only when the event has both).
  const [kind, setKind] = useState<'all' | PersonKind>('all');
  const mixed = s.groups.length > 1;
  const [page, setPage] = useState(0);

  // ── Header ──
  const start = hhmm(event.startTime);
  const end = hhmm(event.endTime);
  const timeRange = start && end ? `${start}–${end}` : start || end;
  const dateLine = [formatYmd(event.eventDate, locale), timeRange]
    .filter(Boolean)
    .join(' · ');
  const deptName = event.department
    ? locale === 'am'
      ? event.department.nameAm
      : event.department.nameEn
    : t('General');
  const closedBy = s.closedByName
    ? t('by {name} · {time}', {
        name: s.closedByName,
        time: timeOf(event.closedAt),
      })
    : timeOf(event.closedAt);

  // ── Records ──
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ofKind =
      kind === 'all' ? s.records : s.records.filter((r) => r.kind === kind);
    if (!q) return ofKind;
    return ofKind.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.memberId.toLowerCase().includes(q),
    );
  }, [s.records, search, kind]);

  const counts = useMemo(() => {
    const c: Record<RecordFilter, number> = {
      all: searched.length,
      on_time: 0,
      late: 0,
      absent: 0,
      no_time: 0,
    };
    for (const r of searched) c[r.status] += 1;
    return c;
  }, [searched]);

  const filtered = useMemo(
    () => (filter === 'all' ? searched : searched.filter((r) => r.status === filter)),
    [searched, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const filters: { key: RecordFilter; label: string; dot?: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'on_time', label: t('Present'), dot: 'bg-status-present' },
    { key: 'late', label: t('Late'), dot: 'bg-status-late' },
    { key: 'absent', label: t('Absent'), dot: 'bg-status-absent' },
    ...(s.noTime > 0 ? [{ key: 'no_time' as const, label: t('No time') }] : []),
  ];

  /** CSV of the attendance record (all members, not just this page). */
  function exportCsv() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const statusText: Record<SummaryStatus, string> = {
      on_time: 'Present',
      late: 'Late',
      absent: 'Absent',
      no_time: 'Present (no time)',
    };
    const lines = [
      [
        'Member ID',
        'Name',
        ...(event.audience !== 'members' ? ['Type'] : []),
        'Checked in',
        'Minutes vs start',
        'Method',
        'Status',
        'Tapped',
      ].join(','),
    ];
    for (const r of s.records)
      lines.push(
        [
          r.memberId,
          r.name,
          ...(event.audience !== 'members'
            ? [r.kind === 'pre_member' ? 'Pre-member' : 'Member']
            : []),
          r.checkedInAt ? eatTime(new Date(r.checkedInAt)) : '',
          r.minutesVsStart === null ? '' : String(r.minutesVsStart),
          r.method ? METHOD_LABEL[r.method] : '',
          statusText[r.status],
          r.tapped ?? '',
        ]
          .map(esc)
          .join(','),
      );
    const blob = new Blob(['﻿' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${event.eventDate}-${event.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'event'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions = (
    <>
      <button type="button" onClick={exportCsv} className={secondaryBtn}>
        <Download className="h-[13px] w-[13px]" />
        {t('Export')}
      </button>
      {canReopen && <ReopenEventButton eventId={eventId} />}
    </>
  );

  // ── Status pill for a record ──
  const statusPill = (r: SummaryRecord) => {
    const pill =
      r.status === 'absent' ? (
        <StatusPill tone="absent">{t('Absent')}</StatusPill>
      ) : r.status === 'late' ? (
        <StatusPill tone="late">{t('Late')}</StatusPill>
      ) : r.status === 'no_time' && r.tapped === 'late' ? (
        <StatusPill tone="late">{t('Late')}</StatusPill>
      ) : (
        <StatusPill tone="present">{t('Present')}</StatusPill>
      );
    const note =
      r.tapMismatch && r.tapped
        ? t('tapped {letter}', { letter: TAP_LETTER[r.tapped] })
        : r.absentSource === 'auto'
          ? t('on close')
          : r.status === 'no_time'
            ? t('no time')
            : null;
    return (
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {pill}
        {note && <span className="text-[10px] text-ink-faint">{note}</span>}
      </span>
    );
  };

  const methodText = (r: SummaryRecord) =>
    r.method && r.method !== 'auto_close' && r.status !== 'absent'
      ? t(METHOD_LABEL[r.method])
      : '—';

  // ── Pieces ──
  const statCards = (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
      {/* Attendance */}
      <section className="sacred-gradient relative overflow-hidden rounded-xl border border-gold/30 px-4 py-4 shadow-[0_10px_26px_-14px_rgba(10,60,54,0.55)] md:px-[22px] md:py-5">
        <div className="tibeb-gold absolute inset-0 opacity-[0.55]" />
        <div className="relative">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-gold-light">
            {t('Attendance')}
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[36px] font-medium leading-[0.9] tabular-nums lining-nums text-cream md:text-[46px]">
                {s.attended}
              </span>
              <span className="font-mono text-[12px] text-gold-light/80 md:text-[14px]">
                / {s.total}
              </span>
            </div>
            <span className="font-display text-[20px] italic leading-none text-gold-light md:text-[26px]">
              {s.attendedPct}%
            </span>
          </div>
          <div className="mt-3.5 h-1 rounded bg-cream/15">
            <div
              className="h-full rounded bg-gradient-to-r from-gold-deep to-gold shadow-[0_0_8px_rgba(212,168,67,0.6)]"
              style={{ width: `${Math.min(100, s.attendedPct)}%` }}
            />
          </div>
        </div>
      </section>

      <StatCard
        dot="bg-status-present"
        label={t('On time')}
        labelClass="text-status-present"
        value={s.onTime}
        sub={t('{pct}% of attendees', { pct: s.onTimePct })}
      />
      <StatCard
        dot="bg-status-late"
        label={t('Late')}
        labelClass="text-status-late"
        value={s.late}
        sub={
          s.avgLateMin === null
            ? t('No late check-ins')
            : t('avg +{n} min after start', { n: s.avgLateMin })
        }
      />
      <StatCard
        dot="bg-status-absent"
        label={t('Absent')}
        labelClass="text-status-absent"
        value={s.absent}
        sub={t('{a} marked · {b} on close', {
          a: s.absentMarked,
          b: s.absentOnClose,
        })}
      />
    </div>
  );

  /** Members and pre-members apart, when the event had both. */
  const groupsCard = mixed && (
    <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:mt-4 md:grid-cols-2 md:gap-4">
      {s.groups.map((g) => (
        <Card key={g.kind} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 md:px-[22px]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-ink">
                {t(g.kind === 'member' ? 'Members' : 'Pre-members')}
              </span>
              {g.kind === 'pre_member' && <PreMemberBadge />}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-muted">
              {t('{a} on time · {b} late · {c} absent', {
                a: g.onTime,
                b: g.late,
                c: g.absent,
              })}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="font-display text-[26px] font-medium leading-none tabular-nums lining-nums text-brand-ink">
              {g.attended}
            </span>
            <span className="font-mono text-[11px] text-ink-muted"> / {g.total}</span>
            <div className="font-mono text-[10.5px] text-ink-muted">{g.attendedPct}%</div>
          </div>
        </Card>
      ))}
    </div>
  );

  const legacyNote = s.noTime > 0 && (
    <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
      {s.noTime === 1
        ? t(
            '1 member was marked before check-in times were recorded: they count as attended, but not in the time-based numbers.',
          )
        : t(
            '{n} members were marked before check-in times were recorded: they count as attended, but not in the time-based numbers.',
            { n: s.noTime },
          )}
    </p>
  );

  const methodTotal = s.methods.qr + s.methods.quick_id + s.methods.list + s.methods.unknown;
  const methodRows = [
    { key: 'qr', label: t('QR scan'), n: s.methods.qr, color: 'bg-brand' },
    { key: 'quick_id', label: t('Quick ID'), n: s.methods.quick_id, color: 'bg-gold' },
    { key: 'list', label: t('List'), n: s.methods.list, color: 'bg-ink-faint' },
    ...(s.methods.unknown
      ? [{ key: 'unknown', label: t('Not recorded'), n: s.methods.unknown, color: 'bg-parchment-edge-strong' }]
      : []),
  ];
  const pctOf = (n: number) => (methodTotal ? Math.round((n / methodTotal) * 100) : 0);

  const glanceRow = (label: string, value: string, sub: string | null, ethiopicSub = false) => (
    <div className="flex items-start justify-between gap-3 border-b border-parchment-edge py-3 first:pt-1">
      <span className="text-[12.5px] text-ink">{label}</span>
      <div className="min-w-0 text-right">
        <div className="font-mono text-[13px] font-bold tabular-nums text-ink">{value}</div>
        {sub && (
          <div
            className={cn(
              'mt-0.5 truncate text-[10.5px] text-ink-muted',
              ethiopicSub ? 'font-ethiopic' : 'font-mono',
            )}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );

  const glance = (
    <Card className="rounded-xl p-[22px]">
      <SectionHeader en="At a glance" am="በአጭሩ" />
      <div className="mt-4">
        {glanceRow(t('First check-in'), timeOf(s.first?.at), s.first?.name ?? null, true)}
        {glanceRow(
          t('Median arrival'),
          timeOf(s.median?.at),
          s.median
            ? s.median.minutesVsStart === 0
              ? t('at the start')
              : t('{diff} from start', { diff: vsStart(s.median.minutesVsStart, t('min')) })
            : null,
        )}
        {glanceRow(
          t('Busiest 5 minutes'),
          s.busiest ? `${timeOf(s.busiest.from)}–${timeOf(s.busiest.to)}` : '—',
          s.busiest
            ? s.busiest.count === 1
              ? t('1 check-in')
              : t('{n} check-ins', { n: s.busiest.count })
            : null,
        )}
        {glanceRow(t('Last check-in'), timeOf(s.last?.at), s.last?.name ?? null, true)}
      </div>

      <Label className="mt-5">{t('Check-in method')}</Label>
      <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-parchment-deep">
        {methodRows.map((m) => (
          <div key={m.key} className={m.color} style={{ width: `${pctOf(m.n)}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {methodRows.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11.5px] text-ink">
              <span aria-hidden className={cn('h-2 w-2 rounded-[2px]', m.color)} />
              {m.label}
            </span>
            <span className="font-mono text-[10.5px] tabular-nums text-ink-muted">
              {m.n} · {pctOf(m.n)}%
            </span>
          </div>
        ))}
      </div>

      <Label className="mt-5">{t('Checked in by')}</Label>
      <div className="mt-2 flex flex-col gap-1.5">
        {s.checkedInBy.length === 0 ? (
          <span className="text-[11.5px] text-ink-muted">—</span>
        ) : (
          s.checkedInBy.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] text-ink">{v.name}</span>
              <span className="font-mono text-[10.5px] tabular-nums text-ink-muted">{v.count}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );

  const chart = (
    <Card className="rounded-xl p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader en="When members checked in" am="የመግቢያ ሰዓት" />
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <span className="flex items-center gap-1.5 text-[10.5px] text-ink">
            <span aria-hidden className="h-2 w-2 rounded-[2px] bg-status-present" />
            {t('On time')}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-ink">
            <span aria-hidden className="h-2 w-2 rounded-[2px] bg-status-late" />
            {t('Late')}
          </span>
        </div>
      </div>
      <CheckInChart summary={s} />
    </Card>
  );

  const searchBox = (cls: string) => (
    <div className={cn('relative', cls)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-faint" />
      <Input
        placeholder={t('Name or ID…')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        aria-label={t('Search members')}
        className="h-auto rounded-md border border-parchment-edge bg-parchment py-[7px] pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30 dark:bg-parchment-deep"
      />
    </div>
  );

  const COLS = 'grid-cols-[170px_minmax(0,1fr)_84px_84px_92px_150px]';

  const record = (
    <Card className="rounded-xl p-[18px] md:p-[22px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <SectionHeader en="Attendance record" am="የመገኘት መዝገብ" />
        {searchBox('w-full md:w-[272px]')}
      </div>

      {mixed && (
        <div
          role="group"
          aria-label={t('Filter by type')}
          className="mt-3.5 flex gap-1.5"
        >
          {(['all', 'member', 'pre_member'] as const).map((k) => (
            <Chip
              key={k}
              active={kind === k}
              aria-pressed={kind === k}
              amharic={locale === 'am'}
              onClick={() => {
                setKind(k);
                setPage(0);
              }}
            >
              {t(k === 'all' ? 'Everyone' : k === 'member' ? 'Members' : 'Pre-members')}
            </Chip>
          ))}
        </div>
      )}

      <div
        role="group"
        aria-label={t('Filter by status')}
        className="mt-3.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden"
      >
        {filters.map(({ key, label, dot }) => {
          const active = filter === key;
          return (
            <Chip
              key={key}
              active={active}
              aria-pressed={active}
              amharic={locale === 'am'}
              onClick={() => {
                setFilter(key);
                setPage(0);
              }}
            >
              {dot && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
              {label}
              <span
                className={cn(
                  'font-mono text-[10px] tabular-nums',
                  active ? 'text-cream/75' : 'text-ink-muted',
                )}
              >
                {counts[key]}
              </span>
            </Chip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">{t('No members found')}</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-3.5 hidden md:block">
            <div className={cn('grid gap-3 border-b border-parchment-edge-strong px-1 pb-[9px]', COLS)}>
              {[t('ID'), t('Member'), t('Checked in'), t('vs start'), t('Method'), t('Status')].map(
                (h) => (
                  <span
                    key={h}
                    className="truncate text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
                  >
                    {h}
                  </span>
                ),
              )}
            </div>
            {pageRows.map((r) => (
              <div
                key={r.key}
                className={cn('grid items-center gap-3 border-b border-parchment-edge px-1 py-2.5', COLS)}
              >
                <MemberIdText memberId={r.memberId} />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{r.name}</span>
                  {r.kind === 'pre_member' && <PreMemberBadge />}
                </span>
                <span className="font-mono text-[11.5px] tabular-nums text-ink">
                  {timeOf(r.checkedInAt)}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                  {vsStart(r.minutesVsStart, t('min'))}
                </span>
                <span className="truncate text-[11.5px] text-ink-muted">{methodText(r)}</span>
                {statusPill(r)}
              </div>
            ))}
          </div>

          {/* Phone cards */}
          <div className="mt-3 flex flex-col gap-1.5 md:hidden">
            {pageRows.map((r) => (
              <div
                key={r.key}
                className="rounded-lg border border-parchment-edge bg-parchment px-3 py-2.5 dark:bg-parchment-deep"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{r.name}</div>
                    <div className="flex items-center gap-1.5">
                      <MemberIdText memberId={r.memberId} />
                      {r.kind === 'pre_member' && <PreMemberBadge />}
                    </div>
                  </div>
                  <div className="shrink-0">{statusPill(r)}</div>
                </div>
                <div className="mt-1.5 flex items-center gap-2 font-mono text-[10.5px] tabular-nums text-ink-muted">
                  <span className="text-ink">{timeOf(r.checkedInAt)}</span>
                  <span>{vsStart(r.minutesVsStart, t('min'))}</span>
                  <span className="font-body">{methodText(r)}</span>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3">
              <span className="text-[11px] text-ink-muted">
                {t('{from}–{to} of {total}', {
                  from: safePage * PAGE_SIZE + 1,
                  to: Math.min((safePage + 1) * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                  aria-label={t('Previous page')}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-parchment-edge text-ink-muted hover:bg-parchment-deep disabled:opacity-40 md:h-7 md:w-7"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-[11px] tabular-nums text-ink">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                  aria-label={t('Next page')}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-parchment-edge text-ink-muted hover:bg-parchment-deep disabled:opacity-40 md:h-7 md:w-7"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );

  return (
    <div className="px-[18px] pb-6 pt-3 md:px-7 md:py-7">
      {/* Back */}
      <div className="mb-2.5 md:hidden">
        <BackLink href="/admin/attendance">{t('Events')}</BackLink>
      </div>
      <Link
        href="/admin/attendance"
        className="mb-4 hidden w-fit items-center gap-1.5 text-[12px] font-medium text-ink transition-colors hover:text-brand md:flex"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('Events & attendance')}
      </Link>

      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div
            className={cn(
              'text-xs tracking-[0.06em] text-gold-deep',
              locale === 'am' ? 'font-display' : 'font-ethiopic',
            )}
          >
            {locale === 'am' ? 'Event summary' : 'የዝግጅት ማጠቃለያ'}
          </div>
          <h1
            className={cn(
              'mt-0.5 leading-[1.05] text-brand-ink',
              locale === 'am'
                ? 'font-ethiopic text-[24px] font-semibold md:text-[28px]'
                : 'font-display text-[26px] font-medium md:text-[32px]',
            )}
          >
            {t('Summary')} — {event.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[12.5px] text-ink-muted">{dateLine}</span>
            <DeptChip label={deptShortLabel(event.departmentId, locale)} title={deptName} />
            <AudienceTag audience={event.audience} />
            <span className="flex items-center gap-1.5 text-[11px]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
              <span className="font-semibold text-ink">{t('Closed')}</span>
              <span className="text-ink-muted">{closedBy}</span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>

      {statCards}
      {groupsCard}
      {legacyNote}

      <div className="mt-3 grid grid-cols-1 gap-3 md:mt-4 md:gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {chart}
        {glance}
      </div>

      <div className="mt-3 md:mt-4">{record}</div>
    </div>
  );
}

function StatCard({
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
  sub: string;
}) {
  return (
    <Card className="rounded-xl px-4 py-4 md:px-[22px] md:py-5">
      <div
        className={cn(
          'flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.2em]',
          labelClass,
        )}
      >
        <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot)} />
        {label}
      </div>
      <div className="mt-2.5 font-display text-[36px] font-medium leading-[0.9] tabular-nums lining-nums text-brand-ink md:text-[42px]">
        {value}
      </div>
      <div className="mt-2.5 text-[11px] leading-snug text-ink-muted md:text-[11.5px]">{sub}</div>
    </Card>
  );
}

/** Height of the bar area in px (labels and the start marker sit outside). */
const PLOT_H = 170;
/** Narrowest bar slot on phones; the chart scrolls sideways below that. */
const MIN_SLOT_PX = 18;

/**
 * Check-ins per 5 minutes: green bars up to the start, orange after it, a
 * dashed start line and a light shade over the late side. Plain HTML/CSS
 * with theme tokens (no chart library).
 */
function CheckInChart({ summary: s }: { summary: EventSummary }) {
  const t = useT();
  const buckets = s.buckets;
  if (buckets.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-parchment-edge py-12 text-center text-xs text-ink-muted">
        {t('No check-ins were recorded.')}
      </p>
    );
  }

  const max = Math.max(...buckets.map((b) => b.count));
  const mid = Math.round(max / 2);
  const onTimeSlots = buckets.filter((b) => b.onTime).length;
  const startPct = (onTimeSlots / buckets.length) * 100;
  const startInside = onTimeSlots < buckets.length;
  const startTime = eatTime(new Date(s.startAt));
  const opensAtStart = buckets[0].from === new Date(s.opensAt).toISOString();
  const grid = [max, mid].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <div className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:thin]">
      <div style={{ minWidth: buckets.length * MIN_SLOT_PX }}>
        {/* Plot */}
        <div className="relative mt-5" style={{ height: PLOT_H }}>
          {/* Late side shade */}
          {startInside && (
            <div
              aria-hidden
              className="absolute bottom-0 right-0 top-0 rounded-tr-sm bg-parchment-deep/70 dark:bg-gold/[0.05]"
              style={{ left: `${startPct}%` }}
            />
          )}
          {/* Grid lines with values */}
          {grid.map((v) => (
            <div
              key={v}
              aria-hidden
              className="absolute left-0 right-0 border-t border-dashed border-parchment-edge-strong/70"
              style={{ bottom: `${(v / max) * 100}%` }}
            >
              <span className="absolute -top-3 right-0 font-mono text-[9px] text-ink-faint">{v}</span>
            </div>
          ))}
          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-1">
            {buckets.map((b) => (
              <div
                key={b.from}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
                title={`${eatTime(new Date(b.from))}–${eatTime(new Date(b.to))} · ${b.count}`}
              >
                {b.count > 0 && (
                  <div
                    className={cn(
                      'w-full max-w-[30px] rounded-t-[2px]',
                      b.onTime ? 'bg-status-present' : 'bg-status-late',
                    )}
                    style={{ height: `${(b.count / max) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Start line */}
          <div
            aria-hidden
            className="absolute -top-5 bottom-0 border-l border-dashed border-brand dark:border-gold"
            style={{ left: `${startPct}%` }}
          >
            <span
              className={cn(
                'absolute top-0 whitespace-nowrap text-[9.5px] font-semibold text-brand dark:text-gold',
                startPct > 80 ? 'right-1.5' : 'left-1.5',
              )}
            >
              {t('Start {time}', { time: startTime })}
            </span>
          </div>
          {/* Baseline */}
          <div aria-hidden className="absolute bottom-0 left-0 right-0 border-t border-parchment-edge-strong" />
        </div>

        {/* X axis */}
        <div className="relative mt-2 h-7 font-mono text-[9.5px] text-ink">
          <div className="absolute left-0 top-0">
            <div>{eatTime(new Date(buckets[0].from))}</div>
            <div className="font-body text-[9px] text-ink-muted">
              {opensAtStart ? t('opened') : t('first check-in')}
            </div>
          </div>
          {startInside && startPct > 12 && startPct < 88 && (
            <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${startPct}%` }}>
              <div>{startTime}</div>
              <div className="font-body text-[9px] text-status-late">{t('late after')}</div>
            </div>
          )}
          <div className="absolute right-0 top-0 text-right">
            <div>{s.last ? eatTime(new Date(s.last.at)) : ''}</div>
            <div className="font-body text-[9px] text-ink-muted">{t('last check-in')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
