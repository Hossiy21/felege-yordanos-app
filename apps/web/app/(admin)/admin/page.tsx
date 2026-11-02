import { and, eq, gte, inArray, lt, or, type SQL } from 'drizzle-orm';
import {
  attendance,
  db,
  donations,
  events,
  members,
  profiles,
} from '@felege-yordanos/db/server';
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  DoorOpen,
  Megaphone,
  Music,
  Sprout,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { intlLocale } from '@/lib/i18n/config';
import { todayYmd } from '@/lib/events';
import { getLocale, getT } from '@/lib/i18n/server';
import { bilingual } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { requireUser, type CurrentUser } from '@/lib/session';
import { adminHrefsFor } from '@/lib/nav';
import { countPendingPreMembers } from '@/lib/pre-member-queries';
import {
  canAccessAdmin,
  canManagePreMembers,
  canReviewDonations,
  canViewAllAttendance,
  canViewAllProfiles,
} from '@/lib/permissions';

interface AdminLinkDef {
  href: string;
  icon: typeof CalendarCheck;
  am: string;
  en: string;
  description: string;
  cta: string;
  featured?: boolean;
  /** "N pending" badge: pending donations or pending pre-members. */
  badge?: 'donations' | 'pre_members';
}

const adminLinks: AdminLinkDef[] = [
  {
    href: '/admin/attendance',
    icon: CalendarClock,
    am: 'መርሃ ግብር',
    en: 'Events',
    description:
      'Plan liturgical gatherings, choir rehearsals, and recurring programs.',
    cta: 'Manage events',
  },
  {
    href: '/admin/check-in',
    icon: DoorOpen,
    am: 'መግቢያ',
    en: 'Check-in',
    description: 'Scan or mark members present for today’s gatherings.',
    cta: 'Start check-in',
  },
  {
    href: '/admin/notices',
    icon: Megaphone,
    am: 'ማስታወቂያዎች',
    en: 'Notices',
    description: 'Post announcements for everyone or for your department.',
    cta: 'Manage notices',
  },
  {
    href: '/admin/songs',
    icon: Music,
    am: 'መዝሙር አስተዳደር',
    en: 'Songs & Categories',
    description:
      'Add, edit, and organize hymns for the Sunday School songbook.',
    cta: 'Manage songs',
    featured: true,
  },
  {
    href: '/admin/donations',
    icon: Wallet,
    am: 'መዋጮዎች',
    en: 'Donations',
    description: 'Verify tithes, special contributions, and charitable funds.',
    cta: 'Verification queue',
    badge: 'donations',
  },
  {
    href: '/admin/member-links',
    icon: UserCheck,
    am: 'የአባልነት ማገናኛዎች',
    en: 'Member links',
    description: 'Confirm which account belongs to which registered member.',
    cta: 'Review requests',
  },
  {
    href: '/admin/pre-members',
    icon: Sprout,
    am: 'ቅድመ አባላት',
    en: 'Pre-members',
    description:
      'Register, approve and promote people who are not registered members yet.',
    cta: 'Manage pre-members',
    badge: 'pre_members',
  },
  {
    href: '/admin/users',
    icon: Users,
    am: 'የተጠቃሚ አስተዳደር',
    en: 'Manage Users',
    description: 'Assign roles, manage departments, oversee membership.',
    cta: 'View members',
  },
];

/**
 * Attendance rows the user may read (same rule as the old RLS policy):
 * everything for admins and Programs & Events, otherwise the user's own
 * records plus, for dept heads, attendance of their department's events.
 */
function visibleAttendance(user: CurrentUser): SQL | undefined {
  if (canViewAllAttendance(user)) return undefined;
  const own = inArray(
    attendance.memberId,
    db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.authUserId, user.id)),
  );
  if (user.role !== 'dept_head' || user.departmentId == null) return own;
  return or(
    own,
    inArray(
      attendance.eventId,
      db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.departmentId, user.departmentId)),
    ),
  );
}

// Phone strip: one column per visible stat (full class names for Tailwind).
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

