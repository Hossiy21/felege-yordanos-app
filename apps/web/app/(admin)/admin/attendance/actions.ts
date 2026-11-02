'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  attendance,
  ATTENDANCE_STATUSES,
  AUDIENCES,
  db,
  events,
  preMembers,
  RECURRENCES,
} from '@felege-yordanos/db/server';
import {
  attendanceRowKey,
  audienceIncludes,
  parsePersonKey,
} from '@/lib/audience';
import { insertAutoAbsents } from '@/lib/expected-people';
import { parsePreMemberCode } from '@/lib/pre-members';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import {
  generateOccurrences,
  maxRecurrenceUntil,
  type Recurrence,
} from '@/lib/events';
import {
  CHECK_IN_DEFAULT_MIN,
  CHECK_IN_MAX_MIN,
  checkInState,
  checkInWindow,
} from '@/lib/check-in-window';
import {
  canCheckInNow,
  canCloseEvent,
  canCreateEvent,
  canEditEvent,
  canMarkAttendance,
  canReopenEvent,
  canViewEventAttendance,
} from '@/lib/permissions';
import { requireUser, type CurrentUser } from '@/lib/session';

/* ─── Validation ───────────────────────────────────────────── */

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;

const eventId = z.guid('Invalid event.');
const ymd = z.iso.date('Enter a valid date.');
const hhmm = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Enter a valid time.')
  .nullable();

const windowMinutes = z
  .number()
  .int('Enter whole minutes.')
  .min(0, 'Minutes cannot be negative.')
  .max(CHECK_IN_MAX_MIN, `At most ${CHECK_IN_MAX_MIN} minutes.`)
  .default(CHECK_IN_DEFAULT_MIN);

const eventFields = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(MAX_TITLE, `Title must be at most ${MAX_TITLE} characters.`),
  description: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPTION,
      `Description must be at most ${MAX_DESCRIPTION} characters.`,
    )
    .nullable()
    .transform((v) => (v ? v : null)),
  eventDate: ymd,
  startTime: hhmm,
  endTime: hhmm,
  departmentId: z.number().int().positive().nullable(),
  // Who the event is for (who is expected at check-in and on close).
  audience: z.enum(AUDIENCES).default('members'),
  // Check-in window around the start time, in minutes.
  checkInOpensBeforeMin: windowMinutes,
  checkInClosesAfterMin: windowMinutes,
});

export type EventInput = z.input<typeof eventFields>;

const createEventSchema = eventFields.extend({
  recurrence: z.enum(RECURRENCES).nullable(),
  until: ymd.nullable(),
});

export type CreateEventInput = z.input<typeof createEventSchema>;

const firstIssue = (error: z.ZodError, fallback: string) =>
  error.issues[0]?.message ?? fallback;

/* ─── Helpers ──────────────────────────────────────────────── */

const SAVE_FAILED = 'Could not save the event. Please try again.';

function revalidateAttendance() {
  revalidatePath('/admin/attendance');
  revalidatePath('/admin/attendance/[eventId]', 'page');
  revalidatePath('/admin/check-in');
  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

/** Postgres foreign key violation (e.g. unknown department or member). */
function isForeignKeyViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23503' || e?.cause?.code === '23503';
}

async function loadEvent(id: string) {
  const [row] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  return row ?? null;
}

/* ─── Events ───────────────────────────────────────────────── */

/**
 * Creates one event, or a recurring series (one row per occurrence sharing a
 * recurrence_group). Returns the number of rows created.
 * Permission: canCreateEvent(user, departmentId).
 */
export async function createEvent(
  input: CreateEventInput,
): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error, 'Invalid event.'));
  const { recurrence, until, ...fields } = parsed.data;

  if (!canCreateEvent(user, fields.departmentId)) return fail(NOT_ALLOWED);

  const base = { ...fields, createdBy: user.id };
  let rows: (typeof events.$inferInsert)[];

  if (!recurrence) {
    rows = [base];
  } else {
    if (!until) return fail('Choose when the series ends.');
    const cap = maxRecurrenceUntil(fields.eventDate);
    const boundedUntil = until > cap ? cap : until;
    const group = randomUUID();
    rows = generateOccurrences(fields.eventDate, recurrence, boundedUntil).map(
      (date) => ({
        ...base,
        eventDate: date,
        recurrenceGroup: group,
        recurrence,
        recurrenceUntil: boundedUntil,
      }),
    );
  }

  try {
    await db.insert(events).values(rows);
  } catch (err) {
    if (isForeignKeyViolation(err)) return fail('Unknown department.');
    console.error('[events] create failed:', err);
    return fail(SAVE_FAILED);
  }

  revalidateAttendance();
  return ok({ count: rows.length });
}

