import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bucketCheckIns,
  computeEventSummary,
  medianTime,
  minutesVsStart,
  type SummaryRowInput,
} from './event-summary';

// Sunday 15:30 EAT = 12:30 UTC; check-in opens 20 min before (15:10 EAT).
const event = {
  eventDate: '2026-10-11',
  startTime: '15:30:00',
  checkInOpensBeforeMin: 20,
  checkInClosesAfterMin: 20,
};
/** An instant at HH:MM(:SS) EAT on the event day. */
const eat = (hhmm: string) => new Date(`2026-10-11T${hhmm}+03:00`);

const members = [1, 2, 3, 4, 5, 6].map((id) => ({
  key: `m:${id}`,
  kind: 'member' as const,
  code: `ssu/01/03/05/0000${id}`,
  name: `Name${id}`,
  fatherName: 'Father',
}));

const row = (
  memberId: number,
  status: SummaryRowInput['status'],
  at: string | null,
  method: SummaryRowInput['method'] = 'qr',
  by = 'v1',
): SummaryRowInput => ({
  key: `m:${memberId}`,
  status,
  checkedInAt: at ? eat(at) : null,
  method,
  markedBy: by,
  markedByName: by === 'v1' ? 'Volunteer One' : 'Volunteer Two',
});

describe('computeEventSummary', () => {
  it('splits on time and late by the recorded time, not the tap', () => {
    const s = computeEventSummary(event, members, [
      row(1, 'present', '15:20'), // on time
      row(2, 'present', '15:30'), // exactly at start: on time
      row(3, 'present', '15:37'), // tapped P but late by time
      row(4, 'late', '15:25', 'list', 'v2'), // tapped L but on time
      row(5, 'absent', null, 'list'),
      row(6, 'absent', null, 'auto_close'),
    ]);
    assert.equal(s.total, 6);
    assert.equal(s.attended, 4);
    assert.equal(s.onTime, 3);
    assert.equal(s.late, 1);
    assert.equal(s.absent, 2);
    assert.equal(s.absentMarked, 1);
    assert.equal(s.absentOnClose, 1);
    assert.equal(s.onTimePct, 75);
    assert.equal(s.attendedPct, 67);
    assert.equal(s.avgLateMin, 7);

    const byId = new Map(s.records.map((r) => [Number(r.key.slice(2)), r]));
    assert.equal(byId.get(2)?.status, 'on_time');
    assert.equal(byId.get(2)?.minutesVsStart, 0);
    assert.equal(byId.get(3)?.status, 'late');
    assert.equal(byId.get(3)?.tapMismatch, true);
    assert.equal(byId.get(4)?.status, 'on_time');
    assert.equal(byId.get(4)?.tapMismatch, true);
    assert.equal(byId.get(1)?.tapMismatch, false);
    assert.equal(byId.get(1)?.minutesVsStart, -10);
    assert.equal(byId.get(6)?.absentSource, 'auto');
    assert.equal(byId.get(5)?.absentSource, 'marked');
  });

  it('sorts by check-in time, then absent members', () => {
    const s = computeEventSummary(event, members, [
      row(3, 'present', '15:37'),
      row(1, 'present', '15:20'),
      row(5, 'absent', null),
      row(2, 'present', '15:30'),
    ]);
    assert.deepEqual(
      s.records.map((r) => r.key),
      ['m:1', 'm:2', 'm:3', 'm:4', 'm:5', 'm:6'],
    );
    assert.equal(s.first?.name, 'Name1 Father');
    assert.equal(s.last?.name, 'Name3 Father');
  });

  it('counts legacy rows without a time as attended, outside time numbers', () => {
    const s = computeEventSummary(event, members, [
      row(1, 'present', null, null),
      row(2, 'late', null, null),
      row(3, 'present', '15:40'),
    ]);
    assert.equal(s.attended, 3);
    assert.equal(s.noTime, 2);
    assert.equal(s.onTime, 0);
    assert.equal(s.late, 1);
    assert.equal(s.onTimePct, 0);
    assert.equal(s.median?.minutesVsStart, 10);
    assert.equal(s.methods.unknown, 2);
    assert.equal(s.methods.qr, 1);
    // Members without any row count as absent (no source).
    assert.equal(s.absent, 3);
    assert.equal(s.absentOnClose, 3);
    assert.equal(s.records.find((r) => r.key === 'm:4')?.absentSource, 'none');
    assert.deepEqual(
      s.records.map((r) => r.status),
      ['late', 'no_time', 'no_time', 'absent', 'absent', 'absent'],
    );
  });

  it('counts methods and volunteers for attended members only', () => {
    const s = computeEventSummary(event, members, [
      row(1, 'present', '15:20', 'qr'),
      row(2, 'present', '15:21', 'quick_id', 'v2'),
      row(3, 'late', '15:40', 'list', 'v2'),
      row(4, 'absent', null, 'list'),
      row(99, 'present', '15:22', 'qr'), // not on the member list
    ]);
    assert.deepEqual(s.methods, { qr: 1, quick_id: 1, list: 1, unknown: 0 });
    assert.deepEqual(s.checkedInBy, [
      { name: 'Volunteer Two', count: 2 },
      { name: 'Volunteer One', count: 1 },
    ]);
  });

  it('handles an empty event', () => {
    const s = computeEventSummary(event, members, []);
    assert.equal(s.attended, 0);
    assert.equal(s.absent, 6);
    assert.equal(s.onTimePct, 0);
    assert.equal(s.attendedPct, 0);
    assert.equal(s.avgLateMin, null);
    assert.equal(s.first, null);
    assert.equal(s.median, null);
    assert.equal(s.busiest, null);
    assert.deepEqual(s.buckets, []);

    const none = computeEventSummary(event, [], []);
    assert.equal(none.total, 0);
    assert.equal(none.attendedPct, 0);
  });
});

