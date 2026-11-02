'use client';

import { useRef } from 'react';
import { Download, Printer } from 'lucide-react';
import { Card } from '@/components/ds';
import { secondaryBtn } from '@/components/events/event-ui';
import { MemberQR } from '@/components/member-qr';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** Escapes text for the print window's HTML. */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The pre-member's check-in QR (FYP code) with download and print, for
 * admins handing out the code at the desk.
 */
export function PreMemberQrPanel({
  code,
  name,
  disabled,
}: {
  code: string;
  name: string;
  /** Withdrawn: shown faded, the code does not check in. */
  disabled?: boolean;
}) {
  const t = useT();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  const png = () =>
    ref.current?.querySelector('canvas')?.toDataURL('image/png') ?? null;

  function download() {
    const url = png();
    if (!url) {
      toast({ title: t('QR not ready'), variant: 'destructive' });
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `felege-yordanos-${code}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * A small card in a new window: band, QR, name and ID. The window has no
   * app stylesheet, so its colours are fixed (same as --fy-pre / --fy-pre-deep).
   */
  function print() {
    const url = png();
    const w = url ? window.open('', '_blank', 'width=420,height=560') : null;
    if (!url || !w) {
      toast({ title: t('QR not ready'), variant: 'destructive' });
      return;
    }
    w.document
      .write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(code)}</title>
<style>
  body{margin:0;font-family:"Noto Sans Ethiopic",system-ui,sans-serif;display:flex;justify-content:center;padding:24px}
  .card{width:300px;border:1px solid #5C3D80;border-radius:14px;overflow:hidden;text-align:center}
  .band{background:#3A2454;color:#FEF9EA;padding:8px 14px;display:flex;justify-content:space-between;font-size:13px;font-weight:600}
  .band small{letter-spacing:.18em;text-transform:uppercase;font-size:10px;opacity:.8}
  img{width:220px;height:220px;margin:18px auto 8px;display:block}
  .name{font-size:16px;font-weight:600;padding:0 12px}
  .code{font-family:ui-monospace,monospace;font-size:15px;letter-spacing:.08em;margin:6px 0 18px}
</style></head><body><div class="card">
<div class="band"><span>ቅድመ አባል</span><small>Pre-member</small></div>
<img src="${url}" alt="">
<div class="name">${esc(name)}</div><div class="code">${esc(code)}</div>
</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <Card className={cn('border-pre/40 p-0', disabled && 'opacity-60')}>
      <div className="flex items-center justify-between rounded-t-2xl bg-pre-deep px-[18px] py-2 text-cream">
        <span className="font-ethiopic text-[12px] font-semibold">ቅድመ አባል</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/75">
          Pre-member
        </span>
      </div>
      <div className="p-[22px] text-center">
        <div
          ref={ref}
          className="mx-auto w-fit rounded-[14px] border border-pre/40 bg-parchment-soft p-3 dark:bg-cream"
        >
          <MemberQR value={code} size={168} variant="pre_member" />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[14px] tracking-[0.08em] text-ink">
          {code}
          <PreMemberBadge />
        </div>
        {disabled && (
          <p className="mt-1.5 text-[11.5px] text-status-absent">
            {t('Withdrawn: this code does not check in.')}
          </p>
        )}
        <div className="mt-3.5 flex justify-center gap-2">
          <button type="button" onClick={download} className={secondaryBtn}>
            <Download className="h-[13px] w-[13px]" />
            {t('Download')}
          </button>
          <button type="button" onClick={print} className={secondaryBtn}>
            <Printer className="h-[13px] w-[13px]" />
            {t('Print card')}
          </button>
        </div>
      </div>
    </Card>
  );
}
