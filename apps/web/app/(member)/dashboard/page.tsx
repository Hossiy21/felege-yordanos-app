import { and, asc, desc, eq, gte, inArray, lt, sum, type SQL } from 'drizzle-orm';
import {
  db,
  departments as departmentsTable,
  donations,
  events,
  memberLinkRequests,
  members,
  songViews,
  preMembers,
  songs as songsTable,
} from '@felege-yordanos/db/server';
import { Card } from '@/components/ds';
import { todayYmd } from '@/lib/events';
import { getLocale } from '@/lib/i18n/server';
import { listNotices } from '@/lib/notice-queries';
import { suggestedPreMemberCodeFor } from '@/lib/pre-member-match-queries';
import { canViewNotices, visibleAudiences } from '@/lib/permissions';
import {
  hasMemberAccess,
  hasPreMemberAccess,
  requireUser,
} from '@/lib/session';
import { EventFeed } from './event-feed';
import { WelcomeBanner } from './cards/welcome-banner';
import { MyGivingCard } from './cards/my-giving-card';
import { SongbookPreviewCard } from './cards/continue-singing-card';
import { CheckInCard } from './cards/check-in-card';
import {
  LinkProfilePrompt,
  VerifyEmailPrompt,
} from './cards/link-profile-prompt';
import { QuickActions } from './cards/quick-actions';
import { NoticesCard } from './cards/notices-card';
import { MemberQRCard } from '../profile/member-qr-card';

/** Columns the event feed and welcome banner need. */
const eventColumns = {
  id: events.id,
  title: events.title,
  description: events.description,
  eventDate: events.eventDate,
  startTime: events.startTime,
  endTime: events.endTime,
  departmentId: events.departmentId,
};

