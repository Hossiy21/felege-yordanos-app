'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionHeader } from '@/components/ds';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import {
  PRE_MEMBER_FIELD_LABEL,
  PRE_MEMBER_FIELDS,
  type PreMemberField,
} from '@/lib/pre-member-schema';
import { cn } from '@/lib/utils';
import { updateMyPreMemberDetails } from './actions';

const LABEL =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep';
const FIELD =
  'h-auto rounded-[10px] border border-parchment-edge bg-parchment-soft px-3.5 py-[11px] text-[13px] text-ink focus-visible:ring-2 focus-visible:ring-gold/30 md:text-[13px] dark:bg-parchment-deep';

const TYPE: Partial<Record<PreMemberField, string>> = {
  email: 'email',
  phone: 'tel',
};

/**
 * A pre-member's own details (names, email, phone; all required). Saving
 * logs the change in their history, which admins see.
 */
export function PreMemberDetailsForm({
  initial,
}: {
  initial: Record<PreMemberField, string>;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = PRE_MEMBER_FIELDS.some((f) => values[f] !== initial[f]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateMyPreMemberDetails(values).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      toast({
        title: t('Error'),
        description: t(res?.ok === false ? res.error : 'Try again'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('Saved'), description: t('Your details were updated.') });
    router.refresh();
  }

  return (
    <Card className="mt-4 p-[22px] md:mt-4 md:p-[26px]">
      <SectionHeader en="My details" am="የእኔ መረጃ" />
      <p className="mt-1 text-[11.5px] text-ink-muted">
        {t('As registered for your pre-member ID. Changes are recorded.')}
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3.5 md:grid-cols-2"
      >
        {PRE_MEMBER_FIELDS.map((f) => (
          <div key={f}>
            <label htmlFor={`me-${f}`} className={LABEL}>
              {t(PRE_MEMBER_FIELD_LABEL[f])}
            </label>
            <Input
              id={`me-${f}`}
              required
              type={TYPE[f] ?? 'text'}
              maxLength={f === 'email' ? 254 : 60}
              value={values[f]}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              className={cn(
                FIELD,
                f === 'phone' && 'font-mono',
                !TYPE[f] && 'font-ethiopic',
              )}
            />
          </div>
        ))}
        <div className="flex items-end md:col-span-2">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="sacred-gradient w-full rounded-xl border border-gold/40 py-2.5 text-[13px] font-semibold text-cream shadow-fy-md transition-opacity hover:opacity-95 disabled:opacity-60 md:w-auto md:px-6"
          >
            {saving ? t('Saving…') : t('Save changes')}
          </button>
        </div>
      </form>
    </Card>
  );
}
