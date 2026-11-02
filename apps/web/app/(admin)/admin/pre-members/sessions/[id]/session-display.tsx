'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { eatTime } from '@/lib/check-in-window';
import { useT } from '@/lib/i18n/client';
import type { SessionState } from '@/lib/registration-sessions';
import { getRegistrationSessionCount } from '../actions';
import { CloseSessionButton } from '../session-forms';

/** Fixed QR colours (same as components/member-qr.tsx). */
const QR_BG = '#FBF6E4';
const QR_FG = '#072B26';

/** How often the count is refreshed. */
const POLL_MS = 5_000;

/**
 * Covers the whole screen (TV or tablet): the session QR to /join, the
 * bilingual instruction and a live count of registrations. Fixed QR colours:
 * a QR must stay dark on light to scan, in both themes.
 */
export function SessionDisplay({
  id,
  label,
  url,
  opensAt,
  closesAt,
  initialCount,
  initialState,
}: {
  id: string;
  label: string;
  url: string;
  opensAt: string;
  closesAt: string;
  initialCount: number;
  initialState: SessionState;
}) {
  const t = useT();
  const [count, setCount] = useState(initialCount);
  const [closed, setClosed] = useState(initialState === 'closed');

  useEffect(() => {
    if (closed) return;
    const timer = setInterval(async () => {
      const res = await getRegistrationSessionCount(id).catch(() => null);
      if (!res?.ok) return;
      setCount(res.data.count);
      if (res.data.closed) setClosed(true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id, closed]);

  return (
    <div className="sacred-gradient fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto px-6 py-8 text-cream">
      <div className="tibeb-gold pointer-events-none absolute inset-0 opacity-30" />
      <Link
        href="/admin/pre-members/sessions"
        aria-label={t('Close')}
        className="absolute right-5 top-5 rounded-full border border-cream/25 p-2 text-cream/80 hover:bg-cream/10"
      >
        <X className="h-5 w-5" />
      </Link>

      <div className="relative flex w-full max-w-5xl flex-col items-center gap-8 md:flex-row md:justify-center md:gap-14">
        <div
          className="rounded-[28px] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] md:p-7"
          style={{ background: QR_BG }}
        >
          {closed ? (
            <div
              className="flex h-[min(70vw,420px)] w-[min(70vw,420px)] items-center justify-center text-center font-ethiopic text-2xl font-semibold"
              style={{ color: QR_FG }}
            >
              ምዝገባው ተዘግቷል
              <br />
              Registration is closed
            </div>
          ) : (
            <QRCodeSVG
              value={url}
              level="M"
              marginSize={0}
              bgColor={QR_BG}
              fgColor={QR_FG}
              className="h-[min(70vw,420px)] w-[min(70vw,420px)]"
            />
          )}
        </div>

        <div className="max-w-md text-center md:text-left">
          <div className="font-display text-sm uppercase tracking-[0.2em] text-gold-light">
            {label}
          </div>
          <h1 className="mt-3 font-ethiopic text-[34px] font-semibold leading-tight md:text-[44px]">
            ቅድመ አባል ምዝገባ
          </h1>
          <p className="mt-1 font-display text-2xl text-gold-light md:text-3xl">
            Pre-member registration
          </p>
          <p className="mt-5 font-ethiopic text-lg leading-relaxed text-cream/90">
            በስልክዎ ካሜራ ኮዱን ይቃኙና ቅጹን ይሙሉ።
          </p>
          <p className="text-base text-cream/70">
            Scan the code with your phone camera and fill in the form.
          </p>

          <div className="mt-8 inline-flex items-baseline gap-3 rounded-2xl border border-gold/30 bg-cream/[0.08] px-6 py-4">
            <span className="font-display text-6xl font-medium tabular-nums lining-nums text-gold">
              {count}
            </span>
            <span className="text-sm text-cream/80">
              {t('registered so far')}
            </span>
          </div>
          <div className="mt-3 font-mono text-xs text-cream/60">
            {eatTime(new Date(opensAt))} – {eatTime(new Date(closesAt))}
          </div>
          {!closed && (
            <div className="mt-6">
              <CloseSessionButton
                id={id}
                onClosed={() => setClosed(true)}
                className="bg-cream/90"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
