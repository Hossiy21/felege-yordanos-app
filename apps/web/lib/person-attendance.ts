/**
 * Attendance of one person across events: the timeline and totals of the
 * person page (/admin/people/m|p/[id]) and of the self view (/attendance).
 * Pure functions (no database): lib/person-attendance-queries.ts loads the
 * rows, this module computes.
 *
 * Who was expected at an event:
 * - Closed event: the people with an attendance row. Closing writes a row for
 *   everyone expected at that moment (lib/expected-people.ts), so rows are
 *   the record; no row = not expected (joined or approved later).
 * - Not closed yet (past or today): "not marked" when the person is expected
 *   now (audience + active). Never counted in rates, absences or streaks.
 * - A promoted pre-member is one person: the member rows plus the rows of the
 *   pre-member record (pre_members.promoted_member_id). Those pre-member rows
 *   are the "before membership" section. When one event has a row on both,
 *   the event counts once (the better row wins: attended, then a marked
 *   absent, then the automatic absent).
 *
 * Lateness is the event summary's rule (lib/event-summary.ts): the recorded
 * check-in time against the start, not the P/L tap. Rows without a time count
 * as attended and stay out of every time-based number.
 */
import type { Audience, PersonKind } from './audience';
import { eventStartAt } from './check-in-window';
import {
  attendedStatus,
  minutesVsStart,
  type SummaryMethod,
  type TappedStatus,
} from './event-summary';

/** An event as the person page needs it. */
export interface PersonEventInput {
  id: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  departmentId: number | null;
  recurrenceGroup: string | null;
  audience: Audience;
  closed: boolean;
}

/** One attendance row of the person. */
export interface PersonRowInput {
  event: PersonEventInput;
  /** Which record the row is on: the member row or the pre-member record. */
  on: PersonKind;
  status: TappedStatus;
  checkedInAt: Date | null;
  method: SummaryMethod | null;
  markedByName: string | null;
}

export type TimelineStatus =
  | 'on_time'
  | 'late'
  | 'no_time'
  | 'absent'
  | 'not_marked';

export interface TimelineEntry {
  eventId: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  departmentId: number | null;
  recurrenceGroup: string | null;
  audience: Audience;
  /** Closed events are the ones counted in the totals. */
  closed: boolean;
  status: TimelineStatus;
  /** For absences: a volunteer's A, or the close. */
  absentSource: 'marked' | 'auto' | null;
  /** ISO instant, or null. */
  checkedInAt: string | null;
  /** Whole minutes from the start (negative = early); null without a time. */
  minutesVsStart: number | null;
  method: SummaryMethod | null;
  markedByName: string | null;
  /** A row on the pre-member record of someone who is a member now. */
  beforeMembership: boolean;
}

export interface PersonTotals {
  /** Closed events with a row. */
  expected: number;
  attended: number;
  /** Attended as a share of expected (0–100), null when nothing expected. */
  ratePct: number | null;
  onTime: number;
  late: number;
  /** Attended without a recorded time. */
  noTime: number;
  /** Mean minutes after the start of the late check-ins, rounded. */
  avgLateMin: number | null;
  absent: number;
  absentMarked: number;
  absentOnClose: number;
  /** Events not closed yet without a P/L for the person (not counted). */
  notMarked: number;
  /** Date (YYYY-MM-DD) of the last event the person attended. */
  lastSeen: string | null;
  /** Closed expected events missed in a row, most recent first. */
  missedStreak: number;
}

const isAttended = (s: TimelineStatus) =>
  s === 'on_time' || s === 'late' || s === 'no_time';

/** Lower is better: attended, then a marked absent, then the close's. */
const rowRank = (r: PersonRowInput) =>
  r.status !== 'absent' ? 0 : r.method === 'auto_close' ? 2 : 1;

/** The row that counts when one event has rows on both records. */
function betterRow(a: PersonRowInput, b: PersonRowInput): PersonRowInput {
  const byRank = rowRank(a) - rowRank(b);
  if (byRank !== 0) return byRank < 0 ? a : b;
  if (a.checkedInAt && b.checkedInAt)
    return a.checkedInAt <= b.checkedInAt ? a : b;
  if (a.checkedInAt || b.checkedInAt) return a.checkedInAt ? a : b;
  return a.on === 'member' ? a : b;
}

