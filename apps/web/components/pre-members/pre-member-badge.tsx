import { cn } from '@/lib/utils';

/**
 * "ቅድመ አባል" tag next to a pre-member's name (check-in lists, scan result,
 * summary). Always in Amharic, like the name of the status itself; the
 * English is in the tooltip.
 */
export function PreMemberBadge({ className }: { className?: string }) {
  return (
    <span
      title="Pre-member"
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-pre-bg px-[7px] py-px font-ethiopic text-[9.5px] font-semibold leading-[1.5] text-pre',
        className,
      )}
    >
      ቅድመ አባል
    </span>
  );
}
