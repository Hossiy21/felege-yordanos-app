'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import { requestPreMemberLink } from '../../claim/actions';

/** One tap: asks an admin to link the suggested pre-member record (#139). */
export function RequestSuggestedLink({
  code,
  className,
}: {
  code: string;
  className: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await requestPreMemberLink(code);
      if (!res.ok) {
        toast({
          title: t('Error'),
          description: t(res.error),
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: t('Request sent'),
        description: t('An admin will confirm it soon.'),
      });
      router.refresh();
    } catch {
      toast({
        title: t('Error'),
        description: t('Something went wrong. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      <Link2 className="h-3 w-3 text-gold" />
      {loading ? t('Sending…') : t('Request link')}
    </button>
  );
}