/**
 * Edits a single event (one occurrence of a series; recurrence fields are
 * left alone). Permission: canEditEvent(user, event) on the stored row.
 */
export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<ActionResult> {
  const user = await requireUser();

  const idParsed = eventId.safeParse(id);
  if (!idParsed.success) return fail('Event not found.');
  const parsed = eventFields.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error, 'Invalid event.'));

  const event = await loadEvent(idParsed.data);
  if (!event) return fail('Event not found.');
  if (!canEditEvent(user, event)) return fail(NOT_ALLOWED);

  try {
    await db.update(events).set(parsed.data).where(eq(events.id, event.id));
  } catch (err) {
    if (isForeignKeyViolation(err)) return fail('Unknown department.');
    console.error('[events] update failed:', err);
    return fail(SAVE_FAILED);
  }

  revalidateAttendance();
  return ok();
}

/**
 * Deletes a single event. Events that already have attendance are protected.
 * Permission: canEditEvent(user, event) on the stored row.
 */
export async function deleteEvent(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const idParsed = eventId.safeParse(id);
  if (!idParsed.success) return fail('Event not found.');

  const event = await loadEvent(idParsed.data);
  if (!event) return fail('Event not found.');
  if (!canEditEvent(user, event)) return fail(NOT_ALLOWED);

  try {
    const deleted = await db.transaction(async (tx) => {
      const [hasAttendance] = await tx
        .select({ id: attendance.id })
        .from(attendance)
        .where(eq(attendance.eventId, event.id))
        .limit(1);
      if (hasAttendance) return false;
      await tx.delete(events).where(eq(events.id, event.id));
      return true;
    });
    if (!deleted) return fail('This event already has attendance recorded.');
  } catch (err) {
    console.error('[events] delete failed:', err);
    return fail('Could not delete the event. Please try again.');
  }

  revalidateAttendance();
  return ok();
}

const seriesEndSchema = z.object({ eventId, until: ymd });

/**
 * Moves where a recurring series ends: adds missing occurrences up to the new
 * end (capped at 12 months from the series start) and removes occurrences
 * after it that have no attendance. Occurrences with attendance are kept.
 *
 * Permission: canEditEvent on EVERY existing row of the series, plus
 * canCreateEvent for the series' department when rows are added.
 */
export async function updateSeriesEnd(input: {
  eventId: string;
  until: string;
}): Promise<ActionResult<{ added: number; removed: number; kept: number }>> {
  const user = await requireUser();

  const parsed = seriesEndSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error, 'Invalid date.'));

  const event = await loadEvent(parsed.data.eventId);
  if (!event) return fail('Event not found.');
  if (!event.recurrenceGroup || !event.recurrence)
    return fail('This event is not part of a series.');
  const group = event.recurrenceGroup;
  const cadence: Recurrence = event.recurrence;

  try {
    const result = await db.transaction(async (tx) => {
      const series = await tx
        .select()
        .from(events)
        .where(eq(events.recurrenceGroup, group));
      if (!series.every((e) => canEditEvent(user, e))) return null;

      const start = series.reduce(
        (min, e) => (e.eventDate < min ? e.eventDate : min),
        series[0]?.eventDate ?? event.eventDate,
      );
      const cap = maxRecurrenceUntil(start);
      const boundedUntil = parsed.data.until > cap ? cap : parsed.data.until;

      const attendedRows = series.length
        ? await tx
            .selectDistinct({ eventId: attendance.eventId })
            .from(attendance)
            .where(
              inArray(
                attendance.eventId,
                series.map((e) => e.id),
              ),
            )
        : [];
      const attended = new Set(attendedRows.map((r) => r.eventId));

      const existing = new Set(series.map((e) => e.eventDate));
      const toInsert = generateOccurrences(start, cadence, boundedUntil).filter(
        (d) => !existing.has(d),
      );
      const after = series.filter((e) => e.eventDate > boundedUntil);
      const toDelete = after.filter((e) => !attended.has(e.id));
      const kept = after.length - toDelete.length;

      if (toInsert.length === 0 && toDelete.length === 0)
        return { added: 0, removed: 0, kept };

      if (toInsert.length > 0) {
        if (!canCreateEvent(user, event.departmentId)) return null;
        await tx.insert(events).values(
          toInsert.map((date) => ({
            title: event.title,
            description: event.description,
            eventDate: date,
            startTime: event.startTime,
            endTime: event.endTime,
            departmentId: event.departmentId,
            audience: event.audience,
            checkInOpensBeforeMin: event.checkInOpensBeforeMin,
            checkInClosesAfterMin: event.checkInClosesAfterMin,
            createdBy: user.id,
            recurrenceGroup: group,
            recurrence: cadence,
            recurrenceUntil: boundedUntil,
          })),
        );
      }

      if (toDelete.length > 0) {
        await tx.delete(events).where(
          and(
            eq(events.recurrenceGroup, group),
            inArray(
              events.id,
              toDelete.map((e) => e.id),
            ),
          ),
        );
      }

      // Keep the recorded end in sync across the surviving series rows.
      await tx
        .update(events)
        .set({ recurrenceUntil: boundedUntil })
        .where(eq(events.recurrenceGroup, group));

      return { added: toInsert.length, removed: toDelete.length, kept };
    });

    if (!result) return fail(NOT_ALLOWED);
    if (result.added || result.removed) revalidateAttendance();
    return ok(result);
  } catch (err) {
    console.error('[events] series update failed:', err);
    return fail(SAVE_FAILED);
  }
}

