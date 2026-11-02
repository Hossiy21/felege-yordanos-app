'use client';

import { useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { MemberQR } from '@/components/member-qr';
import { useToast } from '@/hooks/use-toast';
import { useLocale, useT } from '@/lib/i18n/client';
import { bilingual } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';

const ACTION =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-gold/35 px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60';

/**
 * Phone check-in card: QR on the sacred gradient with save and share.
 * `pre_member`: the ቅድመ አባል card (FYP code), a plum band and label so it is
 * told apart from a member card at a glance.
 */
export function MemberQRCard({
  memberId,
  variant = 'member',
}: {
  memberId: string;
  variant?: 'member' | 'pre_member';
}) {
  const pre = variant === 'pre_member';
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const { toast } = useToast();
  const t = useT();
  const locale = useLocale();
  const hint = bilingual(
    locale,
    'Show this code at the door to check in',
    'ይህን ኮድ ለመግቢያ ያሳዩ',
  );

  function getCanvas(): HTMLCanvasElement | null {
    return canvasWrapperRef.current?.querySelector('canvas') ?? null;
  }

  async function handleDownload() {
    setBusy('save');
    try {
      const canvas = getCanvas();
      if (!canvas) throw new Error('QR not ready');
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `felege-yordanos-${memberId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      toast({
        title: t('Save failed'),
        description: err instanceof Error ? t(err.message) : t('Try again'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy('share');
    try {
      const canvas = getCanvas();
      if (!canvas) throw new Error('QR not ready');

      // Try the file-share path first (Web Share Level 2)
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      const file = blob
        ? new File([blob], `felege-yordanos-${memberId}.png`, {
            type: 'image/png',
          })
        : null;

      const navAny = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (file && navAny.canShare?.({ files: [file] })) {
        await navigator.share({
          title: t('My check-in code'),
          text: memberId,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({ title: t('My check-in code'), text: memberId });
        return;
      }

      // Fallback: clipboard copy
      await navigator.clipboard.writeText(memberId);
      toast({ title: t('Copied to clipboard'), description: memberId });
    } catch (err) {
      // AbortError when user cancels share — silent
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast({
        title: t('Share failed'),
        description: err instanceof Error ? t(err.message) : t('Try again'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[18px] border px-[18px] pb-4 pt-[18px] text-cream shadow-[0_12px_28px_-12px_rgba(10,60,54,0.4)]',
        pre
          ? 'border-pre/40 bg-gradient-to-br from-pre-mid to-pre-deep'
          : 'sacred-gradient border-gold/30',
      )}
      aria-label={t(pre ? 'Pre-member check-in QR code' : 'Member check-in QR code')}
    >
      <div className="tibeb-gold pointer-events-none absolute inset-0 opacity-[0.35]" />
      {pre && (
        <div className="relative -mx-[18px] -mt-[18px] mb-3 flex items-center justify-between bg-pre-deep/70 px-[18px] py-1.5">
          <span className="font-ethiopic text-[12px] font-semibold tracking-[0.04em] text-cream">
            ቅድመ አባል
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/75">
            Pre-member
          </span>
        </div>
      )}
      <div className="relative">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="font-ethiopic text-[11px] tracking-[0.06em] text-gold-light">
            {locale === 'am' ? 'የመግቢያ ኮድ' : t('Check-in code')}
          </div>
          <span className="font-mono text-[11px] font-semibold tracking-[0.05em] text-gold">
            {memberId}
          </span>
        </div>

        {/* QR + frame */}
        <div className="mb-3.5 flex justify-center">
          <div
            ref={canvasWrapperRef}
            className="rounded-xl border border-gold/40 bg-cream p-3 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]"
          >
            <MemberQR value={memberId} size={196} variant={variant} />
          </div>
        </div>

        <p
          className={cn(
            'text-center text-xs leading-snug text-gold-light',
            locale === 'am' ? 'font-ethiopic' : 'font-display text-[13px]',
          )}
        >
          {hint.primary}
        </p>
        <p
          className={cn(
            'mt-0.5 text-center text-[11px] text-cream/55',
            locale === 'am' ? 'font-display italic' : 'font-ethiopic',
          )}
        >
          {hint.secondary}
        </p>

        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy !== null}
            className={cn(ACTION, 'bg-cream/10 text-cream hover:bg-cream/15')}
          >
            <Download className="h-[13px] w-[13px] text-gold" />
            {busy === 'save' ? t('Saving…') : t('Save image')}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={busy !== null}
            className={cn(ACTION, 'bg-gold/15 text-gold hover:bg-gold/[0.22]')}
          >
            <Share2 className="h-[13px] w-[13px] text-gold" />
            {busy === 'share' ? t('Sharing…') : t('Share')}
          </button>
        </div>
      </div>
    </section>
  );
}
