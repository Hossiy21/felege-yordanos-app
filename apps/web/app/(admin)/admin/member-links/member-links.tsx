'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Link2, Search, Unlink, X } from 'lucide-react';
import { Card, Chip } from '@/components/ds';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLocale, useT } from '@/lib/i18n/client';
import { intlLocale } from '@/lib/i18n/config';
import { MEMBER_ID_PREFIX } from '@/lib/member-id';
import { cn } from '@/lib/utils';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import {
  approveLinkRequest,
  linkAccountDirect,
  rejectLinkRequest,
  unlinkAccount,
} from './actions';

export interface PendingRow {
  requestId: string;
  requestedAt: string;
  userId: string;
  accountName: string | null;
  email: string;
  memberId: string;
  memberName: string;
  phoneLast4: string | null;
  gender: string | null;
  /** The request is for a pre-member record (FYP code). */
  preMember: boolean;
}
export interface UnlinkedRow {
  userId: string;
  accountName: string | null;
  email: string;
  createdAt: string;
}
export interface LinkedRow {
  userId: string;
  accountName: string | null;
  email: string;
  memberId: string;
}

type Tab = 'pending' | 'unlinked' | 'linked';

const SEARCH_INPUT =
  'h-auto rounded-[10px] border border-solid border-parchment-edge bg-parchment-soft py-[9px] pl-[34px] pr-3 text-[12.5px] text-ink md:text-[12.5px] placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30';
const SMALL_INPUT =
  'h-auto rounded-[10px] border border-solid border-parchment-edge bg-parchment-soft px-3 py-2 font-mono text-[12.5px] text-ink md:text-[12.5px] placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30';
const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition-opacity disabled:opacity-50';
const PRIMARY = cn(
  BTN,
  'sacred-gradient border border-gold/40 text-cream hover:opacity-95',
);
const SECONDARY = cn(
  BTN,
  'border border-parchment-edge bg-parchment-soft text-ink hover:bg-parchment-deep',
);

const matches = (q: string, ...fields: (string | null)[]) =>
  !q || fields.some((f) => (f ?? '').toLowerCase().includes(q));

