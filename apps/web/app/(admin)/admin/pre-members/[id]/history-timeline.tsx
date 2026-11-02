import type { PreMemberAction } from '@felege-yordanos/db/schema';
import { getLocale, getT } from '@/lib/i18n/server';
import type { HistoryEntry } from '@/lib/pre-member-queries';
import {
  PRE_MEMBER_FIELD_LABEL,
  type PreMemberField,
} from '@/lib/pre-member-schema';
import { cn } from '@/lib/utils';
import { formatDateTime } from '../format';

const ACTION_LABEL: Record<PreMemberAction, string> = {
  submitted: 'Self-registered',
  created: 'Registered by an admin',
  approved: 'Approved',
  rejected: 'Rejected',
  edited: 'Details changed',
  linked: 'Account linked',
  unlinked: 'Account unlinked',
  promoted: 'Promoted to member',
  promotion_undone: 'Promotion undone',
  withdrawn: 'Withdrawn',
  reinstated: 'Reinstated',
};

const DOT: Partial<Record<PreMemberAction, string>> = {
  approved: 'bg-status-present',
  promoted: 'bg-gold',
  rejected: 'bg-status-absent',
  withdrawn: 'bg-status-absent',
  promotion_undone: 'bg-status-late',
};

const str = (v: unknown) => (typeof v === 'string' ? v : null);

/**
 * The append-only history of a pre-member: what happened, who did it and
 * when (Ethiopian time), oldest first.
 */
export async function HistoryTimeline({
  entries,
}: {
  entries: HistoryEntry[];
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const detailLines = (e: HistoryEntry): string[] => {
    const d = e.details;
    const one = (v: string | null) => (v ? [v] : []);
    switch (e.action) {
      case 'approved': {
        const code = str(d.code);
        return code ? [t('ID {code}', { code })] : [];
      }
      case 'promoted': {
        const id = str(d.memberCode);
        return id ? [t('Member ID {id}', { id })] : [];
      }
      case 'rejected':
      case 'withdrawn':
        return one(str(d.note));
      case 'linked':
        return one(str(d.email));
      case 'submitted':
        return one(str(d.sessionLabel));
      case 'reinstated': {
        const to = str(d.to);
        return to
          ? [
              t('Back to {status}', {
                status: t(to === 'active' ? 'Active' : 'Pending'),
              }),
            ]
          : [];
      }
      case 'edited': {
        const changes = (d.changes ?? {}) as Partial<
          Record<PreMemberField, { from: string | null; to: string | null }>
        >;
        return Object.entries(changes).map(
          ([field, c]) =>
            `${t(PRE_MEMBER_FIELD_LABEL[field as PreMemberField] ?? field)}: ${c?.from ?? '—'} → ${c?.to ?? '—'}`,
        );
      }
      default:
        return [];
    }
  };

  if (entries.length === 0)
    return <p className="mt-3 text-[12px] text-ink-muted">—</p>;

  return (
    <ol className="mt-3">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < entries.length - 1 && (
            <span
              aria-hidden
              className="absolute left-[4.5px] top-3 h-full w-px bg-parchment-edge"
            />
          )}
          <span
            aria-hidden
            className={cn(
              'relative mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full border-2 border-parchment-soft',
              DOT[e.action] ?? 'bg-brand dark:bg-gold',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] font-semibold text-ink">
                {t(ACTION_LABEL[e.action])}
              </span>
              <span className="font-mono text-[10.5px] text-ink-muted">
                {formatDateTime(e.at, locale)}
              </span>
            </div>
            <div className="text-[11.5px] text-ink-muted">
              {e.actorName
                ? t('by {name}', { name: e.actorName })
                : e.action === 'submitted'
                  ? t('through the registration QR')
                  : t('by the pre-member')}
            </div>
            {detailLines(e).map((line, j) => (
              <div
                key={j}
                className="mt-0.5 break-words font-ethiopic text-[11.5px] text-ink"
              >
                {line}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
