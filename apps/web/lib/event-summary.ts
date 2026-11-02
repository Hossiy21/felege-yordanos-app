/**
 * Numbers for the summary of a closed event. Pure functions (no database):
 * lib/event-summary-queries.ts loads the rows, this module computes.
 *
 * Lateness comes only from the recorded check-in time against the event's
 * start time (on time = at or before the start, no grace period), never from
 * the P/L a volunteer tapped. Rows marked before times were recorded count as
 * attended but are left out of every time-based number.
 */
import type { PersonKind } from './audience';
import { checkInWindow, eventStartAt } from './check-in-window';

export type TappedStatus = 'present' | 'late' | 'absent';
export type SummaryMethod = 'qr' | 'quick_id' | 'list' | 'auto_close';

/** Status shown in the summary, computed from the time. */
export type SummaryStatus = 'on_time' | 'late' | 'no_time' | 'absent';

/** Why someone is absent: a volunteer's A, the close, or no row at all. */
export type AbsentSource = 'marked' | 'auto' | 'none';

export const BUCKET_MIN = 5;
const MINUTE_MS = 60_000;
const BUCKET_MS = BUCKET_MIN * MINUTE_MS;

export interface SummaryEventInput {
  eventDate: string;
  startTime: string | null;
  checkInOpensBeforeMin: number;
  checkInClosesAfterMin: number;
}

/** One person on the event's list (lib/expected-people.ts). */
export interface SummaryMemberInput {
  /** "m:<members.id>" or "p:<pre_members.id>" (lib/audience.ts). */
  key: string;
  kind: PersonKind;
  /** ID shown: SSU member ID or FYP code. */
  code: string;
  name: string;
  fatherName: string;
}

export interface SummaryRowInput {
  /** Person key of the attendance row. */
  key: string;
  status: TappedStatus;
  checkedInAt: Date | null;
  method: SummaryMethod | null;
  markedBy: string | null;
  markedByName: string | null;
}

export interface SummaryRecord {
  key: string;
  kind: PersonKind;
  /** ID shown: SSU member ID or FYP code. */
  memberId: string;
  name: string;
  status: SummaryStatus;
  /** What the volunteer tapped (null without a row). */
  tapped: TappedStatus | null;
  /** The tap disagrees with the time (P tapped but late, or L but on time). */
  tapMismatch: boolean;
  absentSource: AbsentSource | null;
  /** ISO instant, or null. */
  checkedInAt: string | null;
  /** Whole minutes from the start (negative = early); null without a time. */
  minutesVsStart: number | null;
  method: SummaryMethod | null;
}

export interface SummaryBucket {
  /** ISO instant the bucket starts after (bucket = (from, to]). */
  from: string;
  to: string;
  count: number;
  /** Ends at or before the start time: every check-in in it was on time. */
  onTime: boolean;
}

export interface SummaryPoint {
  at: string;
  name: string;
}

/** Totals per kind of person (shown when an event has both). */
export interface SummaryGroup {
  kind: PersonKind;
  total: number;
  attended: number;
  onTime: number;
  late: number;
  absent: number;
  attendedPct: number;
}

export interface EventSummary {
  total: number;
  attended: number;
  onTime: number;
  late: number;
  /** Attended without a recorded time (marked before times were recorded). */
  noTime: number;
  absent: number;
  absentMarked: number;
  /** Absent because of the close (plus members with no row at all). */
  absentOnClose: number;
  /** On time as a share of attendees with a recorded time (0–100). */
  onTimePct: number;
  attendedPct: number;
  /** Mean minutes after the start of the late check-ins, rounded. */
  avgLateMin: number | null;
  startAt: string;
  opensAt: string;
  first: SummaryPoint | null;
  last: SummaryPoint | null;
  median: { at: string; minutesVsStart: number } | null;
  busiest: SummaryBucket | null;
  buckets: SummaryBucket[];
  methods: { qr: number; quick_id: number; list: number; unknown: number };
  checkedInBy: { name: string; count: number }[];
  /** Members and pre-members apart (only the kinds on the list). */
  groups: SummaryGroup[];
  records: SummaryRecord[];
}

