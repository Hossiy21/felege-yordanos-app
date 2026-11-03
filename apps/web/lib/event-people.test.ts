import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expectedPeople,
  personKey,
  type Audience,
  type PersonKind,
} from './audience';
import {
  attendedOnList,
  eventPeople,
  offListReason,
  type RowPerson,
} from './event-people';
import { computeEventSummary, type SummaryRowInput } from './event-summary';

// Sunday 15:30 EAT; check-in opens 20 min before.
const event = {
  eventDate: '2026-11-01',
  startTime: '15:30:00',
  checkInOpensBeforeMin: 20,
  checkInClosesAfterMin: 20,
};
const eat = (hhmm: string) => new Date(`2026-11-01T${hhmm}+03:00`);

/**
 * A small stand-in for the database: people (members.status 'Active' …,
 * pre_members.status 'active' …) and one event's attendance rows. close()
 * and reopen() do what insertAutoAbsents and reopenEvent do in SQL.
 */
function world(audience: Audience) {
  const people = new Map<string, RowPerson>();
  const rows = new Map<string, SummaryRowInput>();
  const add = (kind: PersonKind, id: number, status: string) =>
    people.set(personKey(kind, id), {
      kind,
      id,
      code: kind === 'member' ? `ssu/01/${id}` : `FYP-2019-000${id}`,
      name: `${kind === 'member' ? 'M' : 'P'}${id}`,
      fatherName: 'Father',
      status,
    });
  const setStatus = (kind: PersonKind, id: number, status: string) => {
    const p = people.get(personKey(kind, id));
    if (p) p.status = status;
  };
  const expected = () => {
    const active = (kind: PersonKind, status: string) =>
      [...people.values()].filter((p) => p.kind === kind && p.status === status);
    return expectedPeople(
      audience,
      active('member', 'Active'),
      active('pre_member', 'active'),
    );
  };
  const mark = (
    kind: PersonKind,
    id: number,
    status: SummaryRowInput['status'],
    at: string | null = null,
  ) => {
    const key = personKey(kind, id);
    rows.set(key, {
      key,
      status,
      checkedInAt: at ? eat(at) : null,
      method: 'list',
      markedBy: 'v1',
      markedByName: 'Volunteer',
    });
  };
  const close = () => {
    for (const p of expected())
      if (!rows.has(p.key))
        rows.set(p.key, {
          key: p.key,
          status: 'absent',
          checkedInAt: null,
          method: 'auto_close',
          markedBy: 'admin',
          markedByName: 'Admin',
        });
  };
  const reopen = () => {
    for (const [key, r] of rows) if (r.method === 'auto_close') rows.delete(key);
  };
  const withRows = () =>
    [...rows.keys()].map((key) => {
      const p = people.get(key);
      if (!p) throw new Error(`no person ${key}`);
      return { ...p };
    });
  const list = (closed: boolean) =>
    eventPeople({
      audience,
      closed,
      expected: closed ? [] : expected(),
      withRows: withRows(),
    });
  const summary = () => computeEventSummary(event, list(true), [...rows.values()]);
  const marks = () =>
    Object.fromEntries([...rows].map(([key, r]) => [key, r.status]));
  return { add, setStatus, mark, close, reopen, list, summary, marks, rows };
}

describe('offListReason', () => {
  it('is null for people who would be expected', () => {
    assert.equal(offListReason({ kind: 'member', status: 'Active' }, 'members'), null);
    assert.equal(offListReason({ kind: 'pre_member', status: 'active' }, 'everyone'), null);
  });

  it('says why someone is not expected any more', () => {
    assert.equal(offListReason({ kind: 'pre_member', status: 'promoted' }, 'pre_members'), 'now_member');
    assert.equal(offListReason({ kind: 'pre_member', status: 'withdrawn' }, 'everyone'), 'withdrawn');
    assert.equal(offListReason({ kind: 'member', status: 'Inactive' }, 'members'), 'inactive');
    assert.equal(offListReason({ kind: 'member', status: null }, 'members'), 'inactive');
    assert.equal(offListReason({ kind: 'member', status: 'Active' }, 'pre_members'), 'other_audience');
  });
});

