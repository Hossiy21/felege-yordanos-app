'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, preMembers, profiles } from '@felege-yordanos/db/server';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import { hasPreMemberAccess } from '@/lib/permissions';
import { logPreMember } from '@/lib/pre-member-queries';
import {
  diffDetails,
  preMemberDetailsSchema,
  type PreMemberDetailsInput,
} from '@/lib/pre-member-schema';
import { requireUser } from '@/lib/session';

const DISPLAY_NAME_MAX = 100;

const displayNameSchema = z
  .string()
  .trim()
  .max(
    DISPLAY_NAME_MAX,
    `Display name must be at most ${DISPLAY_NAME_MAX} characters.`,
  );

/**
 * Updates the signed-in user's display name. Only their own profile, and
 * only display_name: role and department are never touched here.
 */
export async function updateDisplayName(
  displayName: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');
  }
  const value = parsed.data || null;

  // Every account gets a profile at sign-up; the upsert only covers a
  // missing row (role then stays at its 'member' default).
  await db
    .insert(profiles)
    .values({ id: user.id, displayName: value })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { displayName: value, updatedAt: new Date() },
    });

  revalidatePath('/profile');
  revalidatePath('/admin/users');
  // The display name is shown in the app shell header (layouts).
  revalidatePath('/', 'layout');
  return ok();
}

/**
 * A pre-member updates their own names, email and phone (all required).
 * Only their own active record (session.preMemberRecordId); the change is
 * logged in the history as 'edited' by themselves.
 */
export async function updateMyPreMemberDetails(
  input: PreMemberDetailsInput,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasPreMemberAccess(user) || user.preMemberRecordId === null)
    return fail(NOT_ALLOWED);
  const parsed = preMemberDetailsSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');
  const id = user.preMemberRecordId;

  const error = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(preMembers)
      .where(
        and(
          eq(preMembers.id, id),
          eq(preMembers.authUserId, user.id),
          eq(preMembers.status, 'active'),
        ),
      )
      .for('update')
      .limit(1);
    if (!current) return NOT_ALLOWED;
    const changes = diffDetails(current, parsed.data);
    if (Object.keys(changes).length === 0) return null;
    await tx
      .update(preMembers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(preMembers.id, id));
    await logPreMember(tx, id, 'edited', user.id, { changes, self: true });
    return null;
  });
  if (error) return fail(error);

  revalidatePath('/profile');
  revalidatePath(`/admin/pre-members/${id}`);
  revalidatePath('/', 'layout');
  return ok();
}
