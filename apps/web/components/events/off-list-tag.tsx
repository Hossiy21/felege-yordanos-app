'use client';

import { useLocale, useT } from '@/lib/i18n/client';
import { OFF_LIST_LABEL, type OffListReason } from '@/lib/event-people';
import { cn } from '@/lib/utils';

/**
 * Tag next to someone on an event's list who is not expected any more but has
 * a mark (lib/event-people.ts): "Now a member", "Withdrawn"…
 */
export function OffListTag({
  reason,
  className,
}: {
  reason: OffListReason;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-parchment-edge-strong px-[7px] py-px text-[9.5px] font-semibold leading-[1.5] text-ink-muted',
        locale === 'am' ? 'font-ethiopic' : 'font-body',
        className,
      )}
    >
      {t(OFF_LIST_LABEL[reason])}
    </span>
  );
}