/**
 * Member history first, then the "before membership" section; each newest
 * first (event date, then start time, then title).
 */
const newestFirst = (a: TimelineEntry, b: TimelineEntry) =>
  Number(a.beforeMembership) - Number(b.beforeMembership) ||
  b.eventDate.localeCompare(a.eventDate) ||
  (b.startTime ?? '').localeCompare(a.startTime ?? '') ||
  a.title.localeCompare(b.title);

function fromRow(row: PersonRowInput, promoted: boolean): TimelineEntry {
  const e = row.event;
  const base = {
    eventId: e.id,
    title: e.title,
    eventDate: e.eventDate,
    startTime: e.startTime,
    departmentId: e.departmentId,
    recurrenceGroup: e.recurrenceGroup,
    audience: e.audience,
    closed: e.closed,
    method: row.method,
    markedByName: row.markedByName,
    beforeMembership: promoted && row.on === 'pre_member',
  };
  if (row.status === 'absent')
    return {
      ...base,
      status: 'absent',
      absentSource: row.method === 'auto_close' ? 'auto' : 'marked',
      checkedInAt: null,
      minutesVsStart: null,
    };
  const start = eventStartAt(e);
  return {
    ...base,
    status: attendedStatus(row.checkedInAt, start),
    absentSource: null,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
    minutesVsStart: row.checkedInAt
      ? minutesVsStart(row.checkedInAt, start)
      : null,
  };
}

/**
 * The person's timeline, newest first (a promoted person's pre-member rows
 * as a section after the member rows): one entry per event with a row (the
 * better row when there are two), plus the open events they are expected at
 * now without a row ("not marked"). `openEvents` are events not closed yet
 * that the caller found the person expected at; closed ones are ignored.
 * `promoted`: the person is a member who was a pre-member.
 */
export function personTimeline({
  rows,
  openEvents,
  promoted,
}: {
  rows: PersonRowInput[];
  openEvents: PersonEventInput[];
  promoted: boolean;
}): TimelineEntry[] {
  const byEvent = new Map<string, PersonRowInput>();
  for (const r of rows) {
    const other = byEvent.get(r.event.id);
    byEvent.set(r.event.id, other ? betterRow(other, r) : r);
  }
  const list = [...byEvent.values()].map((r) => fromRow(r, promoted));
  for (const e of openEvents) {
    if (e.closed || byEvent.has(e.id)) continue;
    list.push({
      eventId: e.id,
      title: e.title,
      eventDate: e.eventDate,
      startTime: e.startTime,
      departmentId: e.departmentId,
      recurrenceGroup: e.recurrenceGroup,
      audience: e.audience,
      closed: false,
      status: 'not_marked',
      absentSource: null,
      checkedInAt: null,
      minutesVsStart: null,
      method: null,
      markedByName: null,
      beforeMembership: false,
    });
  }
  return list.sort(newestFirst);
}

/** Totals of a timeline (as personTimeline returns it). */
export function personTotals(entries: TimelineEntry[]): PersonTotals {
  // The streak and last seen go by date across both sections.
  const byDate = [...entries].sort(
    (a, b) =>
      b.eventDate.localeCompare(a.eventDate) ||
      (b.startTime ?? '').localeCompare(a.startTime ?? ''),
  );
  const counted = byDate.filter((e) => e.closed);
  const onTime = counted.filter((e) => e.status === 'on_time').length;
  const late = counted.filter((e) => e.status === 'late');
  const noTime = counted.filter((e) => e.status === 'no_time').length;
  const absent = counted.filter((e) => e.status === 'absent');
  const absentMarked = absent.filter((e) => e.absentSource === 'marked').length;
  const attended = onTime + late.length + noTime;

  let missedStreak = 0;
  for (const e of counted) {
    if (e.status !== 'absent') break;
    missedStreak += 1;
  }

  return {
    expected: counted.length,
    attended,
    ratePct: counted.length
      ? Math.round((attended / counted.length) * 100)
      : null,
    onTime,
    late: late.length,
    noTime,
    avgLateMin: late.length
      ? Math.round(
          late.reduce((sum, e) => sum + (e.minutesVsStart ?? 0), 0) /
            late.length,
        )
      : null,
    absent: absent.length,
    absentMarked,
    absentOnClose: absent.length - absentMarked,
    notMarked: entries.filter((e) => !e.closed && !isAttended(e.status))
      .length,
    // Seeing someone at an event that is not closed yet still counts.
    lastSeen: byDate.find((e) => isAttended(e.status))?.eventDate ?? null,
    missedStreak,
  };
}

