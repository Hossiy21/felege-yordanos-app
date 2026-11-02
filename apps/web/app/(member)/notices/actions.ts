'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, noticeReads, notices } from '@felege-yordanos/db/server';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import {
  canSeeExpiredNotices,
  canViewNotice,
  canViewNotices,
} from '@/lib/permissions';
import { requireUser } from '@/lib/session';

/** Marks a notice as read by the signed-in user (unread dots and count). */
export async function markNoticeRead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canViewNotices(user)) return fail(NOT_ALLOWED);
  const noticeId = z.uuid().safeParse(id);
  if (!noticeId.success) return fail('Notice not found.');

  const [notice] = await db
    .select({ expiresAt: notices.expiresAt, audience: notices.audience })
    .from(notices)
    .where(eq(notices.id, noticeId.data))
    .limit(1);
  const visible =
    notice &&
    canViewNotice(user, notice) &&
    (!notice.expiresAt ||
      notice.expiresAt > new Date() ||
      canSeeExpiredNotices(user));
  if (!visible) return fail('Notice not found.');

  const inserted = await db
    .insert(noticeReads)
    .values({ noticeId: noticeId.data, userId: user.id })
    .onConflictDoNothing()
    .returning({ noticeId: noticeReads.noticeId });
  // Only the first time: the dashboard card shows unread dots too.
  if (inserted.length > 0) revalidatePath('/dashboard');
  return ok();
}
