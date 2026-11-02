import Link from 'next/link';
import { ArrowRight, CalendarCheck, Heart, Megaphone, Music } from 'lucide-react';
import { SectionHeader } from '@/components/ds';
import { getLocale, getT } from '@/lib/i18n/server';
import { bilingual } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { formatNumber } from '../format';

/**
 * Phone-only quick action tiles. Pre-members get Notices instead of Donate
 * (donations are for members).
 */
export async function QuickActions({
  songCount,
  preMember = false,
}: {
  songCount: number;
  preMember?: boolean;
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const am = locale === 'am';
  const songbook = bilingual(locale, 'Songbook', 'መዝሙር');
  const tiles = [
    {
      href: '/attendance',
      icon: CalendarCheck,
      ...bilingual(locale, 'Attendance', 'ክትትል'),
    },
    preMember
      ? {
          href: '/notices',
          icon: Megaphone,
          ...bilingual(locale, 'Notices', 'ማስታወቂያ'),
        }
      : { href: '/donate', icon: Heart, ...bilingual(locale, 'Donate', 'መዋጮ') },
  ];

  return (
    <section className="mt-[18px]">
      <SectionHeader en="Quick actions" am="ፈጣን መዳረሻዎች" />
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Link
          href="/songbook"
          className="relative col-span-2 flex items-center gap-3.5 overflow-hidden rounded-2xl border border-parchment-edge bg-parchment-soft px-[18px] py-4 shadow-[0_1px_0_rgba(10,60,54,0.04),0_4px_12px_-6px_rgba(10,60,54,0.10)] transition-transform hover:-translate-y-0.5 dark:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.35)]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-deep shadow-fy-gold dark:to-[rgb(164_122_24)]">
            <Music className="h-5 w-5 text-cream" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <h3
                className={cn(
                  'leading-none text-brand-ink',
                  am
                    ? 'font-ethiopic text-lg font-semibold'
                    : 'font-display text-xl font-medium',
                )}
              >
                {songbook.primary}
              </h3>
              <span
                className={cn(
                  'text-[13px] text-gold-deep',
                  am ? 'font-display italic' : 'font-ethiopic',
                )}
              >
                · {songbook.secondary}
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] text-ink-muted">
              {t('Lyrics & recordings')} · {formatNumber(songCount, locale)}{' '}
              {t('songs')}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-gold-deep" />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-2 -right-2 font-ethiopic text-[60px] leading-none text-gold/[0.06]"
          >
            ✣
          </span>
        </Link>

        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex aspect-square flex-col justify-between rounded-2xl border border-parchment-edge bg-parchment-soft p-3.5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand/[0.08] dark:bg-gold/[0.12]">
                <Icon
                  className="h-[18px] w-[18px] text-brand dark:text-gold"
                  strokeWidth={1.75}
                />
              </div>
              <div>
                <h4
                  className={cn(
                    'mb-1 leading-none text-brand-ink',
                    am
                      ? 'font-ethiopic text-[17px] font-semibold'
                      : 'font-display text-[19px] font-medium',
                  )}
                >
                  {tile.primary}
                </h4>
                <p
                  className={cn(
                    'text-[11px] tracking-[0.04em] text-gold-deep',
                    am ? 'font-display text-xs italic' : 'font-ethiopic',
                  )}
                >
                  {tile.secondary}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
