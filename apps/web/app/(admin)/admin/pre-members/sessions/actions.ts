'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  preMembers,
  registrationSessions,
} from '@felege-yordanos/db/server';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import { canManageRegistrationSessions } from '@/lib/permissions';
import { newSessionToken } from '@/lib/registration-sessions';
import { requireUser } from '@/lib/session';

/** "YYYY-MM-DDTHH:mm" typed in Ethiopian time (datetime-local input). */
const eatDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter a valid date and time.')
  .transform((v) => new Date(`${v}:00+03:00`));

const MAX_HOURS = 7 * 24;

const openSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Give the session a name.')
    .max(80, 'The name must be at most 80 characters.'),
  opensAt: eatDateTime,
  closesAt: eatDateTime,
});

function revalidate() {
  revalidatePath('/admin/pre-members/sessions');
  revalidatePath('/admin/pre-members/sessions/[id]', 'page');
}

/**
 * Opens a self-registration session: a new random token for the /join QR,
 * valid from opensAt to closesAt (at most 7 days).
 * Permission: canManageRegistrationSessions.
 */
export async function openRegistrationSession(input: {
  label: string;
  opensAt: string;
  closesAt: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!canManageRegistrationSessions(user)) return fail(NOT_ALLOWED);
  const parsed = openSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');
  const { label, opensAt, closesAt } = parsed.data;
  if (closesAt <= opensAt)
    return fail('The session must close after it opens.');
  if (closesAt <= new Date()) return fail('The closing time is in the past.');
  if (closesAt.getTime() - opensAt.getTime() > MAX_HOURS * 3600_000)
    return fail('A session can be open for at most 7 days.');

  const [row] = await db
    .insert(registrationSessions)
    .values({
      token: newSessionToken(),
      label,
      opensAt,
      closesAt,
      createdBy: user.id,
    })
    .returning({ id: registrationSessions.id });
  revalidate();
  return ok({ id: row.id });
}

const idSchema = z.uuid();

/** Closes a session early: its QR stops working at once. */
export async function closeRegistrationSession(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageRegistrationSessions(user)) return fail(NOT_ALLOWED);
  if (!idSchema.safeParse(id).success) return fail('Session not found.');
  const updated = await db
    .update(registrationSessions)
    .set({ closedAt: new Date(), closedBy: user.id })
    .where(
      and(
        eq(registrationSessions.id, id),
        isNull(registrationSessions.closedAt),
      ),
    )
    .returning({ id: registrationSessions.id });
  if (updated.length === 0) return fail('This session is already closed.');
  revalidate();
  return ok();
}

/** Registrations received through a session (live count on the QR screen). */
export async function getRegistrationSessionCount(
  id: string,
): Promise<ActionResult<{ count: number; closed: boolean }>> {
  const user = await requireUser();
  if (!canManageRegistrationSessions(user)) return fail(NOT_ALLOWED);
  if (!idSchema.safeParse(id).success) return fail('Session not found.');
  const [session] = await db
    .select({
      closedAt: registrationSessions.closedAt,
      closesAt: registrationSessions.closesAt,
    })
    .from(registrationSessions)
    .where(eq(registrationSessions.id, id))
    .limit(1);
  if (!session) return fail('Session not found.');
  const count = await db.$count(preMembers, eq(preMembers.sessionId, id));
  return ok({
    count,
    closed: !!session.closedAt || session.closesAt <= new Date(),
  });
}
