import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { AlertTriangle, Search } from 'lucide-react';
import { authUsers, db, members } from '@felege-yordanos/db/server';
import { Card, PageHead, SectionHeader } from '@/components/ds';
import { BackLink } from '@/components/events/event-ui';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { getT } from '@/lib/i18n/server';
import { normalizeMemberId } from '@/lib/member-id';
import { canPromotePreMembers } from '@/lib/permissions';
import { loadPreMember, suggestedMembers } from '@/lib/pre-member-queries';
import { nameKey, phoneKey, preMemberFullName } from '@/lib/pre-members';
import { requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { PromoteButton } from './promote-button';

type MemberChoice = Awaited<ReturnType<typeof suggestedMembers>>[number];

/**
 * Promote a pre-member: pick their member row (suggested match or search by
 * SSU ID / name), compare both records side by side, confirm.
 */
export default async function PromotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ member?: string; q?: string }>;
}) {
  const user = await requireUser();
  if (!canPromotePreMembers(user)) redirect('/admin');
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const { member: memberParam, q: qParam } = await searchParams;
  const q = (qParam ?? '').trim().slice(0, 100);

  const pm = await loadPreMember(id);
  if (!pm) notFound();
  if (pm.status !== 'active' && pm.status !== 'withdrawn')
    redirect(`/admin/pre-members/${id}`);

  const memberColumns = {
    id: members.id,
    memberId: members.memberId,
    name: members.name,
    fatherName: members.fatherName,
    grandfatherName: members.grandfatherName,
    phone: members.addressPhone,
    linked: sql<boolean>`${members.authUserId} IS NOT NULL`,
  };

  const [suggested, results] = await Promise.all([
    suggestedMembers(id),
    q
      ? db
          .select(memberColumns)
          .from(members)
          .where(
            or(
              ilike(members.memberId, normalizeMemberId(q)),
              ilike(
                sql`${members.name} || ' ' || ${members.fatherName} || ' ' || coalesce(${members.grandfatherName}, '')`,
                `%${q}%`,
              ),
            ),
          )
          .limit(10)
      : Promise.resolve([] as MemberChoice[]),
  ]);

  const memberRecordId = Number(memberParam);
  const [chosen] =
    Number.isSafeInteger(memberRecordId) && memberRecordId > 0
      ? await db
          .select({
            ...memberColumns,
            email: members.addressEmail,
            authUserId: members.authUserId,
            accountEmail: authUsers.email,
            promotedFrom: sql<number | null>`(
            SELECT p.id FROM pre_members p
            WHERE p.status = 'promoted' AND p.promoted_member_id = ${members.id}
            LIMIT 1)`,
          })
          .from(members)
          .leftJoin(authUsers, eq(authUsers.id, members.authUserId))
          .where(eq(members.id, memberRecordId))
          .limit(1)
      : [];

  // What blocks this promotion (also checked again by the server action).
  const blocked = !chosen
    ? null
    : chosen.promotedFrom && chosen.promotedFrom !== id
      ? t('This member row is already the promotion of another pre-member.')
      : chosen.authUserId &&
          pm.authUserId &&
          chosen.authUserId !== pm.authUserId
        ? t(
            'This member row is already linked to another account. Unlink it under Member links first.',
          )
        : null;

  const choiceList = (rows: MemberChoice[]) =>
    rows.map((m) => (
      <Link
        key={m.id}
        href={`/admin/pre-members/${id}/promote?member=${m.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
        className={cn(
          'flex items-center justify-between gap-3 border-t border-parchment-edge px-1 py-2.5 transition-colors hover:bg-parchment-deep/60',
          chosen?.id === m.id && 'bg-gold/10',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-ethiopic text-[13px] font-medium text-ink">
            {[m.name, m.fatherName, m.grandfatherName]
              .filter(Boolean)
              .join(' ')}
          </span>
          <span className="font-mono text-[11px] text-ink-muted">
            {m.memberId}
          </span>
        </span>
        {m.linked && (
          <span className="shrink-0 text-[10.5px] text-ink-muted">
            {t('Account linked')}
          </span>
        )}
      </Link>
    ));

  const rows: {
    label: string;
    pre: string | null;
    mem: string | null;
    same: boolean;
  }[] = chosen
    ? [
        {
          label: t('Name'),
          pre: pm.name,
          mem: chosen.name,
          same: nameKey(pm.name) === nameKey(chosen.name),
        },
        {
          label: t("Father's name"),
          pre: pm.fatherName,
          mem: chosen.fatherName,
          same: nameKey(pm.fatherName) === nameKey(chosen.fatherName),
        },
        {
          label: t("Grandfather's name"),
          pre: pm.grandfatherName,
          mem: chosen.grandfatherName,
          same: nameKey(pm.grandfatherName) === nameKey(chosen.grandfatherName),
        },
        {
          label: t('Phone'),
          pre: pm.phone,
          mem: chosen.phone,
          same: phoneKey(pm.phone) === phoneKey(chosen.phone),
        },
        {
          label: t('Email'),
          pre: pm.email,
          mem: chosen.email,
          same:
            (pm.email ?? '').toLowerCase() ===
            (chosen.email ?? '').toLowerCase(),
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-2xl px-[22px] pb-6 pt-4 md:mx-0 md:max-w-none md:px-7 md:py-7">
      <div className="mb-2.5">
        <BackLink href={`/admin/pre-members/${id}`}>
          {preMemberFullName(pm)}
        </BackLink>
      </div>
      <PageHead
        en="Promote to member"
        am="ወደ አባልነት ማዛወር"
        sub="Pick the member row of their new SSU ID, compare, then confirm."
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="p-[22px]">
          <SectionHeader en="Member row" am="የአባል መዝገብ" />
          <form className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              name="q"
              defaultValue={q}
              placeholder={t('SSU ID or name…')}
              aria-label={t('Search members')}
              className="w-full rounded-[10px] border border-parchment-edge bg-parchment-soft py-[9px] pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/30 dark:bg-parchment-deep"
            />
          </form>
          {q && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                {t('Search results')}
              </div>
              {results.length ? (
                choiceList(results)
              ) : (
                <p className="py-3 text-[12px] text-ink-muted">
                  {t('No members found')}
                </p>
              )}
            </div>
          )}
          <div className="mt-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
              {t('Suggested matches')}
            </div>
            {suggested.length ? (
              choiceList(suggested)
            ) : (
              <p className="py-3 text-[12px] text-ink-muted">
                {t('No member row matches the names, phone or email.')}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-[22px]">
          <SectionHeader en="Compare" am="ማነጻጸሪያ" />
          {!chosen ? (
            <p className="mt-4 text-[12.5px] text-ink-muted">
              {t('Pick a member row on the left.')}
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-parchment-edge-strong pb-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                <span />
                <span className="flex items-center gap-1.5">
                  {pm.code} <PreMemberBadge />
                </span>
                <span>{chosen.memberId}</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.label}
                  className={cn(
                    'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-parchment-edge py-2.5 text-[12.5px]',
                    !r.same && 'bg-status-late-bg/60',
                  )}
                >
                  <span className="text-[11px] text-ink-muted">{r.label}</span>
                  <span className="break-words font-ethiopic text-ink">
                    {r.pre || '—'}
                  </span>
                  <span
                    className={cn(
                      'break-words font-ethiopic',
                      r.same ? 'text-ink' : 'font-semibold text-status-late',
                    )}
                  >
                    {r.mem || '—'}
                  </span>
                </div>
              ))}
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
                {pm.authUserId
                  ? chosen.authUserId === pm.authUserId
                    ? t(
                        'The pre-member’s account is already linked to this member row.',
                      )
                    : t(
                        'The pre-member’s account will be linked to this member row.',
                      )
                  : t(
                      'The pre-member has no account; the member row keeps its link as it is.',
                    )}
                {chosen.accountEmail && !blocked && ` (${chosen.accountEmail})`}
              </p>
              {blocked ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-absent/30 bg-status-absent-bg px-3.5 py-3 text-[12.5px] text-status-absent">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                  {blocked}
                </div>
              ) : (
                <PromoteButton
                  id={id}
                  memberRecordId={chosen.id}
                  memberId={chosen.memberId}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
