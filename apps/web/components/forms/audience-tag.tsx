'use client';

import { AUDIENCE_TAG, type Audience } from '@/lib/audience';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** Plum tag on events and notices that are not for members only. */
export function AudienceTag({
  audience,
  className,
}: {
  audience: Audience;
  className?: string;
}) {
  const t = useT();
  const label = AUDIENCE_TAG[audience];
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-pre-bg px-2 py-[3px] text-[10.5px] font-semibold text-pre',
        className,
      )}
    >
      {t(label)}
    </span>
  );
}
