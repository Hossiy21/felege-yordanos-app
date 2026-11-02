'use client';

import { AUDIENCE_LABEL, AUDIENCES, type Audience } from '@/lib/audience';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** One-line help per audience (who sees it, who is expected). */
const HINT: Record<Audience, string> = {
  members: 'Registered members only.',
  pre_members: 'Pre-members (ቅድመ አባላት) only.',
  everyone: 'Members and pre-members.',
};

/**
 * "Who is it for?": members, pre-members or everyone. Shared by the event
 * and notice forms (events.audience, notices.audience).
 */
export function AudienceField({
  value,
  onChange,
  labelClassName,
}: {
  value: Audience;
  onChange: (a: Audience) => void;
  labelClassName?: string;
}) {
  const t = useT();
  return (
    <div>
      <div
        id="audience-label"
        className={cn(
          'mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep',
          labelClassName,
        )}
      >
        {t('Who is it for?')}
      </div>
      <div
        role="radiogroup"
        aria-labelledby="audience-label"
        className="grid grid-cols-3 gap-1 rounded-[10px] bg-parchment-deep p-[3px]"
      >
        {AUDIENCES.map((a) => {
          const active = value === a;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(a)}
              className={cn(
                'rounded-lg px-2 py-2 text-[12px] transition-colors',
                active
                  ? a === 'members'
                    ? 'bg-parchment-soft font-semibold text-brand-ink shadow-[0_1px_2px_rgba(10,60,54,0.08)]'
                    : 'bg-pre-mid font-semibold text-cream shadow-[0_1px_2px_rgba(10,60,54,0.12)]'
                  : 'font-medium text-ink-muted hover:text-ink',
              )}
            >
              {t(AUDIENCE_LABEL[a])}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted">{t(HINT[value])}</p>
    </div>
  );
}
