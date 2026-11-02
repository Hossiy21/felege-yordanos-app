import { desc, eq } from 'drizzle-orm';
import {
  db,
  memberLinkRequests,
  members,
  preMembers,
} from '@felege-yordanos/db/server';
import { PageHead } from '@/components/ds';
import { requireVerifiedEmail } from '@/lib/session';
import { ClaimForm, type ClaimState } from './claim-form';

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  // Link requests need a verified email.
  const user = await requireVerifiedEmail();
  const { required } = await searchParams;

  // A linked pre-member record (any status): promotion moves it to a member.
  const [linkedPre] =
    user.memberRecordId === null
      ? await db
          .select({ code: preMembers.code, status: preMembers.status })
          .from(preMembers)
          .where(eq(preMembers.authUserId, user.id))
          .limit(1)
      : [];

  let state: ClaimState = { kind: 'none' };
  if (user.memberRecordId !== null) {
    const [m] = await db
      .select({ memberId: members.memberId })
      .from(members)
      .where(eq(members.id, user.memberRecordId))
      .limit(1);
    state = { kind: 'linked', memberId: m?.memberId ?? '', preMember: false };
  } else if (linkedPre) {
    state = {
      kind: 'linked',
      memberId: linkedPre.code ?? '',
      preMember: true,
      inactive: linkedPre.status !== 'active',
    };
  } else {
    // The account's latest request decides what the page shows.
    const [latest] = await db
      .select({
        status: memberLinkRequests.status,
        note: memberLinkRequests.note,
        createdAt: memberLinkRequests.createdAt,
        memberId: members.memberId,
        preCode: preMembers.code,
      })
      .from(memberLinkRequests)
      .leftJoin(members, eq(members.id, memberLinkRequests.memberId))
      .leftJoin(preMembers, eq(preMembers.id, memberLinkRequests.preMemberId))
      .where(eq(memberLinkRequests.userId, user.id))
      .orderBy(desc(memberLinkRequests.createdAt))
      .limit(1);
    const requested = latest?.memberId ?? latest?.preCode ?? '';
    const preMember = !!latest?.preCode;
    if (latest?.status === 'pending') {
      state = {
        kind: 'pending',
        memberId: requested,
        preMember,
        requestedAt: latest.createdAt?.toISOString() ?? '',
      };
    } else if (latest?.status === 'rejected') {
      state = {
        kind: 'rejected',
        memberId: requested,
        preMember,
        note: latest.note,
      };
    }
  }

  return (
    <div className="mx-auto max-w-md px-[22px] pb-6 pt-4 md:max-w-lg md:px-7 md:py-10">
      <PageHead
        en="Link your member profile"
        am="የአባልነት መለያዎን ያገናኙ"
        className="mb-3.5 md:mb-4"
      />
      <ClaimForm state={state} required={required === '1'} />
    </div>
  );
}
