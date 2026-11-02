import { Card, Eyebrow } from '@/components/ds';
import { MemberQR } from '@/components/member-qr';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

/**
 * Right-column compact check-in card: QR + code. Shown for linked members
 * and for pre-members (FYP code, plum frame and ቅድመ አባል badge).
 */
export async function CheckInCard({
  memberId,
  variant = 'member',
}: {
  memberId: string;
  variant?: 'member' | 'pre_member';
}) {
  const t = await getT();
  const pre = variant === 'pre_member';
  return (
    <Card className={cn('flex items-center gap-4', pre && 'border-pre/40')}>
      <div
        className={cn(
          'shrink-0 rounded-xl border bg-parchment p-2',
          pre ? 'border-pre/50' : 'border-gold/30',
        )}
      >
        <MemberQR value={memberId} size={96} variant={variant} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Eyebrow>{t('Check-in code')}</Eyebrow>
          {pre && <PreMemberBadge />}
        </div>
        <div className="mt-1 font-mono text-lg font-semibold tracking-[0.05em] text-brand-ink">
          {memberId}
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-ink-muted">
          {t('Show this code at the door to check in.')}
        </p>
      </div>
    </Card>
  );
}
