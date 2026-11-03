import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Audience } from './audience';
import { csvCell, toCsv } from './csv';
import { ethiopianPeriods } from './ethiopian-periods';
import { parsePeopleFilters, peopleQuery } from './people-list';
import {
  filterTimeline,
  parseTimelineFilters,
  personTimeline,
  personTotals,
  type PersonEventInput,
  type PersonRowInput,
} from './person-attendance';

// Sundays 15:30 EAT.
const ev = (
  date: string,
  opts: Partial<PersonEventInput> = {},
): PersonEventInput => ({
  id: `e-${date}`,
  title: 'Sunday class',
  eventDate: date,
  startTime: '15:30:00',
  departmentId: 2,
  recurrenceGroup: null,
  audience: 'members' as Audience,
  closed: true,
  ...opts,
});
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}+03:00`);

const row = (
  event: PersonEventInput,
  status: PersonRowInput['status'],
  opts: Partial<PersonRowInput> = {},
): PersonRowInput => ({
  event,
  on: 'member',
  status,
  checkedInAt:
    status === 'absent'
      ? null
      : at(event.eventDate, status === 'late' ? '15:42' : '15:20'),
  method: status === 'absent' ? 'auto_close' : 'qr',
  markedByName: 'Volunteer',
  ...opts,
});

describe('personTimeline / personTotals', () => {
  it('counts closed events only; open ones are "not marked"', () => {
    const closed = ev('2026-10-11');
    const openPast = ev('2026-10-18', { closed: false });
    const openWithMark = ev('2026-10-25', { closed: false });
    const entries = personTimeline({
      rows: [row(closed, 'present'), row(openWithMark, 'late')],
      openEvents: [openPast, openWithMark],
      promoted: false,
    });
    assert.deepEqual(
      entries.map((e) => [e.eventDate, e.status, e.closed]),
      [
        ['2026-10-25', 'late', false],
        ['2026-10-18', 'not_marked', false],
        ['2026-10-11', 'on_time', true],
      ],
    );
    const t = personTotals(entries);
    assert.equal(t.expected, 1);
    assert.equal(t.attended, 1);
    assert.equal(t.ratePct, 100);
    assert.equal(t.late, 0, 'a late check-in at an open event is not counted');
    assert.equal(t.notMarked, 1);
    assert.equal(t.missedStreak, 0);
    // Seen at the open event.
    assert.equal(t.lastSeen, '2026-10-25');
  });

  it('a closed event without a row was not expected (approved later)', () => {
    // The person has rows only from Oct 18; the Oct 11 event is closed but
    // they were not expected then, so it never reaches the timeline.
    const entries = personTimeline({
      rows: [row(ev('2026-10-18'), 'absent'), row(ev('2026-10-25'), 'present')],
      openEvents: [ev('2026-10-11')],
      promoted: false,
    });
    assert.equal(entries.length, 2);
    const t = personTotals(entries);
    assert.equal(t.expected, 2);
    assert.equal(t.attended, 1);
    assert.equal(t.ratePct, 50);
    assert.equal(t.absent, 1);
    assert.equal(t.absentOnClose, 1);
  });

  it('one timeline after a promotion; an event with two rows counts once', () => {
    const before = ev('2026-10-04', { audience: 'pre_members' });
    // "Everyone" event: checked in as a pre-member, promoted, then closed
    // (the close added an automatic absent on the member row).
    const both = ev('2026-11-01', { audience: 'everyone' });
    const after = ev('2026-11-08');
    const entries = personTimeline({
      rows: [
        row(before, 'present', { on: 'pre_member' }),
        row(both, 'present', { on: 'pre_member' }),
        row(both, 'absent'),
        row(after, 'absent', { method: 'list' }),
      ],
      openEvents: [],
      promoted: true,
    });
    assert.deepEqual(
      entries.map((e) => [e.eventDate, e.status, e.beforeMembership]),
      [
        ['2026-11-08', 'absent', false],
        ['2026-11-01', 'on_time', true],
        ['2026-10-04', 'on_time', true],
      ],
    );
    const t = personTotals(entries);
    assert.equal(t.expected, 3);
    assert.equal(t.attended, 2);
    assert.equal(t.absentMarked, 1);
    assert.equal(t.missedStreak, 1);
  });

  it('lists member rows first, then the "before membership" section', () => {
    const entries = personTimeline({
      rows: [
        row(ev('2026-10-25'), 'absent', { on: 'pre_member' }),
        row(ev('2026-10-18'), 'present'),
        row(ev('2026-10-11'), 'absent', { on: 'pre_member' }),
        row(ev('2026-10-04'), 'absent'),
      ],
      openEvents: [],
      promoted: true,
    });
    assert.deepEqual(
      entries.map((e) => [e.eventDate, e.beforeMembership]),
      [
        ['2026-10-18', false],
        ['2026-10-04', false],
        ['2026-10-25', true],
        ['2026-10-11', true],
      ],
    );
    // Streak and last seen still go by date across both sections.
    const t = personTotals(entries);
    assert.equal(t.missedStreak, 1);
    assert.equal(t.lastSeen, '2026-10-18');
  });

  it('prefers a marked absent over the close and the member row on a tie', () => {
    const e = ev('2026-11-01', { audience: 'everyone' });
    const [entry] = personTimeline({
      rows: [
        row(e, 'absent', { on: 'pre_member' }),
        row(e, 'absent', { method: 'list', on: 'pre_member' }),
      ],
      openEvents: [],
      promoted: true,
    });
    assert.equal(entry.absentSource, 'marked');
  });

  it('a present resets the missed streak', () => {
    const entries = personTimeline({
      rows: [
        row(ev('2026-10-04'), 'absent'),
        row(ev('2026-10-11'), 'absent'),
        row(ev('2026-10-18'), 'present'),
        row(ev('2026-10-25'), 'absent'),
        row(ev('2026-11-01'), 'absent', { method: 'list' }),
      ],
      // An open event in between does not break or extend the streak.
      openEvents: [ev('2026-11-02', { closed: false })],
      promoted: false,
    });
    const t = personTotals(entries);
    assert.equal(t.missedStreak, 2);
    assert.equal(t.lastSeen, '2026-10-18');
    assert.equal(t.notMarked, 1);
  });

  it('rows without a time count as attended, out of time numbers', () => {
    const entries = personTimeline({
      rows: [
        row(ev('2026-10-04'), 'present', { checkedInAt: null, method: null }),
        row(ev('2026-10-11'), 'late', { checkedInAt: null, method: null }),
        row(ev('2026-10-18'), 'late'),
        // Tapped L but arrived before the start: on time.
        row(ev('2026-10-25'), 'late', { checkedInAt: at('2026-10-25', '15:30') }),
      ],
      openEvents: [],
      promoted: false,
    });
    const t = personTotals(entries);
    assert.equal(t.attended, 4);
    assert.equal(t.noTime, 2);
    assert.equal(t.onTime, 1);
    assert.equal(t.late, 1);
    assert.equal(t.avgLateMin, 12);
    assert.equal(
      entries.find((e) => e.eventDate === '2026-10-18')?.minutesVsStart,
      12,
    );
  });

  it('empty history', () => {
    const t = personTotals(
      personTimeline({ rows: [], openEvents: [], promoted: false }),
    );
    assert.deepEqual(t, {
      expected: 0,
      attended: 0,
      ratePct: null,
      onTime: 0,
      late: 0,
      noTime: 0,
      avgLateMin: null,
      absent: 0,
      absentMarked: 0,
      absentOnClose: 0,
      notMarked: 0,
      lastSeen: null,
      missedStreak: 0,
    });
  });
});

describe('timeline filters', () => {
  const series = '0b6c2f2e-8f0b-4c39-9a51-3f7f0d6c1a11';
  const entries = personTimeline({
    rows: [
      row(ev('2026-09-20', { recurrenceGroup: series }), 'present'),
      row(ev('2026-10-04', { recurrenceGroup: series }), 'absent'),
      row(ev('2026-10-11', { departmentId: null, title: 'Choir' }), 'late'),
      row(ev('2026-10-18', { audience: 'everyone' }), 'present', {
        method: 'list',
      }),
    ],
    openEvents: [],
    promoted: false,
  });

  it('parses the URL and ignores invalid values', () => {
    const f = parseTimelineFilters({
      from: '2026-10-01',
      to: '2026-02-30',
      dept: 'general',
      series: series.toUpperCase(),
      audience: 'staff',
      status: 'absent',
      method: 'qr',
      q: '  choir ',
    });
    assert.deepEqual(f, {
      from: '2026-10-01',
      to: null,
      dept: 'general',
      series,
      audience: null,
      status: 'absent',
      method: 'qr',
      q: 'choir',
    });
  });

  it('totals cover the period; status and method only filter the table', () => {
    const f = parseTimelineFilters({ from: '2026-10-01', status: 'absent' });
    const { totals, shown } = filterTimeline(entries, f);
    assert.equal(totals.expected, 3);
    assert.equal(totals.attended, 2);
    assert.deepEqual(
      shown.map((e) => e.eventDate),
      ['2026-10-04'],
    );
  });

  it('filters by department, series, audience, title and method', () => {
    const dates = (p: Record<string, string>) =>
      filterTimeline(entries, parseTimelineFilters(p)).shown.map(
        (e) => e.eventDate,
      );
    assert.deepEqual(dates({ dept: 'general' }), ['2026-10-11']);
    assert.deepEqual(dates({ dept: '2', series }), ['2026-10-04', '2026-09-20']);
    assert.deepEqual(dates({ audience: 'everyone' }), ['2026-10-18']);
    assert.deepEqual(dates({ q: 'CHOIR' }), ['2026-10-11']);
    assert.deepEqual(dates({ method: 'list' }), ['2026-10-18']);
    assert.deepEqual(dates({ status: 'attended' }), [
      '2026-10-18',
      '2026-10-11',
      '2026-09-20',
    ]);
  });
});

describe('ethiopianPeriods', () => {
  it('gives this and last Ethiopian year, then the months, newest first', () => {
    // 3 Nov 2026 = 24 Tikimt 2019.
    const p = ethiopianPeriods('2026-11-03', 3);
    assert.deepEqual(
      p.map((x) => [x.key, x.from, x.to]),
      [
        // 2019 has a 6-day Pagume.
        ['y2019', '2026-09-11', '2027-09-11'],
        ['y2018', '2025-09-11', '2026-09-10'],
        ['m2019-02', '2026-10-11', '2026-11-09'],
        ['m2019-01', '2026-09-11', '2026-10-10'],
        ['m2018-13', '2026-09-06', '2026-09-10'],
      ],
    );
  });
});

describe('people list filters', () => {
  it('parses, defaults and round-trips the URL', () => {
    const f = parsePeopleFilters({
      type: 'pre_member',
      status: 'inactive',
      rate_below: '60',
      streak_min: '0',
      not_seen_since: '2026-10-01',
      sort: 'last_seen',
      page: '2',
    });
    assert.equal(f.type, 'pre_member');
    assert.equal(f.status, 'inactive');
    assert.equal(f.rateBelow, 60);
    assert.equal(f.streakMin, null);
    assert.equal(f.dir, 'asc');
    assert.equal(
      peopleQuery(f),
      'type=pre_member&status=inactive&rate_below=60&not_seen_since=2026-10-01&sort=last_seen&page=2',
    );
    assert.deepEqual(parsePeopleFilters({ sort: 'evil', dir: 'x' }).sort, 'name');
  });
});

describe('csv', () => {
  it('quotes and neutralises formulas', () => {
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell('-5'), "'-5");
    assert.equal(csvCell(-5), '-5');
    assert.equal(csvCell(null), '');
    assert.equal(toCsv([['a', 1], ['ሰላም', null]]), '﻿a,1\r\nሰላም,');
  });
});
