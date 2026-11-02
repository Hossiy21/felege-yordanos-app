'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarCheck,
  Heart,
  Home,
  Megaphone,
  Music,
  Shield,
  User,
} from 'lucide-react';
import type { Role as UserRole } from '@felege-yordanos/db/schema';
import { useLocale } from '@/lib/i18n/client';
import { isElevated } from '@/lib/nav';
import { cn } from '@/lib/utils';

// Short Amharic tab labels; the sidebar and page titles keep the full names.
const MEMBER_LINKS = [
  { href: '/dashboard', icon: Home, label: 'Home', am: 'ዋና ገጽ' },
  { href: '/notices', icon: Megaphone, label: 'Notices', am: 'ማስታወቂያ' },
  { href: '/songbook', icon: Music, label: 'Songbook', am: 'መዝሙር' },
  { href: '/attendance', icon: CalendarCheck, label: 'Events', am: 'መርሃ ግብር' },
];

/**
 * Mobile bottom nav: a floating pill. 5th tab: Admin for elevated roles,
 * Profile (their QR) for pre-members, Donate otherwise. AppShell pads <main>
 * so the pill never covers content.
 */
export function BottomNav({
  role,
  preMember = false,
}: {
  role: UserRole;
  preMember?: boolean;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const links = [
    ...MEMBER_LINKS,
    isElevated(role)
      ? { href: '/admin', icon: Shield, label: 'Admin', am: 'አስተዳዳሪ' }
      : preMember
        ? { href: '/profile', icon: User, label: 'Profile', am: 'መገለጫ' }
        : { href: '/donate', icon: Heart, label: 'Donate', am: 'መዋጮ' },
  ];

  return (
    <nav className="print:hidden pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-transparent px-2 pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-[480px] items-stretch justify-around rounded-[22px] border border-gold/[0.28] bg-gradient-to-b from-brand-mid to-brand-deep p-1 shadow-[0_14px_30px_-10px_rgba(7,43,38,0.55),0_4px_10px_-4px_rgba(7,43,38,0.35)]">
        {links.map(({ href, icon: Icon, label, am }) => {
          const active =
            pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-[3px] rounded-[17px] pb-1.5 pt-[7px] [transition:background_0.15s]',
                active && 'bg-gold/[0.16]',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  active ? 'text-gold' : 'text-cream/45',
                )}
                strokeWidth={active ? 2 : 1.6}
              />
              {/* May wrap to two lines; never truncated. */}
              <span
                className={cn(
                  'text-center leading-[1.15] tracking-normal',
                  locale === 'am'
                    ? 'font-ethiopic-sans text-[10px]'
                    : 'font-body text-[9.5px]',
                  active
                    ? 'font-semibold text-gold'
                    : 'font-medium text-cream/50',
                )}
              >
                {locale === 'am' ? am : label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