/** Whole minutes between a check-in and the start: late is always ≥ +1. */
export function minutesVsStart(at: Date, start: Date): number {
  const diff = at.getTime() - start.getTime();
  if (diff > 0) return Math.max(1, Math.round(diff / MINUTE_MS));
  return Math.round(diff / MINUTE_MS) || 0;
}

const fullName = (m: SummaryMemberInput) =>
  [m.name, m.fatherName].filter(Boolean).join(' ');

const pct = (part: number, whole: number) =>
  whole ? Math.round((part / whole) * 100) : 0;

/** Median instant of sorted times (mean of the middle two for an even count). */
export function medianTime(sorted: Date[]): Date | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return new Date((sorted[mid - 1].getTime() + sorted[mid].getTime()) / 2);
}

/**
 * Check-ins per 5 minutes, from the window opening (or the first check-in,
 * if earlier) to the last check-in. Buckets are aligned on the start time and
 * include their end, so a check-in exactly at the start is in an on-time bar.
 */
export function bucketCheckIns(
  times: Date[],
  start: Date,
  opensAt: Date,
  hasStartTime: boolean,
): SummaryBucket[] {
  if (times.length === 0) return [];
  const first = Math.min(...times.map((d) => d.getTime()));
  const last = Math.max(...times.map((d) => d.getTime()));
  // Without a start time the "window" is the whole day: start at the first
  // check-in instead of midnight.
  const from = hasStartTime ? Math.min(opensAt.getTime(), first) : first;
  const s = start.getTime();
  // Bucket i is (origin + i·5min, origin + (i+1)·5min].
  const origin = s - Math.ceil((s - from) / BUCKET_MS) * BUCKET_MS;
  const index = (t: number) => Math.max(0, Math.ceil((t - origin) / BUCKET_MS) - 1);
  const count = index(last) + 1;
  const buckets: SummaryBucket[] = Array.from({ length: count }, (_, i) => {
    const a = origin + i * BUCKET_MS;
    const b = a + BUCKET_MS;
    return {
      from: new Date(a).toISOString(),
      to: new Date(b).toISOString(),
      count: 0,
      onTime: b <= s,
    };
  });
  for (const d of times) buckets[index(d.getTime())].count += 1;
  return buckets;
}

const STATUS_ORDER: Record<SummaryStatus, number> = {
  on_time: 0,
  late: 0,
  no_time: 1,
  absent: 2,
};

