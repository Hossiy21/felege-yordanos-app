import {
  CalendarCheck,
  Heart,
  Home,
  LayoutDashboard,
  ListMusic,
  Megaphone,
  Music,
  Receipt,
  ScanLine,
  Sprout,
  User,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role as UserRole } from '@felege-yordanos/db/schema';
import {
  canAccessAdmin,
  canApproveMemberLinks,
  canManageNotices,
  canManagePreMembers,
  canManageSongs,
  canManageUsers,
  canReviewDonations,
} from './permissions';

/**
 * A single navigation destination. This is the ONE source of truth for both
 * the desktop sidebar and any future nav surface — adding an item here is the
 * only change required (Open/Closed): components render whatever the config holds.
 */
export interface NavItem {
  href: string;
  labelEn: string;
  labelAm: string;
  icon: LucideIcon;
  /** When true, child routes (e.g. /admin/songs/new) also count as active. */
  matchNested?: boolean;
}

/** Visible to every authenticated user. Labels follow the design system. */
export const MEMBER_NAV: NavItem[] = [
  { href: '/dashboard', labelEn: 'Home', labelAm: 'ዋና ገጽ', icon: Home },
  {
    href: '/notices',
    labelEn: 'Notices',
    labelAm: 'ማስታወቂያ',
    icon: Megaphone,
    matchNested: true,
  },
  {
    href: '/songbook',
    labelEn: 'Songbook',
    labelAm: 'መዝሙር',
    icon: Music,
    matchNested: true,
  },
  {
    href: '/attendance',
    labelEn: 'Events',
    labelAm: 'መርሃ ግብር',
    icon: CalendarCheck,
    matchNested: true,
  },
  { href: '/donate', labelEn: 'Donate', labelAm: 'መዋጮ', icon: Heart },
  { href: '/profile', labelEn: 'Profile', labelAm: 'መገለጫ', icon: User },
];

/**
 * Elevated-role destinations under /admin. Who sees which one comes from
 * ADMIN_NAV_RULES (the same rules the pages enforce).
 */
export const ADMIN_NAV: NavItem[] = [
  // Exact match only, so it is not highlighted on the pages below it.
  {
    href: '/admin',
    labelEn: 'Admin home',
    labelAm: 'ዋና ገጽ',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/attendance',
    labelEn: 'Events',
    labelAm: 'መርሃ ግብር',
    icon: CalendarCheck,
    matchNested: true,
  },
  {
    href: '/admin/check-in',
    labelEn: 'Check-in',
    labelAm: 'መግቢያ',
    icon: ScanLine,
    matchNested: true,
  },
  {
    href: '/admin/notices',
    labelEn: 'Notices',
    labelAm: 'ማስታወቂያዎች',
    icon: Megaphone,
    matchNested: true,
  },
  {
    href: '/admin/songs',
    labelEn: 'Songs',
    labelAm: 'መዝሙሮች',
    icon: ListMusic,
    matchNested: true,
  },
  {
    href: '/admin/donations',
    labelEn: 'Donations',
    labelAm: 'መዋጮዎች',
    icon: Receipt,
    matchNested: true,
  },
  {
    href: '/admin/member-links',
    labelEn: 'Member links',
    labelAm: 'ማገናኛዎች',
    icon: UserCheck,
    matchNested: true,
  },
  {
    href: '/admin/pre-members',
    labelEn: 'Pre-members',
    labelAm: 'ቅድመ አባላት',
    icon: Sprout,
    matchNested: true,
  },
  {
    href: '/admin/users',
    labelEn: 'Users',
    labelAm: 'ተጠቃሚዎች',
    icon: Users,
    matchNested: true,
  },
];

const ELEVATED_ROLES: readonly UserRole[] = [
  'dept_head',
  'admin',
  'super_admin',
];

/** Whether a role may see the ADMIN nav section (mirrors proxy.ts route gating). */
export function isElevated(role: UserRole | null | undefined): boolean {
  return !!role && ELEVATED_ROLES.includes(role);
}

type NavUser = Parameters<typeof canAccessAdmin>[0];

/**
 * Which admin pages a user may open, from lib/permissions.ts. Menus only show
 * these; the pages and actions still enforce the rules themselves.
 */
const ADMIN_NAV_RULES: Record<string, (u: NavUser) => boolean> = {
  '/admin': canAccessAdmin,
  '/admin/attendance': canAccessAdmin,
  '/admin/check-in': canAccessAdmin,
  '/admin/notices': canManageNotices,
  '/admin/songs': canManageSongs,
  '/admin/donations': canReviewDonations,
  '/admin/member-links': canApproveMemberLinks,
  '/admin/pre-members': canManagePreMembers,
  '/admin/users': canManageUsers,
};

/** The admin hrefs a user may see (computed on the server, passed to menus). */
export function adminHrefsFor(u: NavUser): string[] {
  return Object.keys(ADMIN_NAV_RULES).filter((href) =>
    ADMIN_NAV_RULES[href](u),
  );
}

export interface RoleNav {
  member: NavItem[];
  admin: NavItem[];
}

/**
 * The nav sections to show, given the admin hrefs this user may see.
 * Pre-members do not see Donate (donations are for members).
 */
export function navFor(
  adminHrefs: readonly string[],
  preMember = false,
): RoleNav {
  return {
    member: preMember
      ? MEMBER_NAV.filter((i) => i.href !== '/donate')
      : MEMBER_NAV,
    admin: ADMIN_NAV.filter((i) => adminHrefs.includes(i.href)),
  };
}

/** Whether a nav item matches the current pathname (exact, or nested when allowed). */
export function isActivePath(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return !!item.matchNested && pathname.startsWith(`${item.href}/`);
}

/** Routes that are not in the menus but still need a breadcrumb. */
const EXTRA_CRUMBS: Pick<NavItem, 'href' | 'labelEn' | 'labelAm'>[] = [
  { href: '/claim', labelEn: 'Link profile', labelAm: 'መገለጫ ማገናኘት' },
];

/** The breadcrumb label for a path — the longest matching nav href wins. */
export function breadcrumbForPath(
  pathname: string,
): Pick<NavItem, 'labelEn' | 'labelAm'> | null {
  const match = [...MEMBER_NAV, ...ADMIN_NAV, ...EXTRA_CRUMBS]
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? { labelEn: match.labelEn, labelAm: match.labelAm } : null;
}
