'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  AUDIENCES,
  db,
  NOTICE_CATEGORIES,
  notices,
} from '@felege-yordanos/db/server';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import {
  expiryFromDate,
  NOTICE_BODY_MAX,
  NOTICE_SUMMARY_MAX,
  NOTICE_TITLE_MAX,
  todayInEthiopia,
} from '@/lib/notices';
import { canEditNotice, canPostNotice } from '@/lib/permissions';
import { requireUser } from '@/lib/session';
import { deleteObject, saveNoticeImage } from '@/lib/storage';

const noticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(NOTICE_TITLE_MAX, `Title must be at most ${NOTICE_TITLE_MAX} characters.`),
  summary: z
    .string()
    .trim()
    .max(
      NOTICE_SUMMARY_MAX,
      `Summary must be at most ${NOTICE_SUMMARY_MAX} characters.`,
    )
    .transform((v) => v || null),
  category: z.enum(NOTICE_CATEGORIES, { error: 'Choose a type.' }),
  body: z
    .string()
    .trim()
    .min(1, 'Message is required.')
    .max(NOTICE_BODY_MAX, `Message must be at most ${NOTICE_BODY_MAX} characters.`),
  // Empty = for everyone.
  departmentId: z
    .string()
    .regex(/^\d*$/, 'Choose a department.')
    .transform((v) => (v ? Number(v) : null)),
  // Who sees it (members, pre-members or both).
  audience: z.enum(AUDIENCES, { error: 'Choose who it is for.' }),
  pinned: z.boolean(),
  // "YYYY-MM-DD" or empty for no expiry.
  expiresOn: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.')
    .transform((v) => v || null),
});

const idSchema = z.uuid();

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
};

function parseNotice(formData: FormData) {
  return noticeSchema.safeParse({
    title: text(formData, 'title'),
    summary: text(formData, 'summary'),
    category: text(formData, 'category') || 'general',
    body: text(formData, 'body'),
    departmentId: text(formData, 'departmentId'),
    audience: text(formData, 'audience') || 'members',
    pinned: text(formData, 'pinned') === 'on',
    expiresOn: text(formData, 'expiresOn'),
  });
}

/** A new image from the form, or null. */
function imageFile(formData: FormData): File | null {
  const file = formData.get('image');
  return file instanceof File && file.size > 0 ? file : null;
}

/** Foreign key violation (unknown department), possibly wrapped by Drizzle. */
function isForeignKeyViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e && typeof e === 'object'; i++) {
    if ((e as { code?: unknown }).code === '23503') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

function revalidateNotices() {
  revalidatePath('/notices');
  revalidatePath('/dashboard');
  revalidatePath('/admin/notices');
}

/**
 * FormData: title, summary, category, body, departmentId ('' = everyone),
 * audience ('members' | 'pre_members' | 'everyone'), pinned ('on'),
 * expiresOn ('YYYY-MM-DD' or ''), image (optional file).
 */
export async function createNotice(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseNotice(formData);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');
  const { expiresOn, ...data } = parsed.data;
  if (!canPostNotice(user, data.departmentId)) return fail(NOT_ALLOWED);
  if (expiresOn && expiresOn < todayInEthiopia())
    return fail('The end date cannot be in the past.');

  let imageKey: string | null = null;
  const file = imageFile(formData);
  if (file) {
    try {
      imageKey = await saveNoticeImage(file);
    } catch (err) {
      return fail(
        err instanceof Error ? err.message : 'Could not upload the image.',
      );
    }
  }

  try {
    await db.insert(notices).values({
      ...data,
      imageKey,
      expiresAt: expiresOn ? expiryFromDate(expiresOn) : null,
      createdBy: user.id,
    });
  } catch (err) {
    if (imageKey) await deleteObject('media', imageKey);
    if (isForeignKeyViolation(err)) return fail('Choose a department.');
    throw err;
  }

  revalidateNotices();
  return ok();
}

/**
 * Same fields as createNotice, plus removeImage ('1') to drop the current
 * image. A new image replaces the old one.
 */
export async function updateNotice(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const noticeId = idSchema.safeParse(id);
  if (!noticeId.success) return fail('Notice not found.');
  const parsed = parseNotice(formData);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');
  const { expiresOn, ...data } = parsed.data;

  const [current] = await db
    .select({
      departmentId: notices.departmentId,
      imageKey: notices.imageKey,
      expiresAt: notices.expiresAt,
    })
    .from(notices)
    .where(eq(notices.id, noticeId.data))
    .limit(1);
  if (!current) return fail('Notice not found.');
  // Allowed to edit this notice, and to post in the department it moves to.
  if (!canEditNotice(user, current) || !canPostNotice(user, data.departmentId))
    return fail(NOT_ALLOWED);

  const expiresAt = expiresOn ? expiryFromDate(expiresOn) : null;
  // A past end date is fine when it is unchanged (editing an expired notice).
  const unchanged =
    expiresAt?.getTime() === current.expiresAt?.getTime();
  if (expiresOn && !unchanged && expiresOn < todayInEthiopia())
    return fail('The end date cannot be in the past.');

  let imageKey = text(formData, 'removeImage') === '1' ? null : current.imageKey;
  let newImage: string | null = null;
  const file = imageFile(formData);
  if (file) {
    try {
      newImage = await saveNoticeImage(file);
      imageKey = newImage;
    } catch (err) {
      return fail(
        err instanceof Error ? err.message : 'Could not upload the image.',
      );
    }
  }

  try {
    await db
      .update(notices)
      .set({ ...data, imageKey, expiresAt, updatedAt: new Date() })
      .where(eq(notices.id, noticeId.data));
  } catch (err) {
    if (newImage) await deleteObject('media', newImage);
    if (isForeignKeyViolation(err)) return fail('Choose a department.');
    throw err;
  }

  // Replaced or removed image: delete the old file.
  if (current.imageKey && current.imageKey !== imageKey)
    await deleteObject('media', current.imageKey);

  revalidateNotices();
  return ok();
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const noticeId = idSchema.safeParse(id);
  if (!noticeId.success) return fail('Notice not found.');

  const [current] = await db
    .select({ departmentId: notices.departmentId })
    .from(notices)
    .where(eq(notices.id, noticeId.data))
    .limit(1);
  if (!current) return fail('Notice not found.');
  if (!canEditNotice(user, current)) return fail(NOT_ALLOWED);

  const [deleted] = await db
    .delete(notices)
    .where(eq(notices.id, noticeId.data))
    .returning({ imageKey: notices.imageKey });
  if (deleted?.imageKey) await deleteObject('media', deleted.imageKey);

  revalidateNotices();
  return ok();
}