/** The self view: without the staff-only columns (method, marked by). */
export const withoutStaffColumns = (entries: TimelineEntry[]): TimelineEntry[] =>
  entries.map((e) => ({ ...e, method: null, markedByName: null }));

/* ─── Filters (kept in the URL) ─────────────────────────────── */

export const TIMELINE_STATUS_FILTERS = [
  'attended',
  'on_time',
  'late',
  'absent',
  'not_marked',
] as const;
export type TimelineStatusFilter = (typeof TIMELINE_STATUS_FILTERS)[number];

export const TIMELINE_METHODS = ['qr', 'quick_id', 'list', 'auto_close'] as const;

export interface TimelineFilters {
  /** YYYY-MM-DD, inclusive. */
  from: string | null;
  to: string | null;
  /** Department id, or 'general' for events without one. */
  dept: number | 'general' | null;
  /** events.recurrence_group */
  series: string | null;
  audience: Audience | null;
  status: TimelineStatusFilter | null;
  method: SummaryMethod | null;
  /** Event title search. */
  q: string;
}

type Params = Record<string, string | string[] | undefined>;

const one = (p: Params, key: string) => {
  const v = p[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A valid YYYY-MM-DD from the URL, else null. */
export function parseYmdParam(v: string): string | null {
  if (!YMD_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
    ? v
    : null;
}

const pick = <T extends string>(v: string, allowed: readonly T[]): T | null =>
  (allowed as readonly string[]).includes(v) ? (v as T) : null;

/** Filters from the URL; anything invalid is ignored. */
export function parseTimelineFilters(p: Params): TimelineFilters {
  const dept = one(p, 'dept');
  const deptId = /^\d{1,4}$/.test(dept) ? Number(dept) : null;
  const series = one(p, 'series');
  return {
    from: parseYmdParam(one(p, 'from')),
    to: parseYmdParam(one(p, 'to')),
    dept: dept === 'general' ? 'general' : deptId && deptId > 0 ? deptId : null,
    series: UUID_RE.test(series) ? series.toLowerCase() : null,
    audience: pick(one(p, 'audience'), [
      'members',
      'pre_members',
      'everyone',
    ] as const),
    status: pick(one(p, 'status'), TIMELINE_STATUS_FILTERS),
    method: pick(one(p, 'method'), TIMELINE_METHODS),
    q: one(p, 'q').slice(0, 100),
  };
}

/** The event filters: date range, department, series, audience, title. */
export function matchesEventFilters(
  e: TimelineEntry,
  f: TimelineFilters,
): boolean {
  if (f.from && e.eventDate < f.from) return false;
  if (f.to && e.eventDate > f.to) return false;
  if (f.dept === 'general' && e.departmentId !== null) return false;
  if (typeof f.dept === 'number' && e.departmentId !== f.dept) return false;
  if (f.series && e.recurrenceGroup?.toLowerCase() !== f.series) return false;
  if (f.audience && e.audience !== f.audience) return false;
  if (f.q && !e.title.toLowerCase().includes(f.q.toLowerCase())) return false;
  return true;
}

/** The row filters: status and check-in method. */
export function matchesRowFilters(
  e: TimelineEntry,
  f: TimelineFilters,
): boolean {
  if (
    f.status &&
    !(f.status === 'attended' ? isAttended(e.status) : e.status === f.status)
  )
    return false;
  if (f.method && e.method !== f.method) return false;
  return true;
}

/**
 * The totals cover the filtered period (event filters only, so filtering
 * the table by "absent" does not turn the rate into 0 %); the table also
 * applies the status and method filters.
 */
export function filterTimeline(
  entries: TimelineEntry[],
  f: TimelineFilters,
): { totals: PersonTotals; shown: TimelineEntry[] } {
  const period = entries.filter((e) => matchesEventFilters(e, f));
  return {
    totals: personTotals(period),
    shown: period.filter((e) => matchesRowFilters(e, f)),
  };
}