describe('eventPeople: closed event', () => {
  it('uses the rows only: later additions, promotions and withdrawals change nothing', () => {
    const w = world('everyone');
    w.add('member', 1, 'Active');
    w.add('member', 2, 'Active');
    for (const id of [1, 2, 3]) w.add('pre_member', id, 'active');
    w.mark('member', 1, 'present', '15:20');
    w.mark('pre_member', 1, 'present', '15:40');
    w.close();
    const before = w.summary();

    // After the close: three more pre-members approved, a new member from the
    // register, one pre-member promoted, one withdrawn, a member made inactive.
    for (const id of [4, 5, 6]) w.add('pre_member', id, 'active');
    w.add('member', 3, 'Active');
    w.setStatus('pre_member', 2, 'promoted');
    w.setStatus('pre_member', 3, 'withdrawn');
    w.setStatus('member', 2, 'Inactive');

    const s = w.summary();
    assert.equal(s.total, 5);
    assert.equal(s.attended, 2);
    assert.equal(s.absent, 3);
    assert.equal(s.absentOnClose, 3);
    assert.equal(
      s.records.filter((r) => r.absentSource === 'none').length,
      0,
      'no phantom absents',
    );
    assert.deepEqual(
      s.groups.map((g) => [g.kind, g.attended, g.total]),
      [
        ['member', 1, 2],
        ['pre_member', 1, 3],
      ],
    );
    // Same numbers as right after the close.
    assert.equal(s.total, before.total);
    assert.deepEqual(s.groups, before.groups);

    // Shown as they were, tagged with what changed.
    const byKey = new Map(s.records.map((r) => [r.key, r]));
    assert.equal(byKey.get('p:2')?.kind, 'pre_member');
    assert.equal(byKey.get('p:2')?.memberId, 'FYP-2019-0002');
    assert.equal(byKey.get('p:2')?.offList, 'now_member');
    assert.equal(byKey.get('p:3')?.offList, 'withdrawn');
    assert.equal(byKey.get('m:2')?.offList, 'inactive');
    assert.equal(byKey.get('m:1')?.offList, null);
    assert.equal(byKey.has('p:4'), false);
    assert.equal(byKey.has('m:3'), false);
  });

  it('ignores the expected people it is given', () => {
    const list = eventPeople({
      audience: 'members',
      closed: true,
      expected: [
        { key: 'm:9', kind: 'member', id: 9, code: 'x', name: 'X', fatherName: '' },
      ],
      withRows: [],
    });
    assert.deepEqual(list, []);
  });
});

describe('eventPeople: open event', () => {
  it('keeps a promoted pre-member with a row on the list, so the counter matches it', () => {
    const w = world('pre_members');
    for (const id of [1, 2, 3, 4, 5, 6]) w.add('pre_member', id, 'active');
    w.mark('pre_member', 6, 'present', '15:25');
    w.mark('pre_member', 1, 'late', '15:45');
    w.setStatus('pre_member', 6, 'promoted');

    const list = w.list(false);
    assert.equal(list.length, 6);
    assert.equal(list.find((p) => p.key === 'p:6')?.offList, 'now_member');
    assert.equal(list.filter((p) => p.offList === null).length, 5);
    // Counter = present/late among the people listed = every attended row.
    const attendedRows = [...w.rows.values()].filter((r) => r.status !== 'absent');
    assert.equal(attendedOnList(list, w.marks()), 2);
    assert.equal(attendedOnList(list, w.marks()), attendedRows.length);

    // Closing marks only the expected people absent; the summary matches
    // what the screen showed.
    w.close();
    assert.equal(w.rows.size, 6);
    const s = w.summary();
    assert.equal(s.total, list.length);
    assert.equal(s.attended, 2);
    assert.equal(s.absentOnClose, 4);
    assert.equal(s.records.find((r) => r.key === 'p:6')?.offList, 'now_member');
  });

  it('drops a tagged person whose mark was cleared, and the close does not add them', () => {
    const w = world('pre_members');
    for (const id of [1, 2]) w.add('pre_member', id, 'active');
    w.mark('pre_member', 2, 'present', '15:25');
    w.setStatus('pre_member', 2, 'withdrawn');
    assert.equal(w.list(false).length, 2);

    w.rows.delete('p:2');
    assert.deepEqual(w.list(false).map((p) => p.key), ['p:1']);
    w.close();
    assert.deepEqual([...w.rows.keys()], ['p:1']);
    assert.equal(w.summary().total, 1);
  });

  it('lists a person once when they are expected and have a row', () => {
    const w = world('members');
    w.add('member', 1, 'Active');
    w.mark('member', 1, 'present', '15:20');
    const list = w.list(false);
    assert.equal(list.length, 1);
    assert.equal(list[0].offList, null);
  });

  it('sorts by name', () => {
    const list = eventPeople({
      audience: 'everyone',
      closed: false,
      expected: [
        { key: 'm:1', kind: 'member', id: 1, code: 'a', name: 'Selam', fatherName: 'B' },
      ],
      withRows: [
        { kind: 'pre_member', id: 2, code: 'b', name: 'Abel', fatherName: 'C', status: 'promoted' },
      ],
    });
    assert.deepEqual(list.map((p) => p.name), ['Abel', 'Selam']);
  });
});

describe('reopen and close again', () => {
  it('removes only the automatic absents, then the next close uses who is expected then', () => {
    const w = world('pre_members');
    for (const id of [1, 2, 3]) w.add('pre_member', id, 'active');
    w.mark('pre_member', 1, 'present', '15:20');
    w.mark('pre_member', 3, 'absent');
    w.close();
    assert.equal(w.summary().total, 3);

    w.reopen();
    assert.deepEqual([...w.rows.keys()].sort(), ['p:1', 'p:3']);
    // While open again: one more approved, p:2 arrives late.
    w.add('pre_member', 4, 'active');
    w.mark('pre_member', 2, 'present', '15:50');
    assert.equal(w.list(false).length, 4);

    w.close();
    const s = w.summary();
    assert.equal(s.total, 4);
    assert.equal(s.attended, 2);
    assert.equal(s.late, 1);
    assert.equal(s.absentMarked, 1);
    assert.equal(s.absentOnClose, 1);
    assert.equal(s.records.find((r) => r.key === 'p:4')?.absentSource, 'auto');
  });
});