export function computeEventSummary(
  event: SummaryEventInput,
  members: SummaryMemberInput[],
  rows: SummaryRowInput[],
): EventSummary {
  const start = eventStartAt(event);
  const { opensAt } = checkInWindow(event);
  const rowByMember = new Map(rows.map((r) => [r.key, r]));

  const records: SummaryRecord[] = members.map((m) => {
    const row = rowByMember.get(m.key);
    const base = {
      key: m.key,
      kind: m.kind,
      memberId: m.code,
      name: fullName(m),
      tapped: row?.status ?? null,
      method: row?.method ?? null,
    };
    if (!row || row.status === 'absent') {
      return {
        ...base,
        status: 'absent',
        tapMismatch: false,
        absentSource: !row
          ? 'none'
          : row.method === 'auto_close'
            ? 'auto'
            : 'marked',
        checkedInAt: null,
        minutesVsStart: null,
      };
    }
    if (!row.checkedInAt) {
      return {
        ...base,
        status: 'no_time',
        tapMismatch: false,
        absentSource: null,
        checkedInAt: null,
        minutesVsStart: null,
      };
    }
    const late = row.checkedInAt.getTime() > start.getTime();
    return {
      ...base,
      status: late ? 'late' : 'on_time',
      tapMismatch: late ? row.status !== 'late' : row.status !== 'present',
      absentSource: null,
      checkedInAt: row.checkedInAt.toISOString(),
      minutesVsStart: minutesVsStart(row.checkedInAt, start),
    };
  });

  // By check-in time, then attended without a time, then absent (by name).
  records.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.checkedInAt && b.checkedInAt
        ? a.checkedInAt.localeCompare(b.checkedInAt)
        : 0) ||
      a.name.localeCompare(b.name),
  );

  const timed = records.filter(
    (r): r is SummaryRecord & { checkedInAt: string } => r.checkedInAt !== null,
  );
  const onTime = records.filter((r) => r.status === 'on_time').length;
  const lateRecords = records.filter((r) => r.status === 'late');
  const noTime = records.filter((r) => r.status === 'no_time').length;
  const absentRecords = records.filter((r) => r.status === 'absent');
  const absentMarked = absentRecords.filter(
    (r) => r.absentSource === 'marked',
  ).length;
  const attended = onTime + lateRecords.length + noTime;

  const times = timed.map((r) => new Date(r.checkedInAt));
  const median = medianTime(times);
  const buckets = bucketCheckIns(times, start, opensAt, !!event.startTime);
  const busiest = buckets.reduce<SummaryBucket | null>(
    (best, b) => (b.count > (best?.count ?? 0) ? b : best),
    null,
  );

  const methods = { qr: 0, quick_id: 0, list: 0, unknown: 0 };
  const byVolunteer = new Map<string, { name: string; count: number }>();
  const listed = new Set(members.map((m) => m.key));
  for (const r of rows) {
    // Attended people on the list only (same people as the cards).
    if (r.status === 'absent' || !listed.has(r.key)) continue;
    if (r.method === 'qr' || r.method === 'quick_id' || r.method === 'list')
      methods[r.method] += 1;
    else methods.unknown += 1;
    const key = r.markedBy ?? '';
    const entry = byVolunteer.get(key) ?? {
      name: r.markedByName ?? '—',
      count: 0,
    };
    entry.count += 1;
    byVolunteer.set(key, entry);
  }

  const groups: SummaryGroup[] = (['member', 'pre_member'] as const)
    .map((kind) => {
      const list = records.filter((r) => r.kind === kind);
      const onTimeN = list.filter((r) => r.status === 'on_time').length;
      const lateN = list.filter((r) => r.status === 'late').length;
      const absentN = list.filter((r) => r.status === 'absent').length;
      const attendedN = list.length - absentN;
      return {
        kind,
        total: list.length,
        attended: attendedN,
        onTime: onTimeN,
        late: lateN,
        absent: absentN,
        attendedPct: pct(attendedN, list.length),
      };
    })
    .filter((g) => g.total > 0);

  const point = (r: SummaryRecord | undefined): SummaryPoint | null =>
    r?.checkedInAt ? { at: r.checkedInAt, name: r.name } : null;

  return {
    total: members.length,
    attended,
    onTime,
    late: lateRecords.length,
    noTime,
    absent: absentRecords.length,
    absentMarked,
    absentOnClose: absentRecords.length - absentMarked,
    onTimePct: pct(onTime, timed.length),
    attendedPct: pct(attended, members.length),
    avgLateMin: lateRecords.length
      ? Math.round(
          lateRecords.reduce((sum, r) => sum + (r.minutesVsStart ?? 0), 0) /
            lateRecords.length,
        )
      : null,
    startAt: start.toISOString(),
    opensAt: opensAt.toISOString(),
    first: point(timed[0]),
    last: point(timed[timed.length - 1]),
    median: median
      ? {
          at: median.toISOString(),
          minutesVsStart: Math.round(
            (median.getTime() - start.getTime()) / MINUTE_MS,
          ),
        }
      : null,
    busiest,
    buckets,
    methods,
    checkedInBy: [...byVolunteer.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    ),
    groups,
    records,
  };
}