export default async function MemberDashboard() {
  const [user, locale] = await Promise.all([requireUser(), getLocale()]);
  // Giving is for verified, linked members (and staff) only; events also
  // for active pre-members (their audience only).
  const access = hasMemberAccess(user);
  const preMember = !access && hasPreMemberAccess(user);
  const eventAccess = access || preMember;
  const audiences = visibleAudiences(user);
  const forMe = (dateFilter: SQL) =>
    audiences === null
      ? dateFilter
      : and(dateFilter, inArray(events.audience, audiences));
  const staffRole = user.assignedRole !== 'member';

  const today = todayYmd();

  // My-giving summary (desktop card): verified total this year + latest verified.
  // Year boundaries in server-local time, as the old JS filter did.
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const startOfNextYear = new Date(currentYear + 1, 0, 1);

  // A member only ever sees their own donations (donor_id = current user).
  const ownDonation = eq(donations.donorId, user.id);
  const ownVerified = and(ownDonation, eq(donations.status, 'verified'));

  const [
    [member],
    upcoming,
    past,
    departments,
    [verifiedTotal],
    [lastVerified],
    [latestDonation],
    previewSongs,
    songCount,
    latestNotices,
  ] = await Promise.all([
    db
      .select({
        memberId: members.memberId,
      })
      .from(members)
      .where(eq(members.authUserId, user.id))
      .limit(1),
    eventAccess && audiences?.length !== 0
      ? db
          .select(eventColumns)
          .from(events)
          .where(forMe(gte(events.eventDate, today)))
          .orderBy(asc(events.eventDate))
          .limit(10)
      : Promise.resolve([]),
    eventAccess && audiences?.length !== 0
      ? db
          .select(eventColumns)
          .from(events)
          .where(forMe(lt(events.eventDate, today)))
          .orderBy(desc(events.eventDate))
          .limit(5)
      : Promise.resolve([]),
    db
      .select({
        id: departmentsTable.id,
        nameAm: departmentsTable.nameAm,
        nameEn: departmentsTable.nameEn,
      })
      .from(departmentsTable)
      .orderBy(asc(departmentsTable.id)),
    db
      .select({ total: sum(donations.amount) })
      .from(donations)
      .where(
        and(
          ownVerified,
          gte(donations.createdAt, startOfYear),
          lt(donations.createdAt, startOfNextYear),
        ),
      ),
    db
      .select({
        amount: donations.amount,
        currency: donations.currency,
        paymentMethod: donations.paymentMethod,
        status: donations.status,
        createdAt: donations.createdAt,
      })
      .from(donations)
      .where(ownVerified)
      .orderBy(desc(donations.createdAt))
      .limit(1),
    db
      .select({ currency: donations.currency })
      .from(donations)
      .where(ownDonation)
      .orderBy(desc(donations.createdAt))
      .limit(1),
    // Per-user history only: the user id comes from requireUser(), never the client.
    db
      .select({
        id: songsTable.id,
        number: songsTable.number,
        title: songsTable.title,
        titleEn: songsTable.titleEn,
        audioUrl: songsTable.audioUrl,
        audioKey: songsTable.audioKey,
      })
      .from(songViews)
      .innerJoin(songsTable, eq(songViews.songId, songsTable.id))
      .where(eq(songViews.userId, user.id))
      .orderBy(desc(songViews.viewedAt))
      .limit(3),
    db.$count(songsTable),
    // Latest active notices (members never see expired ones here).
    canViewNotices(user)
      ? listNotices({
          userId: user.id,
          includeExpired: false,
          audiences,
          limit: 3,
        })
      : Promise.resolve([]),
  ]);

  // An active pre-member's ID (FYP code) for the QR card.
  const [pre] =
    preMember && user.preMemberRecordId !== null
      ? await db
          .select({ code: preMembers.code })
          .from(preMembers)
          .where(eq(preMembers.id, user.preMemberRecordId))
          .limit(1)
      : [];
  const preCode = pre?.code ?? null;

  // Open link request: the prompt says "waiting for approval" instead.
  const linkPending =
    !member &&
    !preMember &&
    (await db.$count(
      memberLinkRequests,
      and(
        eq(memberLinkRequests.userId, user.id),
        eq(memberLinkRequests.status, 'pending'),
      ),
    )) > 0;

  // Same email as one active pre-member record: suggest its FYP ID (#139).
  const suggestedCode =
    user.emailVerified && !member && !preMember && !linkPending
      ? await suggestedPreMemberCodeFor(user)
      : null;

  const verifiedThisYear = Number(verifiedTotal?.total ?? 0);
  const givingCurrency = latestDonation?.currency ?? 'ETB';
  const nextEvent = upcoming[0] ?? null;

  // Registered name once linked, else the email (see getCurrentUser).
  const firstName = user.displayName.split(' ')[0];

  // Department names in the current language.
  const depts = departments.map((d) => ({
    id: d.id,
    name: locale === 'en' ? d.nameEn : d.nameAm,
  }));
  const memberDeptName = user.departmentId
    ? (depts.find((d) => d.id === user.departmentId)?.name ?? null)
    : null;

  const hero = {
    firstName,
    memberId: member?.memberId ?? preCode,
    memberDeptName,
    nextEvent,
  };

  return (
    <>
      {/* ─── PHONE (< md): hero, quick actions, event cards ─── */}
      <div className="mx-auto max-w-2xl px-[18px] pb-6 pt-[14px] md:hidden">
        <WelcomeBanner {...hero} variant="mobile" />
        {!user.emailVerified ? (
          <VerifyEmailPrompt className="mt-3.5" staff={staffRole} />
        ) : (
          !member &&
          !preMember && (
            <LinkProfilePrompt
              className="mt-3.5"
              pending={linkPending}
              suggestedCode={suggestedCode}
            />
          )
        )}
        {preCode && (
          <div className="mt-3.5">
            <MemberQRCard memberId={preCode} variant="pre_member" />
          </div>
        )}
        <QuickActions songCount={songCount} preMember={preMember} />
        <div className="mt-4">
          <SongbookPreviewCard songs={previewSongs} />
        </div>
        {canViewNotices(user) && (
          <NoticesCard notices={latestNotices} className="mt-4" />
        )}
        {eventAccess && (
          <EventFeed
            upcoming={upcoming}
            past={past}
            departments={depts}
            variant="mobile"
          />
        )}
      </div>

      {/* ─── DESKTOP (md+): hero band + two-column grid ─── */}
      <div className="hidden p-7 md:block">
        <WelcomeBanner {...hero} variant="desktop" />
        {!user.emailVerified ? (
          <VerifyEmailPrompt className="mt-4" staff={staffRole} />
        ) : (
          !member &&
          !preMember && (
            <LinkProfilePrompt
              className="mt-4"
              pending={linkPending}
              suggestedCode={suggestedCode}
            />
          )
        )}

        <div className="mt-4 grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-4">
          {eventAccess ? (
            <Card>
              <EventFeed
                upcoming={upcoming}
                past={past}
                departments={depts}
                variant="desktop"
              />
            </Card>
          ) : (
            <SongbookPreviewCard songs={previewSongs} />
          )}

          <div className="flex flex-col gap-4">
            {canViewNotices(user) && <NoticesCard notices={latestNotices} />}
            {preCode && <CheckInCard memberId={preCode} variant="pre_member" />}
            {eventAccess && <SongbookPreviewCard songs={previewSongs} />}
            {access && (
              <MyGivingCard
                total={verifiedThisYear}
                currency={givingCurrency}
                last={
                  lastVerified
                    ? { ...lastVerified, amount: Number(lastVerified.amount) }
                    : null
                }
              />
            )}
            {access && member && <CheckInCard memberId={member.memberId} />}
          </div>
        </div>
      </div>
    </>
  );
}
