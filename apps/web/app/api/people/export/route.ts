import { NextResponse, type NextRequest } from 'next/server';
import { toCsv } from '@/lib/csv';
import { deptShortLabel, todayYmd } from '@/lib/events';
import { getLocale, getT } from '@/lib/i18n/server';
import { parsePeopleFilters } from '@/lib/people-list';
import { loadPeople } from '@/lib/people-queries';
import { canViewPeople } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/session';

/**
 * CSV of the people list with the same filters and order as /admin/people
 * (every row, not one page). Allowed: canViewPeople.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  if (!canViewPeople(user))
    return new NextResponse('Forbidden', { status: 403 });

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const f = parsePeopleFilters(Object.fromEntries(req.nextUrl.searchParams));
  const { rows } = await loadPeople(f, { all: true });

  const csv = toCsv([
    [
      t('ID'),
      t('Name'),
      t('Father name'),
      t('Type'),
      t('Department'),
      t('Status'),
      t('Expected'),
      t('Attended'),
      t('Rate %'),
      t('Last seen'),
      t('Missed in a row'),
    ],
    ...rows.map((r) => [
      r.code,
      r.name,
      r.fatherName,
      r.kind === 'member' ? t('Member') : t('Pre-member'),
      r.departmentId ? deptShortLabel(r.departmentId, locale) : '',
      r.active ? t('Active') : t(r.status === 'withdrawn' ? 'Withdrawn' : 'Inactive'),
      r.expected,
      r.attended,
      r.ratePct,
      r.lastSeen,
      r.missedStreak,
    ]),
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="people-${todayYmd()}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
