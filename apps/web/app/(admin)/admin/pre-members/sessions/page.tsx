import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { Maximize2 } from 'lucide-react';
import {
  db,
  preMembers,
  registrationSessions,
} from '@felege-yordanos/db/server';
import { Card, PageHead, SectionHeader, StatusPill } from '@/components/ds';
import { secondaryBtn } from '@/components/events/button-classes';
import { BackLink } from '@/components/events/event-ui';
import { getLocale, getT } from '@/lib/i18n/server';
import { canManageRegistrationSessions } from '@/lib/permissions';
import { sessionState } from '@/lib/registration-sessions';
import { requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { formatDateTime } from '../format';
import { CloseSessionButton, OpenSessionForm } from './session-forms';

const STATE_TONE = {
  open: 'present',
  scheduled: 'upcoming',
  closed: 'neutral',
} as const;
const STATE_LABEL = {
  open: 'Open',
  scheduled: 'Scheduled',
  closed: 'Closed',
} as const;

/** Self-registration sessions: open one, show its QR, close it, past counts. */
export default async function RegistrationSessionsPage() {
  const user = await requireUser();
  if (!canManageRegistrationSessions(user)) redirect('/admin');
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const rows = await db
    .select({
      id: registrationSessions.id,
      label: registrationSessions.label,
      opensAt: registrationSessions.opensAt,
      closesAt: registrationSessions.closesAt,
      closedAt: registrationSessions.closedAt,
      count: sql<number>`count(${preMembers.id})::int`,
    })
    .from(registrationSessions)
    .leftJoin(preMembers, eq(preMembers.sessionId, registrationSessions.id))
    .groupBy(registrationSessions.id)
    .orderBy(desc(registrationSessions.opensAt))
    .limit(100);

  const now = new Date();

  return (
    <div className="mx-auto max-w-2xl px-[22px] pb-6 pt-4 md:mx-0 md:max-w-none md:px-7 md:py-7">
      <div className="mb-2.5">
        <BackLink href="/admin/pre-members">{t('Pre-members')}</BackLink>
      </div>
      <PageHead
        en="Registration sessions"
        am="የምዝገባ ጊዜያት"
        sub="Open a session to show a QR code people scan to register themselves."
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="p-[22px]">
          <SectionHeader en="Open a session" am="ምዝገባ ክፈት" />
          <OpenSessionForm />
        </Card>

        <Card className="p-0">
          <div className="px-[22px] pt-[22px]">
            <SectionHeader en="Sessions" am="ጊዜያት" />
          </div>
          {rows.length === 0 ? (
            <p className="px-[22px] py-10 text-center text-[12.5px] text-ink-muted">
              {t('No sessions yet.')}
            </p>
          ) : (
            <ul className="mt-2">
              {rows.map((r) => {
                const state = sessionState(r, now);
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 border-t border-parchment-edge px-[22px] py-3.5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-ink">
                          {r.label}
                        </span>
                        <StatusPill tone={STATE_TONE[state]}>
                          {t(STATE_LABEL[state])}
                        </StatusPill>
                      </div>
                      <div className="mt-0.5 font-mono text-[10.5px] text-ink-muted">
                        {formatDateTime(r.opensAt, locale)} →{' '}
                        {formatDateTime(r.closedAt ?? r.closesAt, locale)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/pre-members?tab=pending&session=${r.id}`}
                        className="rounded-full bg-parchment-deep px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-parchment-edge"
                        title={t('Registrations')}
                      >
                        {t('{n} registered', { n: r.count })}
                      </Link>
                      {state !== 'closed' && (
                        <>
                          <Link
                            href={`/admin/pre-members/sessions/${r.id}`}
                            className={cn(
                              secondaryBtn,
                              'px-3 py-1.5 text-[12px]',
                            )}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                            {t('Show QR')}
                          </Link>
                          <CloseSessionButton id={r.id} />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
