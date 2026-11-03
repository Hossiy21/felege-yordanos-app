/**
 * People on an event's list: the one rule behind the check-in screen (and its
 * refresh every few seconds) and the summary of a closed event. Pure: the
 * people come from lib/expected-people.ts.
 *
 * - Open event: who is expected now (lib/expected-people.ts) plus anyone who
 *   already has an attendance row, so the live counter and the list agree.
 * - Closed event: the attendance rows only. Closing writes a row for everyone
 *   expected at that moment, so the rows are the record: people added,
 *   promoted or withdrawn later do not change a closed event.
 *
 * The close itself (automatic absents) still uses only the expected people.
 */
import {
  audienceIncludes,
  personKey,
  type Audience,
  type ExpectedPerson,
  type PersonKind,
} from './audience';

/** Why someone with a row is not expected at the event any more. */
export type OffListReason =
  | 'now_member'
  | 'withdrawn'
  | 'inactive'
  | 'other_audience';

/** English tags (translated in the UI). */
export const OFF_LIST_LABEL: Record<OffListReason, string> = {
  now_member: 'Now a member',
  withdrawn: 'Withdrawn',
  inactive: 'Inactive',
  other_audience: 'Not for this event',
};

/** One person on an event's list. */
export interface ListedPerson extends ExpectedPerson {
  /** Set for people with a row who are not expected any more. */
  offList: OffListReason | null;
}

/** A person who has an attendance row at the event, as stored today. */
export interface RowPerson {
  kind: PersonKind;
  id: number;
  /** SSU member ID or FYP code. */
  code: string;
  name: string;
  fatherName: string;
  /** members.status ('Active', …) or pre_members.status ('active', …). */
  status: string | null;
}

/**
 * Null when this person would be expected at an event with this audience
 * (same rule as lib/expected-people.ts: active members, active pre-members).
 */
export function offListReason(
  person: Pick<RowPerson, 'kind' | 'status'>,
  audience: Audience,
): OffListReason | null {
  if (person.kind === 'member') {
    if (person.status !== 'Active') return 'inactive';
  } else if (person.status !== 'active') {
    if (person.status === 'promoted') return 'now_member';
    if (person.status === 'withdrawn') return 'withdrawn';
    return 'inactive';
  }
  return audienceIncludes(audience, person.kind) ? null : 'other_audience';
}

const byName = (a: ExpectedPerson, b: ExpectedPerson) =>
  a.name.localeCompare(b.name) || a.fatherName.localeCompare(b.fatherName);

/**
 * The list of an event, by name. `expected` is ignored for a closed event
 * (pass [] there); `withRows` are the people with an attendance row.
 */
export function eventPeople({
  audience,
  closed,
  expected,
  withRows,
}: {
  audience: Audience;
  closed: boolean;
  expected: ExpectedPerson[];
  withRows: RowPerson[];
}): ListedPerson[] {
  const list = new Map<string, ListedPerson>();
  if (!closed)
    for (const p of expected) list.set(p.key, { ...p, offList: null });
  for (const r of withRows) {
    const key = personKey(r.kind, r.id);
    if (list.has(key)) continue;
    list.set(key, {
      key,
      kind: r.kind,
      id: r.id,
      code: r.code,
      name: r.name,
      fatherName: r.fatherName,
      offList: offListReason(r, audience),
    });
  }
  return [...list.values()].sort(byName);
}

/** Present or late marks of the people on the list (the live counter). */
export function attendedOnList(
  list: { key: string }[],
  marks: Record<string, string | undefined>,
): number {
  let n = 0;
  for (const p of list) {
    const s = marks[p.key];
    if (s === 'present' || s === 'late') n += 1;
  }
  return n;
}
