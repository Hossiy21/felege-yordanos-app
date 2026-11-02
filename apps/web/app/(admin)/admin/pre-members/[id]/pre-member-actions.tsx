'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  Pencil,
  RotateCcw,
  Undo2,
  Unlink,
  UserMinus,
  X,
} from 'lucide-react';
import type { PreMemberStatus } from '@felege-yordanos/db/schema';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { primaryBtn, secondaryBtn } from '@/components/events/button-classes';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import type { PreMemberField } from '@/lib/pre-member-schema';
import { cn } from '@/lib/utils';
import type { ActionResult } from '@/lib/action-result';
import {
  approvePreMember,
  reinstatePreMember,
  rejectPreMember,
  undoPromotion,
  unlinkPreMemberAccount,
  withdrawPreMember,
} from '../actions';
import { PreMemberForm } from '../pre-member-form';

type Confirm = {
  title: string;
  body: string;
  confirmLabel: string;
  /** Ask for an optional note (reject, withdraw). */
  note?: boolean;
  danger?: boolean;
  run: (note: string) => Promise<ActionResult<unknown>>;
  done: string;
};

const dangerBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-status-absent px-5 py-3 text-[13px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-40';

/**
 * What an admin can do with a pre-member, by status. Every action is checked
 * again on the server (canManagePreMembers) and logged in the history.
 */
export function PreMemberActions({
  id,
  status,
  name,
  linked,
  canPromote,
  initial,
}: {
  id: number;
  status: PreMemberStatus;
  name: string;
  linked: boolean;
  /** Promote and undo promotion (canPromotePreMembers). */
  canPromote: boolean;
  initial: Record<PreMemberField, string>;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function run(c: Confirm) {
    setBusy(true);
    try {
      const res = await c.run(note);
      if (!res.ok) throw new Error(res.error);
      toast({ title: t(c.done), description: name });
      setConfirm(null);
      setNote('');
      router.refresh();
    } catch (err) {
      toast({
        title: t('Error'),
        description: t(err instanceof Error ? err.message : 'Try again'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    const res = await approvePreMember(id).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast({
        title: t('Error'),
        description: t(res?.ok === false ? res.error : 'Try again'),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: t('Approved'),
      description: res.data.emailed
        ? t('ID {code} · email sent', { code: res.data.code })
        : t('ID {code}', { code: res.data.code }),
    });
    router.refresh();
  }

  const btn = cn(secondaryBtn, 'px-3 py-2 text-[12px]');

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'pending' && (
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className={cn(primaryBtn, 'px-4 py-2 text-[12.5px]')}
        >
          <Check className="h-3.5 w-3.5 text-gold" />
          {t('Approve')}
        </button>
      )}
      {status === 'pending' && (
        <button
          type="button"
          className={cn(btn, 'text-status-absent dark:text-status-absent')}
          onClick={() =>
            setConfirm({
              title: t('Reject this registration?'),
              body: t('No ID is given. You can reinstate it later.'),
              confirmLabel: t('Reject'),
              note: true,
              danger: true,
              run: (n) => rejectPreMember({ id, note: n }),
              done: 'Rejected',
            })
          }
        >
          <X className="h-3.5 w-3.5" />
          {t('Reject')}
        </button>
      )}
      {canPromote && (status === 'active' || status === 'withdrawn') && (
        <Link
          href={`/admin/pre-members/${id}/promote`}
          className={cn(primaryBtn, 'px-4 py-2 text-[12.5px]')}
        >
          <ArrowUpRight className="h-3.5 w-3.5 text-gold" />
          {t('Promote')}
        </Link>
      )}
      {canPromote && status === 'promoted' && (
        <button
          type="button"
          className={btn}
          onClick={() =>
            setConfirm({
              title: t('Undo the promotion?'),
              body: t(
                'The record goes back to active with its FYP ID and QR. Only the account link the promotion made is removed.',
              ),
              confirmLabel: t('Undo promotion'),
              danger: true,
              run: () => undoPromotion(id),
              done: 'Promotion undone',
            })
          }
        >
          <Undo2 className="h-3.5 w-3.5" />
          {t('Undo promotion')}
        </button>
      )}
      {status !== 'promoted' && (
        <button type="button" className={btn} onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          {t('Edit')}
        </button>
      )}
      {status === 'active' && linked && (
        <button
          type="button"
          className={btn}
          onClick={() =>
            setConfirm({
              title: t('Unlink the account?'),
              body: t(
                'The person keeps their ID and QR but can no longer use the app with this account.',
              ),
              confirmLabel: t('Unlink'),
              run: () => unlinkPreMemberAccount(id),
              done: 'Account unlinked',
            })
          }
        >
          <Unlink className="h-3.5 w-3.5" />
          {t('Unlink account')}
        </button>
      )}
      {status === 'active' && (
        <button
          type="button"
          className={cn(btn, 'text-status-absent dark:text-status-absent')}
          onClick={() =>
            setConfirm({
              title: t('Withdraw this pre-member?'),
              body: t(
                'Their QR stops working and they lose access to the app. You can reinstate them later.',
              ),
              confirmLabel: t('Withdraw'),
              note: true,
              danger: true,
              run: (n) => withdrawPreMember({ id, note: n }),
              done: 'Withdrawn',
            })
          }
        >
          <UserMinus className="h-3.5 w-3.5" />
          {t('Withdraw')}
        </button>
      )}
      {(status === 'withdrawn' || status === 'rejected') && (
        <button
          type="button"
          className={btn}
          onClick={() =>
            setConfirm({
              title: t('Reinstate?'),
              body:
                status === 'withdrawn'
                  ? t('Back to active, with the same ID and QR.')
                  : t('Back to pending, to be approved again.'),
              confirmLabel: t('Reinstate'),
              run: () => reinstatePreMember(id),
              done: 'Reinstated',
            })
          }
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('Reinstate')}
        </button>
      )}

      {/* Confirm (with an optional note) */}
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setNote('');
          }
        }}
      >
        <DialogContent className="gap-0 rounded-xl border-parchment-edge bg-parchment p-6 sm:max-w-[420px]">
          <DialogTitle className="font-display text-2xl font-medium leading-[1.1] text-brand-ink">
            {confirm?.title}
          </DialogTitle>
          <DialogDescription className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
            <span className="font-ethiopic font-semibold text-ink">{name}</span>
            <br />
            {confirm?.body}
          </DialogDescription>
          {confirm?.note && (
            <div className="mt-4">
              <label
                htmlFor="pm-note"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
              >
                {t('Note')} · {t('optional')}
              </label>
              <Textarea
                id="pm-note"
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-[10px] border-parchment-edge bg-parchment-soft text-[13px] dark:bg-parchment-deep"
              />
            </div>
          )}
          <div className="mt-5 flex gap-2.5">
            <DialogClose
              type="button"
              className="flex-1 rounded-xl border border-parchment-edge bg-parchment-soft py-3 text-[13px] font-semibold text-brand transition-colors hover:bg-parchment-deep dark:text-gold-light"
            >
              {t('Cancel')}
            </DialogClose>
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm && run(confirm)}
              className={cn(
                confirm?.danger
                  ? dangerBtn
                  : cn(primaryBtn, 'px-5 py-3 text-[13px]'),
                'flex-[1.4]',
              )}
            >
              {busy ? t('Saving…') : confirm?.confirmLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border-parchment-edge bg-parchment p-6 sm:max-w-[640px]">
          <DialogTitle className="font-display text-2xl font-medium text-brand-ink">
            {t('Edit details')}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-ink-muted">
            {t('Changes are recorded in the history (old → new).')}
          </DialogDescription>
          <div className="mt-3">
            <PreMemberForm
              mode="edit"
              id={id}
              initial={initial}
              onDone={() => setEditing(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
