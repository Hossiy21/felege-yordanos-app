'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  authUsers,
  db,
  memberLinkRequests,
  members,
  preMemberHistory,
  preMembers,
  profiles,
} from '@felege-yordanos/db/server';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import { normalizeMemberId } from '@/lib/member-id';
import { canApproveMemberLinks } from '@/lib/permissions';
import { requireUser } from '@/lib/session';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MEMBER_TAKEN = 'This member record is already linked to another account.';
const ACCOUNT_LINKED = 'This account is already linked to a member record.';
const PRE_MEMBER_TAKEN =
  'This pre-member record is already linked to another account.';
const ACCOUNT_LINKED_PRE =
  'This account is already linked to a pre-member record.';

function revalidate() {
  revalidatePath('/admin/member-links');
  revalidatePath('/admin/pre-members', 'layout');
  revalidatePath('/admin/users');
  revalidatePath('/claim');
  revalidatePath('/', 'layout');
}

/**
 * Links `userId` to member `memberRecordId` inside `tx`.
 * Returns an error message, or null when linked.
 */
async function link(
  tx: Tx,
  userId: string,
  memberRecordId: number,
  adminId: string,
): Promise<string | null> {
  const [account] = await tx
    .select({ id: members.id })
    .from(members)
    .where(eq(members.authUserId, userId))
    .limit(1);
  if (account) return ACCOUNT_LINKED;
  // A pre-member account becomes a member account through promotion.
  const [preAccount] = await tx
    .select({ id: preMembers.id })
    .from(preMembers)
    .where(eq(preMembers.authUserId, userId))
    .limit(1);
  if (preAccount) return ACCOUNT_LINKED_PRE;

  const updated = await tx
    .update(members)
    .set({ authUserId: userId, updatedAt: new Date() })
    .where(and(eq(members.id, memberRecordId), isNull(members.authUserId)))
    .returning({
      name: members.name,
      fatherName: members.fatherName,
    });
  if (updated.length === 0) return MEMBER_TAKEN;

  // Show the registered name in the app.
  const fullName = [updated[0].name, updated[0].fatherName]
    .filter(Boolean)
    .join(' ');
  if (fullName) {
    await tx
      .update(profiles)
      .set({ displayName: fullName, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
  }

  const now = new Date();
  // Close this account's open request.
  await tx
    .update(memberLinkRequests)
    .set({ status: 'approved', decidedBy: adminId, decidedAt: now })
    .where(
      and(
        eq(memberLinkRequests.userId, userId),
        eq(memberLinkRequests.status, 'pending'),
      ),
    );
  // Other accounts that asked for the same member record are turned down.
  await tx
    .update(memberLinkRequests)
    .set({
      status: 'rejected',
      note: 'Linked to another account. Contact an admin if this is your member ID.',
      decidedBy: adminId,
      decidedAt: now,
    })
    .where(
      and(
        eq(memberLinkRequests.memberId, memberRecordId),
        eq(memberLinkRequests.status, 'pending'),
        ne(memberLinkRequests.userId, userId),
      ),
    );
  return null;
}

/**
 * Links `userId` to pre-member `preMemberId` inside `tx` (active records
 * only), closes the request and logs 'linked' in the pre-member's history.
 * Returns an error message, or null when linked.
 */
async function linkPreMember(
  tx: Tx,
  userId: string,
  preMemberId: number,
  adminId: string,
): Promise<string | null> {
  const [memberAccount] = await tx
    .select({ id: members.id })
    .from(members)
    .where(eq(members.authUserId, userId))
    .limit(1);
  if (memberAccount) return ACCOUNT_LINKED;
  const [preAccount] = await tx
    .select({ id: preMembers.id })
    .from(preMembers)
    .where(eq(preMembers.authUserId, userId))
    .limit(1);
  if (preAccount) return ACCOUNT_LINKED_PRE;

  const now = new Date();
  const updated = await tx
    .update(preMembers)
    .set({ authUserId: userId, updatedAt: now })
    .where(
      and(
        eq(preMembers.id, preMemberId),
        isNull(preMembers.authUserId),
        eq(preMembers.status, 'active'),
      ),
    )
    .returning({ code: preMembers.code });
  if (updated.length === 0) return PRE_MEMBER_TAKEN;

  const [account] = await tx
    .select({ email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  await tx.insert(preMemberHistory).values({
    preMemberId,
    action: 'linked',
    actorUserId: adminId,
    details: { userId, email: account?.email ?? null },
  });

  await tx
    .update(memberLinkRequests)
    .set({ status: 'approved', decidedBy: adminId, decidedAt: now })
    .where(
      and(
        eq(memberLinkRequests.userId, userId),
        eq(memberLinkRequests.status, 'pending'),
      ),
    );
  await tx
    .update(memberLinkRequests)
    .set({
      status: 'rejected',
      note: 'Linked to another account. Contact an admin if this is your ID.',
      decidedBy: adminId,
      decidedAt: now,
    })
    .where(
      and(
        eq(memberLinkRequests.preMemberId, preMemberId),
        eq(memberLinkRequests.status, 'pending'),
        ne(memberLinkRequests.userId, userId),
      ),
    );
  return null;
}

const idSchema = z.string().uuid();

/** Approves an open request: links the account to the requested member record. */
export async function approveLinkRequest(
  requestId: string,
): Promise<ActionResult> {
  const admin = await requireUser();
  if (!canApproveMemberLinks(admin)) return fail(NOT_ALLOWED);
  if (!idSchema.safeParse(requestId).success) return fail('Request not found.');

  const error = await db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        userId: memberLinkRequests.userId,
        memberId: memberLinkRequests.memberId,
        preMemberId: memberLinkRequests.preMemberId,
      })
      .from(memberLinkRequests)
      .where(
        and(
          eq(memberLinkRequests.id, requestId),
          eq(memberLinkRequests.status, 'pending'),
        ),
      )
      .limit(1);
    if (!request) return 'This request was already handled.';
    if (request.preMemberId !== null)
      return linkPreMember(tx, request.userId, request.preMemberId, admin.id);
    if (request.memberId === null) return 'This request was already handled.';
    return link(tx, request.userId, request.memberId, admin.id);
  });
  if (error) return fail(error);

  revalidate();
  return ok();
}

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().max(200).optional(),
});