/* ─── Attendance ───────────────────────────────────────────── */

const EVENT_CLOSED = 'This event is closed.';

/**
 * Why this user may not mark or clear attendance of this event right now, or
 * null when they may: canMarkAttendance, the event is still open, then the
 * check-in window (canCheckInNow) for department heads.
 */
function checkInRefusal(
  user: CurrentUser,
  event: typeof events.$inferSelect,
): string | null {
  if (!canMarkAttendance(user, event)) return NOT_ALLOWED;
  if (event.closedAt) return EVENT_CLOSED;
  if (!canCheckInNow(user, event)) {
    return checkInState(checkInWindow(event)) === 'before'
      ? 'Check-in for this event has not opened yet.'
      : 'Check-in for this event has closed.';
  }
  return null;
}

/** Check-in tabs a volunteer can tap from ('auto_close' is server only). */
const TAP_METHODS = ['qr', 'quick_id', 'list'] as const;
export type TapMethod = (typeof TAP_METHODS)[number];

const personKeySchema = z
  .string()
  .transform((v, ctx) => {
    const parsed = parsePersonKey(v);
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: 'Person not found.' });
      return z.NEVER;
    }
    return parsed;
  });

const markSchema = z.object({
  eventId,
  // "m:<members.id>" or "p:<pre_members.id>" (lib/audience.ts).
  personKey: personKeySchema,
  status: z.enum(ATTENDANCE_STATUSES),
  method: z.enum(TAP_METHODS),
});

const NOT_IN_EVENT = 'Not part of this event.';

/**
 * Why this person may not be marked at this event, or null: the event's
 * audience must include their kind, and pre-members must be active (only
 * active pre-members check in).
 */
async function personRefusal(
  event: typeof events.$inferSelect,
  person: { kind: 'member' | 'pre_member'; id: number },
): Promise<string | null> {
  if (!audienceIncludes(event.audience, person.kind)) return NOT_IN_EVENT;
  if (person.kind === 'member') return null; // foreign key checks the row
  const [row] = await db
    .select({ status: preMembers.status })
    .from(preMembers)
    .where(eq(preMembers.id, person.id))
    .limit(1);
  if (!row) return 'Person not found.';
  return row.status === 'active' ? null : preMemberRefusal(row.status);
}

/** Message for a pre-member who may not check in (by status). */
function preMemberRefusal(status: string): string {
  switch (status) {
    case 'promoted':
      return 'Now a member. Please use the member QR.';
    case 'pending':
      return 'This registration is not approved yet.';
    case 'rejected':
      return 'This registration was rejected.';
    case 'withdrawn':
      return 'This pre-member has been withdrawn.';
    default:
      return 'Person not found.';
  }
}