export function MemberLinks({
  pending,
  unlinked,
  linked,
}: {
  pending: PendingRow[];
  unlinked: UnlinkedRow[];
  linked: LinkedRow[];
}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [directIds, setDirectIds] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();
  const locale = useLocale();

  const q = search.trim().toLowerCase();
  const shown = useMemo(
    () => ({
      pending: pending.filter((r) =>
        matches(q, r.accountName, r.email, r.memberId, r.memberName),
      ),
      unlinked: unlinked.filter((r) => matches(q, r.accountName, r.email)),
      linked: linked.filter((r) =>
        matches(q, r.accountName, r.email, r.memberId),
      ),
    }),
    [q, pending, unlinked, linked],
  );

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(key);
    try {
      const res = await action();
      if (!res.ok) {
        toast({
          title: t('Error'),
          description: t(
            res.error ?? 'Something went wrong. Please try again.',
          ),
          variant: 'destructive',
        });
        return false;
      }
      toast({ title: t(success) });
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const fmt = (iso: string) =>
    iso
      ? new Date(iso).toLocaleString(intlLocale(locale), {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';

  const who = (name: string | null, email: string) => (
    <div className="min-w-0">
      <p className="truncate text-[13.5px] font-semibold text-brand-ink">
        {name || email}
      </p>
      <p className="truncate text-[11.5px] text-ink-muted">{email}</p>
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={tab === 'pending'} onClick={() => setTab('pending')}>
          {t('Requests')} ({pending.length})
        </Chip>
        <Chip active={tab === 'unlinked'} onClick={() => setTab('unlinked')}>
          {t('Not linked')} ({unlinked.length})
        </Chip>
        <Chip active={tab === 'linked'} onClick={() => setTab('linked')}>
          {t('Linked')} ({linked.length})
        </Chip>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search name, email or member ID')}
            className={SEARCH_INPUT}
          />
        </div>
      </div>

      {tab === 'pending' && (
        <div className="space-y-3">
          {shown.pending.length === 0 && (
            <Card className="p-6 text-center text-sm text-ink-muted">
              {t('No open requests.')}
            </Card>
          )}
          {shown.pending.map((r) => (
            <Card key={r.requestId} className="p-4 md:p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                    {t('Account')}
                  </p>
                  {who(r.accountName, r.email)}
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {fmt(r.requestedAt)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                    {t('Requested member ID')}
                  </p>
                  <p className="inline-flex max-w-full rounded-[10px] border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[15px] text-brand-ink md:text-[16px]">
                    {r.memberId.startsWith(MEMBER_ID_PREFIX) ? (
                      <>
                        <span className="text-ink-muted">
                          {MEMBER_ID_PREFIX}
                        </span>
                        <span className="font-semibold">
                          {r.memberId.slice(MEMBER_ID_PREFIX.length)}
                        </span>
                      </>
                    ) : (
                      <span className="truncate font-semibold">
                        {r.memberId}
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 text-[11.5px] text-ink-muted">
                    <span className="font-ethiopic font-semibold text-ink">
                      {r.memberName}
                    </span>
                    {r.phoneLast4 && (
                      <>
                        {' · '}
                        {t('phone ends in')}{' '}
                        <span className="font-mono">{r.phoneLast4}</span>
                      </>
                    )}
                    {r.gender && <> · {r.gender}</>}
                    {r.preMember && <PreMemberBadge className="ml-1.5" />}
                  </p>
                </div>
                <div className="flex gap-2 md:justify-end">
                  <button
                    type="button"
                    className={PRIMARY}
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        r.requestId,
                        () => approveLinkRequest(r.requestId),
                        'Linked',
                      )
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('Approve')}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY}
                    disabled={busy !== null}
                    onClick={() => {
                      setRejecting(
                        rejecting === r.requestId ? null : r.requestId,
                      );
                      setNote('');
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('Reject')}
                  </button>
                </div>
              </div>
              {rejecting === r.requestId && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={note}
                    maxLength={200}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('Reason shown to the member (optional)')}
                    className={cn(SMALL_INPUT, 'font-body')}
                  />
                  <button
                    type="button"
                    className={SECONDARY}
                    disabled={busy !== null}
                    onClick={async () => {
                      const done = await run(
                        r.requestId,
                        () =>
                          rejectLinkRequest({
                            requestId: r.requestId,
                            note: note || undefined,
                          }),
                        'Request rejected',
                      );
                      if (done) setRejecting(null);
                    }}
                  >
                    {t('Confirm reject')}
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'unlinked' && (
        <div className="space-y-3">
          <p className="text-[12px] text-ink-muted">
            {t(
              'Accounts without a member link and without a request. Link one by typing the member ID (the number is enough).',
            )}
          </p>
          {shown.unlinked.length === 0 && (
            <Card className="p-6 text-center text-sm text-ink-muted">
              {t('Every account is linked or has a request.')}
            </Card>
          )}
          {shown.unlinked.map((r) => (
            <Card key={r.userId} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  {who(r.accountName, r.email)}
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {t('Signed up')} {fmt(r.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={directIds[r.userId] ?? ''}
                    onChange={(e) =>
                      setDirectIds((d) => ({
                        ...d,
                        [r.userId]: e.target.value,
                      }))
                    }
                    aria-label={t('Member ID')}
                    placeholder={`${MEMBER_ID_PREFIX}00042`}
                    className={cn(
                      SMALL_INPUT,
                      'min-w-0 flex-1 sm:w-52 sm:flex-none',
                    )}
                  />
                  <button
                    type="button"
                    className={PRIMARY}
                    disabled={
                      busy !== null || !(directIds[r.userId] ?? '').trim()
                    }
                    onClick={() =>
                      run(
                        r.userId,
                        () =>
                          linkAccountDirect({
                            userId: r.userId,
                            memberId: directIds[r.userId] ?? '',
                          }),
                        'Linked',
                      )
                    }
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {t('Link')}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'linked' && (
        <div className="space-y-2">
          {shown.linked.length === 0 && (
            <Card className="p-6 text-center text-sm text-ink-muted">
              {t('No linked accounts yet.')}
            </Card>
          )}
          {shown.linked.map((r) => (
            <Card key={r.userId} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                {who(r.accountName, r.email)}
              </div>
              <span className="hidden font-mono text-[12px] text-ink-muted sm:inline">
                {r.memberId}
              </span>
              <button
                type="button"
                className={SECONDARY}
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm(t('Remove this member link?'))) return;
                  void run(
                    r.userId,
                    () => unlinkAccount(r.userId),
                    'Link removed',
                  );
                }}
              >
                <Unlink className="h-3.5 w-3.5" />
                {t('Unlink')}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