export default async function AdminDashboard() {
  const user = await requireUser();
  if (!canAccessAdmin(user)) redirect('/dashboard');
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const am = locale === 'am';

  const today = todayYmd();
  // Count check-ins from Ethiopian midnight (21:00 UTC the previous day).
  const startOfToday = new Date(`${today}T00:00:00+03:00`);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  // Counts are scoped exactly like the old RLS policies: reviewers see every
  // pending donation, others only their own; only admins see all profiles.
  const [todayCheckIns, pendingDonations, membersTotal, pendingPreMembers] =
    await Promise.all([
    db.$count(
      attendance,
      and(
        inArray(attendance.status, ['present', 'late']),
        gte(attendance.createdAt, startOfToday),
        lt(attendance.createdAt, startOfTomorrow),
        visibleAttendance(user),
      ),
    ),
    db.$count(
      donations,
      and(
        eq(donations.status, 'pending'),
        canReviewDonations(user) ? undefined : eq(donations.donorId, user.id),
      ),
    ),
    db.$count(
      profiles,
      canViewAllProfiles(user) ? undefined : eq(profiles.id, user.id),
    ),
    canManagePreMembers(user)
      ? countPendingPreMembers()
      : Promise.resolve(0),
  ]);

  // Only the pages this user may open (same rules as the sidebar).
  const allowed = adminHrefsFor(user);
  const visibleLinks = adminLinks.filter((link) => allowed.includes(link.href));

  // Donation and member totals only for people who may see them.
  const stats = [
    { en: 'Today', value: todayCheckIns, sub: 'check-ins' },
    ...(canReviewDonations(user)
      ? [{ en: 'Pending', value: pendingDonations, sub: 'donations' }]
      : []),
    ...(canViewAllProfiles(user)
      ? [{ en: 'Members', value: membersTotal, sub: 'active' }]
      : []),
  ];
  const num = new Intl.NumberFormat(intlLocale(locale));

  return (
    <div className="mx-auto max-w-2xl px-[22px] pb-6 pt-[18px] md:max-w-none md:p-7">
      {/* Header */}
      <div
        className={cn(
          'text-xs tracking-[0.06em] text-gold-deep',
          am ? 'font-display text-[13px] italic' : 'font-ethiopic',
        )}
      >
        {am ? 'Admin panel' : 'የአስተዳዳሪ ክፍል'}
      </div>
      <h1
        className={cn(
          'mt-1 leading-none text-brand-ink',
          am
            ? 'font-ethiopic text-[32px] font-semibold md:text-[30px]'
            : 'font-display text-[38px] font-medium md:text-[34px]',
        )}
      >
        {am ? (
          t('Admin panel')
        ) : (
          <>
            Admin <em className="text-brand dark:text-gold">panel</em>
          </>
        )}
      </h1>
      <div className="mb-[22px] mt-3.5 h-0.5 w-12 bg-gradient-to-r from-gold to-transparent" />

      {/* Today summary: one strip on the phone, three cards on desktop */}
      <div className="relative mb-[22px] overflow-hidden rounded-[14px] border border-parchment-edge bg-parchment-soft px-3.5 py-3 md:mb-4 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2.5 -top-2.5 font-ethiopic text-[70px] leading-none text-gold/[0.06] md:hidden"
        >
          ✣
        </span>
        <div className={cn('grid md:contents', COLS[stats.length])}>
          {stats.map((s, i) => (
            <div
              key={s.en}
              className={cn(
                i > 0 && 'border-l border-parchment-edge pl-3.5',
                'md:relative md:overflow-hidden md:rounded-2xl md:border md:border-parchment-edge md:bg-parchment-soft md:p-5 md:shadow-[0_1px_0_rgba(10,60,54,0.04),0_4px_14px_-8px_rgba(10,60,54,0.12)] md:dark:shadow-[0_4px_14px_-8px_rgba(0,0,0,0.4)]',
              )}
            >
              <div
                className={cn(
                  'text-[9.5px] tracking-[0.05em] text-gold-deep md:text-[11px]',
                  am
                    ? 'font-ethiopic'
                    : 'font-semibold uppercase tracking-[0.18em] md:text-[10px]',
                )}
              >
                {t(s.en)}
              </div>
              <div className="mt-0.5 font-display text-[26px] font-medium leading-none tabular-nums lining-nums text-brand dark:text-gold md:mt-2 md:text-[34px]">
                {num.format(s.value)}
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-ink-muted md:mt-1 md:text-[10.5px]">
                {t(s.sub)}
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 -top-3 hidden font-ethiopic text-[64px] leading-none text-gold/[0.07] md:block"
              >
                ✣
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Link cards */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {visibleLinks.map((link) => {
          const featured = link.featured;
          const Icon = link.icon;
          const title = bilingual(locale, link.en, link.am);
          const pendingCount =
            link.badge === 'donations'
              ? pendingDonations
              : link.badge === 'pre_members'
                ? pendingPreMembers
                : 0;
          const badge =
            pendingCount > 0
              ? t('{n} pending', { n: num.format(pendingCount) })
              : null;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative overflow-hidden rounded-2xl py-[18px] pl-[22px] pr-[18px] transition-transform hover:-translate-y-0.5',
                featured
                  ? 'sacred-gradient border border-gold/30 text-cream shadow-[0_10px_24px_-10px_rgba(10,60,54,0.45)]'
                  : 'border border-parchment-edge bg-parchment-soft shadow-[0_1px_0_rgba(10,60,54,0.04)] dark:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.35)]',
              )}
            >
              {featured && (
                <div className="tibeb-gold pointer-events-none absolute inset-0 opacity-40" />
              )}
              <div className="relative flex items-start gap-3.5">
                <div
                  className={cn(
                    'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl',
                    featured
                      ? 'border border-gold/35 bg-cream/[0.12]'
                      : 'bg-gold/[0.16] dark:bg-gold/[0.14]',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      featured ? 'text-gold' : 'text-gold-deep',
                    )}
                    strokeWidth={1.75}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div
                      className={cn(
                        'text-[10px] font-medium tracking-[0.04em]',
                        am
                          ? 'font-display text-[11px] italic'
                          : 'font-ethiopic',
                        featured ? 'text-cream/60' : 'text-gold-deep',
                      )}
                    >
                      {title.secondary}
                    </div>
                    {badge && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.04em]',
                          featured
                            ? 'bg-gold/25 text-gold'
                            : 'bg-status-late-bg text-status-late',
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <h3
                    className={cn(
                      'mb-1.5 leading-[1.05]',
                      am
                        ? 'font-ethiopic text-[19px] font-semibold'
                        : 'font-display text-[22px] font-medium',
                      featured ? 'text-cream' : 'text-brand-ink',
                    )}
                  >
                    {title.primary}
                  </h3>
                  <p
                    className={cn(
                      'text-xs leading-[1.45]',
                      featured ? 'text-cream/70' : 'text-ink-muted',
                    )}
                  >
                    {t(link.description)}
                  </p>
                  <div
                    className={cn(
                      'mt-2.5 inline-flex items-center gap-1 text-xs font-semibold',
                      featured ? 'text-gold' : 'text-brand dark:text-gold',
                    )}
                  >
                    {t(link.cta)}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
