'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  memberLinkRequests,
  members,
  preMembers,
} from '@felege-yordanos/db/server';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { normalizeMemberId } from '@/lib/member-id';
import { parsePreMemberCode } from '@/lib/pre-members';
import { requireUser } from '@/lib/session';

const NOT_FOUND = 'Member ID not found. Please check your ID and try again.';
const TAKEN =
  'This member ID is already linked to another account. Contact an admin.';
const ALREADY_LINKED = 'Your account is already linked to a member record.';
const NOT_VERIFIED = 'Verify your email first, then request the link.';
const PRE_LINKED =
  'Your account is linked to a pre-member record. An admin promotes it once you have a member ID.';
const PRE_NOT_FOUND =
  'Pre-member ID not found. Please check your ID and try again.';
const PRE_TAKEN =
  'This pre-member ID is already linked to another account. Contact an admin.';
const PRE_PROMOTED =
  'This pre-member is now a member. Link your member ID instead.';
const PRE_INACTIVE =
  'This pre-member ID is not active. Please ask a volunteer at the desk.';

/** The pre-member record linked to this account (any status), if any. */
async function linkedPreMember(userId: string) {
  const [row] = await db
    .select({ id: preMembers.id })
    .from(preMembers)
    .where(eq(preMembers.authUserId, userId))
    .limit(1);
  return row ?? null;
}

/** One open request per account: replaces the old one. */
async function replaceRequest(
  userId: string,
  target: { memberId: number } | { preMemberId: number },
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(memberLinkRequests)
      .where(
        and(
          eq(memberLinkRequests.userId, userId),
          eq(memberLinkRequests.status, 'pending'),
        ),
      );
    await tx.insert(memberLinkRequests).values({ userId, ...target });
  });
  revalidatePath('/claim');
  revalidatePath('/dashboard');
  revalidatePath('/admin/member-links');
}

const memberIdSchema = z
  .string()
  .trim()
  .min(1, 'Please enter your member ID.')
  .max(100, NOT_FOUND);

/**
 * Asks an admin to link the signed-in account to a member record.
 * Member ids are sequential, so nothing is linked until an admin approves
 * (app/(admin)/admin/member-links). A new request replaces an open one.
 * The member's name is never shown to the requester.
 */
export async function requestMemberLink(
  memberIdInput: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = memberIdSchema.safeParse(memberIdInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? NOT_FOUND);
  }
  if (!user.emailVerified) return fail(NOT_VERIFIED);
  if (user.memberRecordId !== null) return fail(ALREADY_LINKED);
  if (await linkedPreMember(user.id)) return fail(PRE_LINKED);

  const wanted = normalizeMemberId(parsed.data);
  const [member] = await db
    .select({ id: members.id, authUserId: members.authUserId })
    .from(members)
    .where(sql`lower(${members.memberId}) = lower(${wanted})`)
    .limit(1);
  if (!member) return fail(NOT_FOUND);
  if (member.authUserId) return fail(TAKEN);

  await replaceRequest(user.id, { memberId: member.id });
  return ok();
}

/**
 * "I am a ቅድመ አባል": asks an admin to link the signed-in account to an
 * active pre-member record (FYP code). Same flow as requestMemberLink; the
 * pre-member's name is never shown to the requester.
 */
export async function requestPreMemberLink(
  codeInput: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const code = parsePreMemberCode(String(codeInput ?? '').slice(0, 40));
  if (!code) return fail(PRE_NOT_FOUND);
  if (!user.emailVerified) return fail(NOT_VERIFIED);
  if (user.memberRecordId !== null) return fail(ALREADY_LINKED);
  if (await linkedPreMember(user.id)) return fail(PRE_LINKED);

  const [pre] = await db
    .select({
      id: preMembers.id,
      status: preMembers.status,
      authUserId: preMembers.authUserId,
    })
    .from(preMembers)
    .where(eq(preMembers.code, code))
    .limit(1);
  if (!pre) return fail(PRE_NOT_FOUND);
  if (pre.status === 'promoted') return fail(PRE_PROMOTED);
  if (pre.status !== 'active') return fail(PRE_INACTIVE);
  if (pre.authUserId) return fail(PRE_TAKEN);

  await replaceRequest(user.id, { preMemberId: pre.id });
  return ok();
}

/** Withdraws the signed-in user's open request. */
export async function cancelMemberLinkRequest(): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .delete(memberLinkRequests)
    .where(
      and(
        eq(memberLinkRequests.userId, user.id),
        eq(memberLinkRequests.status, 'pending'),
      ),
    );
  revalidatePath('/claim');
  revalidatePath('/dashboard');
  revalidatePath('/admin/member-links');
  return ok();
}
