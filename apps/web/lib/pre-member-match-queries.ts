/**
 * Loads what the claim suggestion (lib/pre-member-match.ts) decides on, for
 * the signed-in user only. Returns just the FYP ID: never the record's name
 * or phone (the ID was emailed to that address).
 */
import 'server-only';
import { and, eq, isNotNull, or, sql } from 'drizzle-orm';
import {
  db,
  memberLinkRequests,
  preMembers,
} from '@felege-yordanos/db/server';
import { emailKey, suggestedPreMemberCode } from './pre-member-match';
import type { CurrentUser } from './session';

export async function suggestedPreMemberCodeFor(
  user: Pick<CurrentUser, 'id' | 'email' | 'emailVerified' | 'memberRecordId'>,
): Promise<string | null> {
  const key = emailKey(user.email);
  if (!key || !user.emailVerified || user.memberRecordId !== null) return null;

  const [candidates, ownRecords, requests] = await Promise.all([
    db
      .select({
        id: preMembers.id,
        code: preMembers.code,
        status: preMembers.status,
        email: preMembers.email,
        authUserId: preMembers.authUserId,
      })
      .from(preMembers)
      // Stored trimmed and lower-case (lib/pre-member-schema.ts); trim()
      // also covers older rows. The table is small, no index needed.
      .where(sql`lower(trim(${preMembers.email})) = ${key}`)
      .limit(10),
    db.$count(preMembers, eq(preMembers.authUserId, user.id)),
    db
      .select({
        status: memberLinkRequests.status,
        preMemberId: memberLinkRequests.preMemberId,
      })
      .from(memberLinkRequests)
      .where(
        and(
          eq(memberLinkRequests.userId, user.id),
          or(
            eq(memberLinkRequests.status, 'pending'),
            and(
              eq(memberLinkRequests.status, 'rejected'),
              isNotNull(memberLinkRequests.preMemberId),
            ),
          ),
        ),
      ),
  ]);

  return suggestedPreMemberCode(
    {
      email: user.email,
      emailVerified: user.emailVerified,
      linked: ownRecords > 0,
      pendingRequest: requests.some((r) => r.status === 'pending'),
      rejectedPreMemberIds: requests.flatMap((r) =>
        r.status === 'rejected' && r.preMemberId !== null
          ? [r.preMemberId]
          : [],
      ),
    },
    candidates,
  );
}