/**
 * Marks (or changes) one person's attendance for an event (a member or a
 * pre-member), with the server time and the tab it was tapped in. The
 * check-in time is set by the first present/late mark and kept (with its
 * method) when present and late are swapped; marking absent clears it.
 * Permission: canMarkAttendance(user, event) on the stored event, the event
 * is not closed, and for department heads the check-in window (canCheckInNow).
 * The person must be expected at the event (its audience).
 *
 * No revalidatePath here on purpose: any revalidation makes Next.js send the
 * whole check-in page (every member) back with each tap, which is slow on
 * phones at the door. The check-in screen keeps its own state and syncs with
 * getEventAttendance() instead.
 */
export async function markAttendance(input: {
  eventId: string;
  personKey: string;
  status: (typeof ATTENDANCE_STATUSES)[number];
  method: TapMethod;
}): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error, 'Invalid input.'));

  const event = await loadEvent(parsed.data.eventId);
  if (!event) return fail('Event not found.');
  const refused = checkInRefusal(user, event);
  if (refused) return fail(refused);
  const person = parsed.data.personKey;
  const notExpected = await personRefusal(event, person);
  if (notExpected) return fail(notExpected);

  const { status, method } = parsed.data;
  const attended = status !== 'absent';
  // Already present or late: keep the time and how it was made.
  const wasAttended = sql`${attendance.status} IN ('present', 'late')`;
  const isMember = person.kind === 'member';
  try {
    await db
      .insert(attendance)
      .values({
        eventId: event.id,
        memberId: isMember ? person.id : null,
        preMemberId: isMember ? null : person.id,
        status,
        markedBy: user.id,
        method,
        checkedInAt: attended ? sql`now()` : null,
      })
      .onConflictDoUpdate({
        target: isMember
          ? [attendance.eventId, attendance.memberId]
          : [attendance.eventId, attendance.preMemberId],
        set: {
          status,
          markedBy: user.id,
          checkedInAt: attended
            ? sql`CASE WHEN ${wasAttended} THEN ${attendance.checkedInAt} ELSE now() END`
            : null,
          method: attended
            ? sql`CASE WHEN ${wasAttended} THEN coalesce(${attendance.method}, ${method}) ELSE ${method} END`
            : method,
        },
      });
  } catch (err) {
    if (isForeignKeyViolation(err)) return fail('Person not found.');
    console.error('[attendance] mark failed:', err);
    return fail('Could not save attendance. Please try again.');
  }

  return ok();
}

const clearSchema = z.object({ eventId, personKey: personKeySchema });

/**
 * Clears one person's attendance for an event (back to "not marked"), e.g.
 * after a wrong tap. Same permission as markAttendance, and no revalidatePath
 * for the same reason.
 */
export async function clearAttendance(input: {
  eventId: string;
  personKey: string;
}): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = clearSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error, 'Invalid input.'));

  const event = await loadEvent(parsed.data.eventId);
  if (!event) return fail('Event not found.');
  const refused = checkInRefusal(user, event);
  if (refused) return fail(refused);

  const person = parsed.data.personKey;
  try {
    await db
      .delete(attendance)
      .where(
        and(
          eq(attendance.eventId, event.id),
          person.kind === 'member'
            ? eq(attendance.memberId, person.id)
            : eq(attendance.preMemberId, person.id),
        ),
      );
  } catch (err) {
    console.error('[attendance] clear failed:', err);
    return fail('Could not clear attendance. Please try again.');
  }

  return ok();
}

/**
 * Current attendance of one event (person key + status only), for the
 * check-in screen to sync with other devices without reloading the page.
 * Permission: canViewEventAttendance(user, event), same as the page.
 */
export async function getEventAttendance(id: string): Promise<
  ActionResult<{
    rows: {
      key: string;
      status: (typeof ATTENDANCE_STATUSES)[number];
    }[];
    /** Closed since the page loaded: the screen reloads into the summary. */
    closed: boolean;
  }>
> {
  const user = await requireUser();
  const parsed = eventId.safeParse(id);
  if (!parsed.success) return fail('Event not found.');
  const event = await loadEvent(parsed.data);
  if (!event) return fail('Event not found.');
  if (!canViewEventAttendance(user, event)) return fail(NOT_ALLOWED);

  const rows = await db
    .select({
      memberId: attendance.memberId,
      preMemberId: attendance.preMemberId,
      status: attendance.status,
    })
    .from(attendance)
    .where(eq(attendance.eventId, event.id));
  return ok({
    rows: rows.map((r) => ({ key: attendanceRowKey(r), status: r.status })),
    closed: event.closedAt !== null,
  });
}

