import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { db, departments } from '@felege-yordanos/db/server';
import { Card, PageHead } from '@/components/ds';
import { secondaryBtn } from '@/components/events/button-classes';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { deptShortLabel, formatYmd, todayYmd } from '@/lib/events';
import {
  ethiopianPeriodLabel,
  ethiopianPeriods,
} from '@/lib/ethiopian-periods';
import { getLocale, getT } from '@/lib/i18n/server';
import {
  PEOPLE_PAGE_SIZE,
  defaultDir,
  parsePeopleFilters,
  peopleQuery,
  personHref,
  type PeopleRow,
  type PeopleSort,
} from '@/lib/people-list';
import { loadPeople } from '@/lib/people-queries';
import { canViewPeople } from '@/lib/permissions';
import { requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { PeopleFilters } from './people-filters';

const COLS =
  'grid-cols-[150px_minmax(0,1.6fr)_90px_minmax(0,0.8fr)_70px_70px_64px_104px_70px]';

/** Members and pre-members with their attendance (find who stopped coming). */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewPeople(user)) redirect('/admin');
  const [t, locale, sp] = await Promise.all([getT(), getLocale(), searchParams]);
  const f = parsePeopleFilters(sp);

  const [{ rows, total }, deptRows] = await Promise.all([
    loadPeople(f),
    db
      .select({ id: departments.id })
      .from(departments)
      .orderBy(asc(departments.id)),
  ]);
  const pages = Math.max(1, Math.ceil(total / PEOPLE_PAGE_SIZE));

  const periods = ethiopianPeriods(todayYmd()).map((p) => ({
    key: p.key,
    label: ethiopianPeriodLabel(p, locale),
    from: p.from,
    to: p.to,
  }));
  const deptOptions = deptRows.map((d) => ({
    value: String(d.id),
    label: deptShortLabel(d.id, locale),
  }));

  const href = (change: Parameters<typeof peopleQuery>[1]) => {
    const q = peopleQuery(f, change);
    return q ? `/admin/people?${q}` : '/admin/people';
  };
  const sortHref = (sort: PeopleSort) =>
    href({
      sort,
      dir:
        f.sort === sort
          ? f.dir === 'asc'
            ? 'desc'
            : 'asc'
          : defaultDir(sort),
      page: 1,
    });
  const exportQuery = peopleQuery(f, { page: 1 });

  const head = (label: string, sort?: PeopleSort, right = false) => (
    <span
      key={label}
      className={cn(
        'text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep',
        right && 'text-right',
      )}
    >
      {sort ? (
        <Link
          href={sortHref(sort)}
          scroll={false}
          className={cn(
            'inline-flex items-center gap-1 hover:text-brand dark:hover:text-gold-light',
            f.sort === sort && 'text-brand dark:text-gold-light',
          )}
        >
          {label}
          {f.sort === sort &&
            (f.dir === 'asc' ? (
              <ArrowUp className="h-2.5 w-2.5" />
            ) : (
              <ArrowDown className="h-2.5 w-2.5" />
            ))}
        </Link>
      ) : (
        label
      )}
    </span>
  );

  const name = (r: PeopleRow) =>
    [r.name, r.fatherName].filter(Boolean).join(' ');
  const lastSeen = (r: PeopleRow) =>
    r.lastSeen
      ? formatYmd(r.lastSeen, locale, {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : t('Never');
  const rate = (r: PeopleRow) => (r.ratePct === null ? '—' : `${r.ratePct}%`);
  const typeTag = (r: PeopleRow) =>
    r.kind === 'pre_member' ? (
      <PreMemberBadge />
    ) : (
      <span className="text-[11px] text-ink-muted">{t('Member')}</span>
    );

  return (
    <div className="px-[18px] pb-6 pt-4 md:px-7 md:py-7">
      <PageHead
        en="People"
        am="ሰዎች"
        sub="Members and pre-members with their attendance at closed events"
        actions={
          <a
            href={`/api/people/export${exportQuery ? `?${exportQuery}` : ''}`}
            className={secondaryBtn}
          >
            <Download className="h-[13px] w-[13px]" />
            <span className="hidden sm:inline">{t('Export CSV')}</span>
          </a>
        }
      />

      <Card className="mb-4 rounded-xl p-3.5 md:p-4">
        <PeopleFilters deptOptions={deptOptions} periods={periods} />
      </Card>

      <div className="mb-2 font-mono text-[11px] text-ink-muted">
        {t('{n} people', { n: total })}
      </div>

      {rows.length === 0 ? (
        <Card className="py-12 text-center text-sm text-ink-muted">
          {t('No people match these filters.')}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden p-0 md:block">
            <div
              className={cn(
                'grid gap-3 border-b border-parchment-edge-strong px-5 py-3',
                COLS,
              )}
            >
              {head(t('ID'), 'code')}
              {head(t('Name'), 'name')}
              {head(t('Type'))}
              {head(t('Department'))}
              {head(t('Expected'), 'expected', true)}
              {head(t('Attended'), 'attended', true)}
              {head(t('Rate'), 'rate', true)}
              {head(t('Last seen'), 'last_seen')}
              {head(t('Missed'), 'streak', true)}
            </div>
            {rows.map((r) => (
              <Link
                key={`${r.kind}:${r.id}`}
                href={personHref(r)}
                className={cn(
                  'grid items-center gap-3 border-b border-parchment-edge px-5 py-2.5 transition-colors last:border-0 hover:bg-parchment-deep/60',
                  COLS,
                )}
              >
                <span className="truncate font-mono text-[11.5px] font-semibold text-ink">
                  {r.code || '—'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-ethiopic text-[13px] font-medium text-ink">
                    {name(r)}
                  </span>
                  {!r.active && (
                    <span className="text-[10px] text-ink-faint">
                      {t(r.status === 'withdrawn' ? 'Withdrawn' : 'Inactive')}
                    </span>
                  )}
                </span>
                {typeTag(r)}
                <span
                  className={cn(
                    'truncate text-[11.5px] text-ink-muted',
                    locale === 'am' ? 'font-ethiopic' : 'font-body',
                  )}
                >
                  {r.departmentId ? deptShortLabel(r.departmentId, locale) : '—'}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-ink">
                  {r.expected}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-ink">
                  {r.attended}
                </span>
                <span className="text-right font-mono text-[12px] font-semibold tabular-nums text-ink">
                  {rate(r)}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    r.lastSeen ? 'text-ink' : 'text-ink-faint',
                  )}
                >
                  {lastSeen(r)}
                </span>
                <span
                  className={cn(
                    'text-right font-mono text-[12px] font-semibold tabular-nums',
                    r.missedStreak >= 3 ? 'text-status-absent' : 'text-ink',
                  )}
                >
                  {r.missedStreak}
                </span>
              </Link>
            ))}
          </Card>

          {/* Phone cards */}
          <div className="flex flex-col gap-1.5 md:hidden">
            {rows.map((r) => (
              <Link
                key={`${r.kind}:${r.id}`}
                href={personHref(r)}
                className="rounded-[12px] border border-parchment-edge bg-parchment-soft px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-ethiopic text-[14px] font-semibold text-brand-ink">
                      {name(r)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-ink-muted">
                      {r.code || '—'}
                      {r.departmentId && (
                        <span
                          className={
                            locale === 'am' ? 'font-ethiopic' : 'font-body'
                          }
                        >
                          · {deptShortLabel(r.departmentId, locale)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {r.kind === 'pre_member' && <PreMemberBadge />}
                    <span className="font-mono text-[15px] font-semibold tabular-nums text-brand-ink">
                      {rate(r)}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10.5px] text-ink-muted">
                  <span>
                    {r.attended}/{r.expected} {t('attended')}
                  </span>
                  <span>
                    {t('Last seen')}: {lastSeen(r)}
                  </span>
                  <span
                    className={
                      r.missedStreak >= 3 ? 'font-semibold text-status-absent' : ''
                    }
                  >
                    {t('Missed in a row')}: {r.missedStreak}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <nav
              aria-label={t('Pages')}
              className="mt-3 flex items-center justify-between gap-3"
            >
              <span className="font-mono text-[11px] text-ink-muted">
                {t('Page {n} of {m}', { n: f.page, m: pages })}
              </span>
              <div className="flex gap-1.5">
                {f.page > 1 ? (
                  <Link
                    href={href({ page: f.page - 1 })}
                    aria-label={t('Previous')}
                    className={cn(secondaryBtn, 'px-2.5 py-1.5')}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                {f.page < pages ? (
                  <Link
                    href={href({ page: f.page + 1 })}
                    aria-label={t('Next')}
                    className={cn(secondaryBtn, 'px-2.5 py-1.5')}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
