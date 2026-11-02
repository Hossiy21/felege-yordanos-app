'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays, List, Repeat } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n/client';
import { RECURRENCE_LABELS, type Recurrence } from '@/lib/events';
import { cn } from '@/lib/utils';

/**
 * Small UI pieces shared by the events, check-in and member "My events"
 * screens.
 */

export type ListCalView = 'list' | 'calendar';

// Defined in a plain module so server components get the strings too
// (a 'use client' module only gives them client references).
export { primaryBtn, secondaryBtn } from './button-classes';

/**
 * List / Calendar switch. `desktop`: bordered track with a brand-filled active
 * tab. `mobile`: sunken track with a raised parchment active tab.
 */
export function ViewToggle({
  view,
  onChange,
  variant,
}: {
  view: ListCalView;
  onChange: (v: ListCalView) => void;
  variant: 'desktop' | 'mobile';
}) {
  const t = useT();
  const tabs = [
    { key: 'list' as const, label: t('List'), Icon: List },
    { key: 'calendar' as const, label: t('Calendar'), Icon: CalendarDays },
  ];
  if (variant === 'mobile') {
    return (
      <div className="flex rounded-[10px] bg-parchment-deep p-[3px]">
        {tabs.map(({ key, label, Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              className={cn(
                'flex flex-1 items-center justify-center gap-[5px] rounded-[7px] p-2 text-[11.5px] transition-colors',
                active
                  ? 'bg-parchment-soft font-semibold text-brand-ink shadow-[0_1px_2px_rgba(10,60,54,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                  : 'font-medium text-ink-muted',
              )}
            >
              <Icon
                className={cn(
                  'h-[13px] w-[13px]',
                  active ? 'text-brand dark:text-gold' : 'text-ink-muted',
                )}
              />
              {label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex gap-[3px] rounded-[10px] border border-parchment-edge bg-parchment p-[3px] dark:bg-parchment-deep">
      {tabs.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-[5px] whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
              active
                ? 'bg-brand text-cream shadow-[0_3px_8px_-3px_rgba(10,60,54,0.5)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            <Icon
              className={cn('h-3 w-3', active ? 'text-gold' : 'text-ink-muted')}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Gold tag with the department's short name. */
export function DeptChip({ label, title }: { label: string; title?: string }) {
  const locale = useLocale();
  return (
    <span
      title={title}
      className={cn(
        'w-fit max-w-full truncate whitespace-nowrap rounded-[4px] bg-gold/[0.12] px-2 py-0.5 text-[11px] text-gold-deep dark:bg-gold/[0.14]',
        locale === 'am' ? 'font-ethiopic' : 'font-body font-medium',
      )}
    >
      {label}
    </span>
  );
}

/** "↻ Weekly" marker next to a recurring event's title. */
export function RecurBadge({ recurrence }: { recurrence: string | null }) {
  const t = useT();
  if (!recurrence) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-[3px] text-[9px] font-semibold text-gold-deep">
      <Repeat className="h-[9px] w-[9px]" />
      {t(RECURRENCE_LABELS[recurrence as Recurrence] ?? 'Repeats')}
    </span>
  );
}

/** Gold back link at the top of phone screens. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-deep transition-colors hover:text-brand dark:hover:text-gold-light"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

/** Uppercase gold section label used on phone lists. */
export function ListLabel({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-baseline justify-between', className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-deep">
        {children}
      </div>
      {right && (
        <span className="font-mono text-[10px] text-ink-muted">{right}</span>
      )}
    </div>
  );
}