const lookupSchema = z.object({ eventId, code: z.string().max(100) });

/**
 * Why a scanned or typed code is not on this event's check-in list, so the
 * screen can say more than "not found": a pre-member code at a members-only
 * event, a promoted pre-member, a registration that is not approved yet…
 * Nothing is marked. Permission: canMarkAttendance(user, event).
 */
export async function explainCheckInCode(input: {
  eventId: string;
  code: string;
}): Promise<ActionResult<{ message: string; preMember: boolean }>> {
  const user = await requireUser();
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return fail('Event not found.');
  const event = await loadEvent(parsed.data.eventId);
  if (!event) return fail('Event not found.');
  if (!canMarkAttendance(user, event)) return fail(NOT_ALLOWED);

  const code = parsePreMemberCode(parsed.data.code);
  if (!code) {
    // A member ID that is not on the list.
    return ok({
      message: audienceIncludes(event.audience, 'member')
        ? 'Member ID not found'
        : NOT_IN_EVENT,
      preMember: false,
    });
  }
  const [row] = await db
    .select({ status: preMembers.status })
    .from(preMembers)
    .where(eq(preMembers.code, code))
    .limit(1);
  if (!row) return ok({ message: 'Pre-member ID not found', preMember: true });
  if (row.status !== 'active')
    return ok({ message: preMemberRefusal(row.status), preMember: true });
  return ok({
    message: audienceIncludes(event.audience, 'pre_member')
      ? 'Pre-member ID not found'
      : NOT_IN_EVENT,
    preMember: true,
  });
}

/* ─── Close and reopen ─────────────────────────────────────── */

/**
 * Closes an event: everyone on the check-in list (lib/expected-people.ts:
 * active members and/or active pre-members, by audience) without a mark
 * becomes absent (method 'auto_close'), and check-in stops.
 * Permission: canCloseEvent(user, event) on the stored row.
 */
export async function closeEvent(
  id: string,
): Promise<ActionResult<{ markedAbsent: number }>> {
  const user = await requireUser();

  const parsed = eventId.safeParse(id);
  if (!parsed.success) return fail('Event not found.');
  const event = await loadEvent(parsed.data);
  if (!event) return fail('Event not found.');
  if (!canCloseEvent(user, event)) {
    return canMarkAttendance(user, event)
      ? fail('This event has not started yet.')
      : fail(NOT_ALLOWED);
  }
  if (event.closedAt) return fail('This event is already closed.');

  try {
    const markedAbsent = await db.transaction(async (tx) => {
      const [closed] = await tx
        .update(events)
        .set({ closedAt: sql`now()`, closedBy: user.id })
        .where(and(eq(events.id, event.id), isNull(events.closedAt)))
        .returning({ id: events.id });
      if (!closed) return null;
      return insertAutoAbsents(tx, event, user.id);
    });
    if (markedAbsent === null) return fail('This event is already closed.');
    revalidateAttendance();
    return ok({ markedAbsent });
  } catch (err) {
    console.error('[events] close failed:', err);
    return fail('Could not close the event. Please try again.');
  }
}

/**
 * Reopens a closed event (after a mistaken close): removes the automatic
 * absents of the close; marks made by volunteers stay.
 * Permission: canReopenEvent(user).
 */
export async function reopenEvent(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canReopenEvent(user)) return fail(NOT_ALLOWED);

  const parsed = eventId.safeParse(id);
  if (!parsed.success) return fail('Event not found.');
  const event = await loadEvent(parsed.data);
  if (!event) return fail('Event not found.');
  if (!event.closedAt) return fail('This event is not closed.');

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(attendance)
        .where(
          and(
            eq(attendance.eventId, event.id),
            eq(attendance.method, 'auto_close'),
          ),
        );
      await tx
        .update(events)
        .set({ closedAt: null, closedBy: null })
        .where(eq(events.id, event.id));
    });
  } catch (err) {
    console.error('[events] reopen failed:', err);
    return fail('Could not reopen the event. Please try again.');
  }

  revalidateAttendance();
  return ok();
}