/** Rejects an open request. The optional note is shown to the requester. */
export async function rejectLinkRequest(input: {
  requestId: string;
  note?: string;
}): Promise<ActionResult> {
  const admin = await requireUser();
  if (!canApproveMemberLinks(admin)) return fail(NOT_ALLOWED);
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return fail('Request not found.');

  const updated = await db
    .update(memberLinkRequests)
    .set({
      status: 'rejected',
      note: parsed.data.note || null,
      decidedBy: admin.id,
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(memberLinkRequests.id, parsed.data.requestId),
        eq(memberLinkRequests.status, 'pending'),
      ),
    )
    .returning({ id: memberLinkRequests.id });
  if (updated.length === 0) return fail('This request was already handled.');

  revalidate();
  return ok();
}

const directSchema = z.object({
  userId: z.string().uuid(),
  memberId: z.string().trim().min(1, 'Enter a member ID.').max(100),
});

/** Links an account to a member record without a request (e.g. at the door). */
export async function linkAccountDirect(input: {
  userId: string;
  memberId: string;
}): Promise<ActionResult> {
  const admin = await requireUser();
  if (!canApproveMemberLinks(admin)) return fail(NOT_ALLOWED);
  const parsed = directSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');

  const wanted = normalizeMemberId(parsed.data.memberId);
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(sql`lower(${members.memberId}) = lower(${wanted})`)
    .limit(1);
  if (!member) return fail('Member ID not found.');

  const [account] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.id, parsed.data.userId))
    .limit(1);
  if (!account) return fail('Account not found.');

  const error = await db.transaction((tx) =>
    link(tx, parsed.data.userId, member.id, admin.id),
  );
  if (error) return fail(error);

  revalidate();
  return ok();
}

/** Removes the link between an account and its member record. */
export async function unlinkAccount(userId: string): Promise<ActionResult> {
  const admin = await requireUser();
  if (!canApproveMemberLinks(admin)) return fail(NOT_ALLOWED);
  if (!idSchema.safeParse(userId).success) return fail('Account not found.');

  const updated = await db
    .update(members)
    .set({ authUserId: null, updatedAt: new Date() })
    .where(eq(members.authUserId, userId))
    .returning({ id: members.id });
  if (updated.length === 0) return fail('This account is not linked.');

  revalidate();
  return ok();
}
