/**
 * Who an event or notice is for (events.audience, notices.audience), and who
 * is expected at an event. Pure: lib/expected-people.ts loads the people,
 * lib/permissions.ts decides who may see what.
 */
import type { Audience } from '@felege-yordanos/db/schema';

export { AUDIENCES, type Audience } from '@felege-yordanos/db/schema';

/** The two kinds of people who check in. */
export type PersonKind = 'member' | 'pre_member';

/** English labels (translated in the UI). */
export const AUDIENCE_LABEL: Record<Audience, string> = {
  members: 'Members',
  pre_members: 'Pre-members',
  everyone: 'Everyone',
};

/**
 * Short tag on a card (events, notices) when it is not for members only.
 * "Everyone" alone would read like "every department".
 */
export const AUDIENCE_TAG: Record<Audience, string | null> = {
  members: null,
  pre_members: 'Pre-members',
  everyone: 'Members & pre-members',
};

export const audienceIncludes = (audience: Audience, kind: PersonKind) =>
  audience === 'everyone' ||
  (audience === 'members' ? kind === 'member' : kind === 'pre_member');

/** Kinds of people expected at an event with this audience. */
export const expectedKinds = (audience: Audience): PersonKind[] =>
  (['member', 'pre_member'] as const).filter((k) =>
    audienceIncludes(audience, k),
  );

/**
 * One person on a check-in list. `key` is unique across both kinds
 * ("m:12" for members.id 12, "p:3" for pre_members.id 3); `code` is the ID
 * shown and scanned (SSU member ID or FYP code).
 */
export interface ExpectedPerson {
  key: string;
  kind: PersonKind;
  id: number;
  code: string;
  name: string;
  fatherName: string;
}

export const personKey = (kind: PersonKind, id: number) =>
  `${kind === 'member' ? 'm' : 'p'}:${id}`;

export function parsePersonKey(
  key: string,
): { kind: PersonKind; id: number } | null {
  const m = /^([mp]):(\d{1,15})$/.exec(key);
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { kind: m[1] === 'm' ? 'member' : 'pre_member', id };
}

type PersonRow = { id: number; code: string; name: string; fatherName: string };

/**
 * The check-in list of an event: active members and/or active pre-members
 * (callers pass only active rows), by name. The one rule behind the
 * check-in screen, the close (auto absents) and the summary.
 */
export function expectedPeople(
  audience: Audience,
  members: PersonRow[],
  preMembers: PersonRow[],
): ExpectedPerson[] {
  const list: ExpectedPerson[] = [];
  const add = (kind: PersonKind, rows: PersonRow[]) => {
    if (!audienceIncludes(audience, kind)) return;
    for (const r of rows) list.push({ key: personKey(kind, r.id), kind, ...r });
  };
  add('member', members);
  add('pre_member', preMembers);
  return list.sort(
    (a, b) =>
      a.name.localeCompare(b.name) || a.fatherName.localeCompare(b.fatherName),
  );
}

/** Person key of an attendance row (exactly one of the two ids is set). */
export const attendanceRowKey = (r: {
  memberId: number | null;
  preMemberId: number | null;
}) =>
  r.memberId !== null
    ? personKey('member', r.memberId)
    : personKey('pre_member', r.preMemberId ?? 0);
