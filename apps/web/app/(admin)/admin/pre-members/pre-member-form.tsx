'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { primaryBtn, secondaryBtn } from '@/components/events/event-ui';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import {
  PRE_MEMBER_FIELD_LABEL,
  type PreMemberField,
} from '@/lib/pre-member-schema';
import { cn } from '@/lib/utils';
import { createPreMember, updatePreMember } from './actions';

type Values = Record<PreMemberField, string>;

const LABEL =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep';
const FIELD =
  'h-auto rounded-[10px] border border-parchment-edge bg-parchment-soft px-3.5 py-[11px] text-[13.5px] text-ink placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30 dark:bg-parchment-deep';

const INPUT_PROPS: Record<
  PreMemberField,
  React.InputHTMLAttributes<HTMLInputElement>
> = {
  name: { autoComplete: 'off' },
  fatherName: { autoComplete: 'off' },
  grandfatherName: { autoComplete: 'off' },
  email: { type: 'email', inputMode: 'email', autoComplete: 'off' },
  phone: { type: 'tel', inputMode: 'tel', autoComplete: 'off' },
};

/**
 * Admin form for a pre-member's names, email and phone. New records can be
 * approved on the spot; edits are logged in the history with old -> new.
 */
export function PreMemberForm({
  mode,
  id,
  initial,
  onDone,
}: {
  mode: 'create' | 'edit';
  id?: number;
  initial?: Partial<Values>;
  /** Edit: close the dialog or panel after saving. */
  onDone?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Values>({
    name: initial?.name ?? '',
    fatherName: initial?.fatherName ?? '',
    grandfatherName: initial?.grandfatherName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
  });
  const [approveNow, setApproveNow] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'create') {
        const res = await createPreMember({ ...values, approveNow });
        if (!res.ok) throw new Error(res.error);
        toast({
          title: t('Pre-member registered'),
          description: res.data.code ?? t('Waiting for approval'),
        });
        router.push(`/admin/pre-members/${res.data.id}`);
      } else if (id) {
        const res = await updatePreMember(id, values);
        if (!res.ok) throw new Error(res.error);
        toast({ title: t('Saved') });
        onDone?.();
        router.refresh();
      }
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="grid gap-3.5 md:grid-cols-3">
        {(['name', 'fatherName', 'grandfatherName'] as const).map((f) => (
          <div key={f}>
            <label htmlFor={`pm-${f}`} className={LABEL}>
              {t(PRE_MEMBER_FIELD_LABEL[f])}
            </label>
            <Input
              id={`pm-${f}`}
              required
              maxLength={60}
              value={values[f]}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              className={cn(FIELD, 'font-ethiopic')}
              {...INPUT_PROPS[f]}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-3.5 md:grid-cols-2">
        {(['phone', 'email'] as const).map((f) => (
          <div key={f}>
            <label htmlFor={`pm-${f}`} className={LABEL}>
              {t(PRE_MEMBER_FIELD_LABEL[f])}{' '}
              <span className="font-normal normal-case tracking-normal text-ink-faint">
                · {t('optional')}
              </span>
            </label>
            <Input
              id={`pm-${f}`}
              value={values[f]}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              placeholder={f === 'phone' ? '09…' : 'name@example.com'}
              className={cn(FIELD, f === 'phone' && 'font-mono')}
              {...INPUT_PROPS[f]}
            />
          </div>
        ))}
      </div>

      {mode === 'create' && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-parchment-edge bg-parchment px-3.5 py-3 dark:bg-parchment-deep">
          <input
            type="checkbox"
            checked={approveNow}
            onChange={(e) => setApproveNow(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--fy-brand))]"
          />
          <span className="text-[12.5px] leading-snug text-ink">
            <span className="font-semibold">{t('Approve now')}</span>
            <span className="block text-[11.5px] text-ink-muted">
              {t(
                'The ID (FYP-…) is assigned at once. Untick to approve later.',
              )}
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className={cn(primaryBtn, 'px-5 py-2.5 text-[13px]')}
        >
          <Check className="h-3.5 w-3.5 text-gold" />
          {busy
            ? t('Saving…')
            : mode === 'create'
              ? t('Register')
              : t('Save changes')}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className={secondaryBtn}>
            {t('Cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
