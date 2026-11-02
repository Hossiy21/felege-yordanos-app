import type { PreMemberStatus } from '@felege-yordanos/db/schema';
import { StatusPill, type StatusTone } from '@/components/ds';
import { getT } from '@/lib/i18n/server';
import { PRE_MEMBER_STATUS_LABEL } from '@/lib/pre-members';

const TONE: Record<PreMemberStatus, StatusTone> = {
  pending: 'pending',
  active: 'present',
  rejected: 'rejected',
  withdrawn: 'neutral',
  promoted: 'upcoming',
};

/** Status of a pre-member record (server component). */
export async function PreMemberStatusPill({
  status,
  className,
}: {
  status: PreMemberStatus;
  className?: string;
}) {
  const t = await getT();
  return (
    <StatusPill tone={TONE[status]} className={className}>
      {t(PRE_MEMBER_STATUS_LABEL[status])}
    </StatusPill>
  );
}