describe('members and pre-members', () => {
  it('counts each kind apart, keys never collide', () => {
    const pre = [1, 2].map((id) => ({
      key: `p:${id}`,
      kind: 'pre_member' as const,
      code: `FYP-2019-000${id}`,
      name: `Pre${id}`,
      fatherName: 'Father',
    }));
    const s = computeEventSummary(
      event,
      [...members.slice(0, 2), ...pre],
      [
        row(1, 'present', '15:20'),
        { ...row(1, 'present', '15:40'), key: 'p:1' },
        { ...row(2, 'absent', null, 'auto_close'), key: 'p:2' },
      ],
    );
    assert.equal(s.total, 4);
    assert.equal(s.attended, 2);
    assert.deepEqual(
      s.groups.map((g) => [g.kind, g.total, g.attended, g.late, g.absent]),
      [
        ['member', 2, 1, 0, 1],
        ['pre_member', 2, 1, 1, 1],
      ],
    );
    assert.equal(s.records.find((r) => r.key === 'p:1')?.memberId, 'FYP-2019-0001');
  });

  it('has one group for a members-only event', () => {
    const s = computeEventSummary(event, members, []);
    assert.deepEqual(
      s.groups.map((g) => g.kind),
      ['member'],
    );
  });
});

describe('medianTime', () => {
  it('takes the middle value, or the mean of the middle two', () => {
    assert.equal(medianTime([]), null);
    assert.deepEqual(
      medianTime([eat('15:20'), eat('15:25'), eat('15:40')]),
      eat('15:25'),
    );
    assert.deepEqual(
      medianTime([eat('15:20'), eat('15:24'), eat('15:26'), eat('15:40')]),
      eat('15:25'),
    );
  });
});

describe('minutesVsStart', () => {
  it('is never +0 for a late check-in', () => {
    const start = eat('15:30');
    assert.equal(minutesVsStart(eat('15:30:10'), start), 1);
    assert.equal(minutesVsStart(eat('15:30'), start), 0);
    assert.equal(minutesVsStart(eat('15:17'), start), -13);
    assert.equal(minutesVsStart(eat('15:37'), start), 7);
  });
});

describe('bucketCheckIns', () => {
  const start = eat('15:30');
  const opens = eat('15:10');

  it('runs from the window opening to the last check-in in 5-minute bars', () => {
    const b = bucketCheckIns(
      [eat('15:12'), eat('15:26'), eat('15:28'), eat('15:30'), eat('15:31')],
      start,
      opens,
      true,
    );
    // (15:10,15:15] … (15:30,15:35]
    assert.equal(b.length, 5);
    assert.equal(b[0].from, opens.toISOString());
    assert.deepEqual(
      b.map((x) => x.count),
      [1, 0, 0, 3, 1],
    );
    // Exactly at the start is in the last on-time bar.
    assert.deepEqual(
      b.map((x) => x.onTime),
      [true, true, true, true, false],
    );
  });

  it('starts at the first check-in when it is before the window opens', () => {
    const b = bucketCheckIns([eat('15:02'), eat('15:29')], start, opens, true);
    assert.equal(b[0].from, eat('15:00').toISOString());
    assert.equal(b.length, 6);
  });

  it('finds the busiest 5 minutes (first one on a tie)', () => {
    const s = computeEventSummary(event, members, [
      row(1, 'present', '15:16'),
      row(2, 'present', '15:17'),
      row(3, 'present', '15:26'),
      row(4, 'present', '15:27'),
      row(5, 'present', '15:28'),
    ]);
    assert.equal(s.busiest?.count, 3);
    assert.equal(s.busiest?.from, eat('15:25').toISOString());
    assert.equal(s.busiest?.to, eat('15:30').toISOString());
  });
});
