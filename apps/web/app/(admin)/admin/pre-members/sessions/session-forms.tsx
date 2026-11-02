'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { primaryBtn, secondaryBtn } from '@/components/events/button-classes';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { closeRegistrationSession, openRegistrationSession } from './actions';

const LABEL =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep';
const FIELD =
  'h-auto rounded-[10px] border border-parchment-edge bg-parchment-soft px-3.5 py-[10px] text-[13px] text-ink focus-visible:ring-2 focus-visible:ring-gold/30 dark:bg-parchment-deep';

/** "YYYY-MM-DDTHH:mm" in Ethiopian time, `plusHours` from now. */
function eatInput(plusHours = 0): string {
  const d = new Date(Date.now() + plusHours * 3600_000 + 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** Opens a session (times in Ethiopian time), then shows its QR. */
export function OpenSessionForm() {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [label, setLabel] = useState('');
  const [opensAt, setOpensAt] = useState(() => eatInput(0));
  const [closesAt, setClosesAt] = useState(() => eatInput(3));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await openRegistrationSession({
      label,
      opensAt,
      closesAt,
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast({
        title: t('Error'),
        description: t(res?.ok === false ? res.error : 'Try again'),
        variant: 'destructive',
      });
      return;
    }
    router.push(`/admin/pre-members/sessions/${res.data.id}`);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3.5">
      <div>
        <label htmlFor="rs-label" className={LABEL}>
          {t('Name')}
        </label>
        <Input
          id="rs-label"
          required
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('e.g. Saturday class, main hall')}
          className={FIELD}
        />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="rs-opens" className={LABEL}>
            {t('Opens')}
          </label>
          <Input
            id="rs-opens"
            type="datetime-local"
            required
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className={cn(FIELD, 'font-mono')}
          />
        </div>
        <div>
          <label htmlFor="rs-closes" className={LABEL}>
            {t('Closes')}
          </label>
          <Input
            id="rs-closes"
            type="datetime-local"
            required
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className={cn(FIELD, 'font-mono')}
          />
        </div>
      </div>
      <p className="text-[11px] text-ink-muted">
        {t('Ethiopian time. You can close it early at any time.')}
      </p>
      <button
        type="submit"
        disabled={busy}
        className={cn(primaryBtn, 'w-full px-5 py-2.5 text-[13px]')}
      >
        <QrCode className="h-3.5 w-3.5 text-gold" />
        {busy ? t('Saving…') : t('Open and show QR')}
      </button>
    </form>
  );
}

/** Closes a session early (its QR stops working at once). */
export function CloseSessionButton({
  id,
  onClosed,
  className,
}: {
  id: string;
  onClosed?: () => void;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    const res = await closeRegistrationSession(id).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast({
        title: t('Error'),
        description: t(res?.ok === false ? res.error : 'Try again'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('Session closed') });
    onClosed?.();
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={close}
      disabled={busy}
      className={cn(
        secondaryBtn,
        'px-3 py-1.5 text-[12px] text-status-absent dark:text-status-absent',
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5" />
      {t('Close')}
    </button>
  );
}
