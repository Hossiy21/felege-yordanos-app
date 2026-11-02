'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Clock, Link2, XCircle } from 'lucide-react';
import { Card } from '@/components/ds';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import {
  cancelMemberLinkRequest,
  requestMemberLink,
  requestPreMemberLink,
} from './actions';

/** `memberId` is the SSU member ID, or the FYP code when `preMember`. */
export type ClaimState =
  | { kind: 'none' }
  | {
      kind: 'linked';
      memberId: string;
      preMember: boolean;
      /** Linked pre-member record that is no longer active. */
      inactive?: boolean;
    }
  | {
      kind: 'pending';
      memberId: string;
      preMember: boolean;
      requestedAt: string;
    }
  | {
      kind: 'rejected';
      memberId: string;
      preMember: boolean;
      note: string | null;
    };

/** Which record the user links to: member (SSU ID) or pre-member (FYP). */
type ClaimType = 'member' | 'pre_member';

const primaryBtn =
  'sacred-gradient flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 px-5 py-3 text-[13px] font-semibold tracking-[0.04em] text-cream shadow-fy-md transition-opacity hover:opacity-95 disabled:opacity-60';

function StatusRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 rounded-full border border-gold/30 bg-gold/10 p-2.5 text-gold-deep">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-ink">{title}</p>
        <div className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          {body}
        </div>
      </div>
    </div>
  );
}

export function ClaimForm({
  state,
  required,
}: {
  state: ClaimState;
  required: boolean;
}) {
  const [memberId, setMemberId] = useState('');
  const [type, setType] = useState<ClaimType>(
    state.kind === 'rejected' && state.preMember ? 'pre_member' : 'member',
  );
  const pre = type === 'pre_member';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await (pre
        ? requestPreMemberLink(memberId)
        : requestMemberLink(memberId));
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      toast({
        title: t('Request sent'),
        description: t('An admin will confirm it soon.'),
      });
      setMemberId('');
      router.refresh();
    } catch {
      setError(t('Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      await cancelMemberLinkRequest();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (state.kind === 'linked') {
    return (
      <Card className="p-[22px] md:p-[26px]">
        <StatusRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          title={t('Your account is linked')}
          body={
            <>
              {t(state.preMember ? 'Pre-member ID' : 'Member ID')}:{' '}
              <span className="font-mono text-ink">{state.memberId}</span>
              {state.inactive && (
                <>
                  <br />
                  {t(
                    'This pre-member record is not active. Please ask a volunteer at the desk.',
                  )}
                </>
              )}
            </>
          }
        />
        <Link href="/dashboard" className={`${primaryBtn} mt-5`}>
          {t('Go to dashboard')}
        </Link>
      </Card>
    );
  }

  if (state.kind === 'pending') {
    return (
      <Card className="p-[22px] md:p-[26px]">
        <StatusRow
          icon={<Clock className="h-4 w-4" />}
          title={t('Waiting for approval')}
          body={
            <>
              {t(state.preMember ? 'Requested pre-member ID' : 'Requested member ID')}:{' '}
              <span className="font-mono text-ink">{state.memberId}</span>
              <br />
              {state.preMember
                ? t(
                    'An admin will confirm it soon. Your events and notices open once it is approved.',
                  )
                : t(
                    'An admin will confirm it soon. Events and donations open once it is approved.',
                  )}
            </>
          }
        />
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="mt-5 w-full rounded-xl border border-parchment-edge px-5 py-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-parchment-deep hover:text-ink disabled:opacity-60"
        >
          {t('Cancel request')}
        </button>
        <div className="mt-2 text-center">
          <Link
            href="/songbook"
            className="inline-block rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-parchment-deep hover:text-ink"
          >
            {t('Open the songbook meanwhile')}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-[22px] md:p-[26px]">
      {required && (
        <p className="mb-4 rounded-[10px] bg-gold/10 px-3 py-2 text-[12.5px] text-brand-ink">
          {t('Link your member ID first to use events and donations.')}
        </p>
      )}
      {state.kind === 'rejected' && (
        <div className="mb-4">
          <StatusRow
            icon={<XCircle className="h-4 w-4" />}
            title={t('Your last request was not approved')}
            body={
              <>
                <span className="font-mono text-ink">{state.memberId}</span>
                {state.note ? <> · {t(state.note)}</> : null}
              </>
            }
          />
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={t('I am a')}
        className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-parchment-deep p-[3px]"
      >
        {(
          [
            ['member', 'I am a member'],
            ['pre_member', 'I am a ቅድመ አባል'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={type === key}
            onClick={() => {
              setType(key);
              setMemberId('');
              setError('');
            }}
            className={cn(
              'rounded-[9px] px-2 py-2.5 text-[12px] transition-colors',
              type === key
                ? 'bg-parchment-soft font-semibold text-brand-ink shadow-[0_1px_2px_rgba(10,60,54,0.08)]'
                : 'font-medium text-ink-muted hover:text-ink',
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'shrink-0 rounded-full border p-2.5',
            pre
              ? 'border-pre/30 bg-pre-bg text-pre'
              : 'border-gold/30 bg-gold/10 text-gold-deep',
          )}
        >
          <Link2 className="h-4 w-4" />
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          {pre
            ? t(
                'Enter the pre-member ID you received by email, for example FYP-2019-0001. An admin confirms the link before it becomes active.',
              )
            : t(
                'Enter your Sunday School member ID. You can type just the number, for example 42. An admin confirms the link before it becomes active.',
              )}
        </p>
      </div>

      <form onSubmit={handleRequest} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="member-id"
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
          >
            {t(pre ? 'Pre-member ID' : 'Member ID')}
          </label>
          <Input
            id="member-id"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder={t('e.g. {id}', {
              id: pre ? 'FYP-2019-0001' : '42 or ssu/01/03/05/00042',
            })}
            required
            inputMode="text"
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? 'member-id-error' : undefined}
            className="h-auto rounded-[10px] border border-solid border-parchment-edge bg-parchment-soft px-3.5 py-[11px] font-mono text-[13px] text-ink shadow-[inset_0_1px_2px_rgba(10,60,54,0.04)] placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30 md:text-[13px] dark:bg-parchment-deep dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
          />
        </div>
        {error && (
          <p
            id="member-id-error"
            role="alert"
            className="rounded-[10px] bg-status-absent-bg px-3 py-2 text-[12.5px] text-status-absent"
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className={primaryBtn}>
          <Link2 className="h-3.5 w-3.5 text-gold" />
          {loading ? t('Sending…') : t('Request link')}
        </button>
      </form>

      <div className="mt-3 text-center">
        <Link
          href="/dashboard"
          className="inline-block rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-parchment-deep hover:text-ink"
        >
          {t('Skip for now')}
        </Link>
      </div>
    </Card>
  );
}
