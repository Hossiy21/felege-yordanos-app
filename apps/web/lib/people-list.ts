/**
 * Filters and sorting of the people list (/admin/people and its CSV), kept in
 * the URL. Pure: lib/people-queries.ts turns them into one SQL query.
 */
import type { PersonKind } from './audience';
import { parseYmdParam } from './person-attendance';

export const PEOPLE_SORTS = [
  'name',
  'code',
  'expected',
  'attended',
  'rate',
  'last_seen',
  'streak',
] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];

/** Active (default), no longer active (inactive member, withdrawn), or all. */
export const PEOPLE_STATUSES = ['active', 'inactive', 'all'] as const;
export type PeopleStatus = (typeof PEOPLE_STATUSES)[number];

export const PEOPLE_PAGE_SIZE = 50;

export interface PeopleFilters {
  type: PersonKind | null;
  status: PeopleStatus;
  /** Members' department (pre-members have none). */
  dept: number | null;
  /** Event date range, YYYY-MM-DD inclusive. */
  from: string | null;
  to: string | null;
  /** Rate below this percentage (1–100); people with nothing expected are left out. */
  rateBelow: number | null;
  /** Missed streak at least this many events. */
  streakMin: number | null;
  /** Not seen on or after this date (never seen included). */
  notSeenSince: string | null;
  /** Name or ID. */
  q: string;
  sort: PeopleSort;
  dir: 'asc' | 'desc';
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const one = (p: Params, key: string) => {
  const v = p[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
};

const intIn = (v: string, min: number, max: number) => {
  if (!/^\d{1,6}$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

/** Numbers sort high to low first, names and dates low to high. */
export const defaultDir = (sort: PeopleSort): 'asc' | 'desc' =>
  sort === 'name' || sort === 'code' || sort === 'last_seen' ? 'asc' : 'desc';

export function parsePeopleFilters(p: Params): PeopleFilters {
  const type = one(p, 'type');
  const status = one(p, 'status');
  const sortParam = one(p, 'sort');
  const sort = (PEOPLE_SORTS as readonly string[]).includes(sortParam)
    ? (sortParam as PeopleSort)
    : 'name';
  const dir = one(p, 'dir');
  return {
    type: type === 'member' || type === 'pre_member' ? type : null,
    status: (PEOPLE_STATUSES as readonly string[]).includes(status)
      ? (status as PeopleStatus)
      : 'active',
    dept: intIn(one(p, 'dept'), 1, 9999),
    from: parseYmdParam(one(p, 'from')),
    to: parseYmdParam(one(p, 'to')),
    rateBelow: intIn(one(p, 'rate_below'), 1, 100),
    streakMin: intIn(one(p, 'streak_min'), 1, 999),
    notSeenSince: parseYmdParam(one(p, 'not_seen_since')),
    q: one(p, 'q').slice(0, 100),
    sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : defaultDir(sort),
    page: intIn(one(p, 'page'), 1, 100000) ?? 1,
  };
}

/** URL query of the filters (defaults left out), for links and the CSV. */
export function peopleQuery(
  f: PeopleFilters,
  change: Partial<PeopleFilters> = {},
): string {
  const v = { ...f, ...change };
  const q = new URLSearchParams();
  if (v.type) q.set('type', v.type);
  if (v.status !== 'active') q.set('status', v.status);
  if (v.dept) q.set('dept', String(v.dept));
  if (v.from) q.set('from', v.from);
  if (v.to) q.set('to', v.to);
  if (v.rateBelow) q.set('rate_below', String(v.rateBelow));
  if (v.streakMin) q.set('streak_min', String(v.streakMin));
  if (v.notSeenSince) q.set('not_seen_since', v.notSeenSince);
  if (v.q) q.set('q', v.q);
  if (v.sort !== 'name') q.set('sort', v.sort);
  if (v.dir !== defaultDir(v.sort)) q.set('dir', v.dir);
  if (v.page > 1) q.set('page', String(v.page));
  return q.toString();
}

/** One row of the list. */
export interface PeopleRow {
  kind: PersonKind;
  id: number;
  /** SSU member ID or FYP code. */
  code: string;
  name: string;
  fatherName: string;
  departmentId: number | null;
  /** members.status or pre_members.status. */
  status: string | null;
  active: boolean;
  expected: number;
  attended: number;
  ratePct: number | null;
  lastSeen: string | null;
  missedStreak: number;
}

/** Link to the person page. */
export const personHref = (r: Pick<PeopleRow, 'kind' | 'id'>) =>
  `/admin/people/${r.kind === 'member' ? 'm' : 'p'}/${r.id}`;
