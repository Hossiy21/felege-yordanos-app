'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { primaryBtn } from '@/components/events/button-classes';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { promotePreMember } from '../../actions';

/** Confirms the promotion (one transaction on the server). */
export function PromoteButton({
  id,
  memberRecordId,
  memberId,
}: {
  id: number;
  memberRecordId: number;
  memberId: string;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function promote() {
    setBusy(true);
    const res = await promotePreMember({ id, memberRecordId }).catch(
      () => null,
    );
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
      title: t('Promoted to member'),
      description: res.data.emailed
        ? t('{id} · email sent', { id: res.data.memberId })
        : res.data.memberId,
    });
    router.push(`/admin/pre-members/${id}`);
  }

  return (
    <button
      type="button"
      onClick={promote}
      disabled={busy}
      className={cn(primaryBtn, 'mt-4 w-full px-5 py-3 text-[13px]')}
    >
      <ArrowUpRight className="h-4 w-4 text-gold" />
      {busy ? t('Saving…') : t('Promote to {id}', { id: memberId })}
    </button>
  );
}
