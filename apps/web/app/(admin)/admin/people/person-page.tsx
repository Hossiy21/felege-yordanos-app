import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { db, departments } from '@felege-yordanos/db/server';
import { Card, StatusPill } from '@/components/ds';
import { PersonAttendanceSection } from '@/components/people/person-attendance-section';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { getLocale, getT } from '@/lib/i18n/server';
import {
  canManagePreMembers,
  canViewPeople,
  canViewPersonAttendance,
} from '@/lib/permissions';
import type { PersonRecord } from '@/lib/people-queries';
import { requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';

type SearchParams = Record<string, string | string[] | undefined>;

/** A positive integer id from the route, else 404. */
export function routeId(raw: string): number {
  if (!/^\d{1,15}$/.test(raw)) notFound();
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return id;
}

/** The query string again (to keep the filters on a redirect). */
export function queryOf(sp: SearchParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp))
    for (const one of Array.isArray(v) ? v : v ? [v] : []) q.append(k, one);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** /admin/people/m/[id] and /admin/people/p/[id]. */
export async function PersonPage({
  person,
  searchParams,
}: {
  person: PersonRecord | null;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  // Same answer for a missing and a forbidden person, unless allowed.
  if (!person || !canViewPersonAttendance(user, person)) {
    if (!canViewPeople(user)) redirect('/admin');
    notFound();
  }
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const [dept] = person.departmentId
    ? await db
        .select({ nameEn: departments.nameEn, nameAm: departments.nameAm })
        .from(departments)
        .where(eq(departments.id, person.departmentId))
        .limit(1)
    : [];

  const fullName = [person.name, person.fatherName, person.grandfatherName]
    .filter(Boolean)
    .join(' ');
  const isPre = person.kind === 'pre_member';
  const inactiveLabel = person.active
    ? null
    : isPre
      ? person.status === 'withdrawn'
        ? t('Withdrawn')
        : t(person.status === 'pending' ? 'Pending' : 'Inactive')
      : t('Inactive');

  return (
    <div className="px-[18px] pb-6 pt-4 md:px-7 md:py-7">
      <Link
        href="/admin/people"
        className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-gold-deep transition-colors hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('People')}
      </Link>

      <Card className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isPre ? (
              <PreMemberBadge />
            ) : (
              <span className="rounded-full bg-brand/10 px-2 py-px text-[10px] font-semibold text-brand dark:bg-gold/15 dark:text-gold-light">
                {t('Member')}
              </span>
            )}
            {inactiveLabel && (
              <StatusPill tone="neutral">{inactiveLabel}</StatusPill>
            )}
          </div>
          <h1 className="mt-1.5 font-ethiopic text-[24px] font-semibold leading-tight text-brand-ink md:text-[28px]">
            {fullName}
          </h1>
          <div className="mt-1 font-mono text-[12.5px] tracking-[0.04em] text-ink-muted">
            {person.code || '—'}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] md:text-right">
          {!isPre && (
            <>
              <dt className="text-ink-muted">{t('Department')}</dt>
              <dd
                className={cn(
                  'text-ink',
                  locale === 'am' ? 'font-ethiopic' : 'font-body',
                )}
              >
                {dept ? (locale === 'am' ? dept.nameAm : dept.nameEn) : '—'}
              </dd>
            </>
          )}
          <dt className="text-ink-muted">{t('Account linked')}</dt>
          <dd className="text-ink">
            {person.authUserId ? t('Yes') : t('No')}
          </dd>
          {person.formerPreMember && (
            <>
              <dt className="text-ink-muted">{t('Was a pre-member')}</dt>
              <dd className="font-mono text-ink">
                {canManagePreMembers(user) ? (
                  <Link
                    href={`/admin/pre-members/${person.formerPreMember.id}`}
                    className="text-gold-deep underline-offset-2 hover:underline"
                  >
                    {person.formerPreMember.code ?? '—'}
                  </Link>
                ) : (
                  (person.formerPreMember.code ?? '—')
                )}
              </dd>
            </>
          )}
          {isPre && canManagePreMembers(user) && (
            <>
              <dt className="text-ink-muted">{t('Record')}</dt>
              <dd>
                <Link
                  href={`/admin/pre-members/${person.id}`}
                  className="text-gold-deep underline-offset-2 hover:underline"
                >
                  {t('Open record')}
                </Link>
              </dd>
            </>
          )}
        </dl>
      </Card>

      <PersonAttendanceSection
        person={person}
        searchParams={searchParams}
        staff
      />
    </div>
  );
}
