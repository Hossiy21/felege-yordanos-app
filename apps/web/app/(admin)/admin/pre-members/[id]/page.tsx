import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AlertTriangle, Link2 } from 'lucide-react';
import {
  authUsers,
  db,
  members,
  registrationSessions,
} from '@felege-yordanos/db/server';
import { Card, Eyebrow, SectionHeader } from '@/components/ds';
import { BackLink } from '@/components/events/event-ui';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { getLocale, getT } from '@/lib/i18n/server';
import { canManagePreMembers, canPromotePreMembers } from '@/lib/permissions';
import {
  findDuplicates,
  loadHistory,
  loadPreMember,
} from '@/lib/pre-member-queries';
import { preMemberFullName } from '@/lib/pre-members';
import { requireUser } from '@/lib/session';
import { formatDateTime } from '../format';
import { PreMemberStatusPill } from '../status-pill';
import { HistoryTimeline } from './history-timeline';
import { PreMemberActions } from './pre-member-actions';
import { PreMemberQrPanel } from './qr-panel';

export default async function PreMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canManagePreMembers(user)) redirect('/admin');
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [t, locale, pm] = await Promise.all([
    getT(),
    getLocale(),
    loadPreMember(id),
  ]);
  if (!pm) notFound();

  const [history, duplicates, [account], [promotedTo], [session]] =
    await Promise.all([
      loadHistory(pm.id),
      // Likely duplicates matter before approval (and help on active records).
      pm.status === 'pending' || pm.status === 'active'
        ? findDuplicates(pm)
        : Promise.resolve([]),
      pm.authUserId
        ? db
            .select({ email: authUsers.email, name: authUsers.name })
            .from(authUsers)
            .where(eq(authUsers.id, pm.authUserId))
            .limit(1)
        : Promise.resolve([]),
      pm.promotedMemberId
        ? db
            .select({ memberId: members.memberId })
            .from(members)
            .where(eq(members.id, pm.promotedMemberId))
            .limit(1)
        : Promise.resolve([]),
      pm.sessionId
        ? db
            .select({ label: registrationSessions.label })
            .from(registrationSessions)
            .where(eq(registrationSessions.id, pm.sessionId))
            .limit(1)
        : Promise.resolve([]),
    ]);

  const fullName = preMemberFullName(pm);
  const readOnly = pm.status === 'promoted';
  const reasonLabel = {
    names: t('same names'),
    phone: t('same phone'),
    email: t('same email'),
  };

  const detail = (label: string, value: React.ReactNode, mono = false) => (
    <div className="border-b border-parchment-edge py-2.5 last:border-0">
      <Eyebrow className="text-[9px]">{label}</Eyebrow>
      <div
        className={
          mono
            ? 'mt-1 font-mono text-[13px] text-ink'
            : 'mt-1 text-[13px] text-ink'
        }
      >
        {value || <span className="text-ink-faint">—</span>}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-[22px] pb-6 pt-4 md:mx-0 md:max-w-none md:px-7 md:py-7">
      <div className="mb-2.5">
        <BackLink
          href={`/admin/pre-members?tab=${pm.status === 'rejected' || pm.status === 'withdrawn' ? 'closed' : pm.status}`}
        >
          {t('Pre-members')}
        </BackLink>
      </div>

      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PreMemberBadge />
            <PreMemberStatusPill status={pm.status} />
          </div>
          <h1 className="mt-1.5 font-ethiopic text-[24px] font-semibold leading-tight text-brand-ink md:text-[28px]">
            {fullName}
          </h1>
          <div className="mt-1 font-mono text-[13px] text-ink-muted">
            {pm.code ?? t('No ID yet (assigned on approval)')}
            {promotedTo && (
              <>
                {' · '}
                <span className="font-semibold text-gold-deep">
                  {t('Promoted → {id}', { id: promotedTo.memberId })}
                </span>
              </>
            )}
          </div>
        </div>
        <PreMemberActions
          id={pm.id}
          status={pm.status}
          name={fullName}
          linked={!!pm.authUserId}
          canPromote={canPromotePreMembers(user)}
          initial={{
            name: pm.name,
            fatherName: pm.fatherName,
            grandfatherName: pm.grandfatherName,
            email: pm.email ?? '',
            phone: pm.phone ?? '',
          }}
        />
      </div>

      {duplicates.length > 0 && (
        <Card className="mb-4 border-status-late/40 bg-status-late-bg/60 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-late" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">
                {t('Possible duplicates')}
              </p>
              <p className="text-[11.5px] text-ink-muted">
                {t(
                  'Check these before approving. This is a warning, not a block.',
                )}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {duplicates.map((d) => (
                  <li
                    key={`${d.kind}-${d.id}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]"
                  >
                    {d.kind === 'pre_member' ? (
                      <Link
                        href={`/admin/pre-members/${d.id}`}
                        className="font-ethiopic font-semibold text-brand underline-offset-2 hover:underline dark:text-gold-light"
                      >
                        {d.name}
                      </Link>
                    ) : (
                      <span className="font-ethiopic font-semibold text-ink">
                        {d.name}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-ink-muted">
                      {d.code ?? '—'}
                    </span>
                    {d.kind === 'pre_member' ? (
                      <PreMemberBadge />
                    ) : (
                      <span className="rounded-full bg-brand/[0.08] px-2 py-px text-[9.5px] font-semibold text-brand dark:text-gold-light">
                        {t('Member')}
                      </span>
                    )}
                    <span className="text-[11px] text-status-late">
                      {d.reasons.map((r) => reasonLabel[r]).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card className="p-[22px]">
            <SectionHeader en="Details" am="ዝርዝር" />
            <div className="mt-2 grid gap-x-6 md:grid-cols-2">
              {detail(
                t('Name'),
                <span className="font-ethiopic">{pm.name}</span>,
              )}
              {detail(
                t("Father's name"),
                <span className="font-ethiopic">{pm.fatherName}</span>,
              )}
              {detail(
                t("Grandfather's name"),
                <span className="font-ethiopic">{pm.grandfatherName}</span>,
              )}
              {detail(t('Phone'), pm.phone, true)}
              {detail(t('Email'), pm.email)}
              {detail(
                t('Registered'),
                `${formatDateTime(pm.createdAt, locale)} · ${t(pm.source === 'self' ? 'Self-registered' : 'Registered by an admin')}`,
              )}
              {pm.source === 'self' &&
                detail(
                  t('Reference'),
                  `R-${pm.id}${session ? ` · ${session.label}` : ''}`,
                  true,
                )}
              {pm.note && detail(t('Note'), pm.note)}
            </div>
            {readOnly && (
              <p className="mt-3 text-[11.5px] text-ink-muted">
                {t('This record is read-only since the promotion.')}
              </p>
            )}
          </Card>

          <Card className="p-[22px]">
            <SectionHeader en="History" am="ታሪክ" />
            <HistoryTimeline entries={history} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {pm.code && (pm.status === 'active' || pm.status === 'withdrawn') && (
            <PreMemberQrPanel
              code={pm.code}
              name={fullName}
              disabled={pm.status !== 'active'}
            />
          )}
          <Card className="p-[22px]">
            <SectionHeader en="Account" am="መለያ" />
            {account ? (
              <div className="mt-3 flex items-center gap-2.5">
                <div className="rounded-full bg-status-present-bg p-2 text-status-present">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {account.name || account.email}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-muted">
                    {account.email}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
                {t(
                  'No account linked. The pre-member signs up, then chooses “I am a ቅድመ አባል” on the link page and enters their ID; you approve it under Member links.',
                )}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
