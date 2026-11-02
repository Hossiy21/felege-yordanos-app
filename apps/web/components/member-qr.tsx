'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';

/**
 * Fixed colours: a QR must stay dark-on-light in both themes to scan, so these
 * do not follow the dark-mode tokens. They match the light parchment palette.
 */
const QR_BG = '#FBF6E4';
const QR_FG = '#072B26';
const MARK_FILL = '#1C6B60';
const MARK_GOLD = '#D4A843';
/** Pre-member QR: plum center mark (--fy-pre), same black-on-cream code. */
const MARK_FILL_PRE = '#5C3D80';

interface MemberQRProps {
  /** The member_id encoded in the QR (used at the door for check-in). */
  value: string;
  /** Pixel size of the QR square. The center brand mark scales with it. */
  size?: number;
  className?: string;
  /** 'pre_member': FYP code, plum center mark. */
  variant?: 'member' | 'pre_member';
}

/**
 * The check-in QR with the Sunday School brand mark in its center cutout.
 * Shared by the full profile card and the compact dashboard check-in card so
 * the encoding, colors and error-correction stay identical in one place.
 */
export function MemberQR({
  value,
  size = 196,
  className,
  variant = 'member',
}: MemberQRProps) {
  const markFill = variant === 'pre_member' ? MARK_FILL_PRE : MARK_FILL;
  const markBox = Math.round(size * 0.185);
  const brand = Math.round(size * 0.145);

  return (
    <div className={cn('relative inline-flex', className)}>
      <QRCodeCanvas
        value={value}
        size={size}
        level="H"
        bgColor={QR_BG}
        fgColor={QR_FG}
        marginSize={0}
      />
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg p-[3px]"
        style={{
          height: markBox,
          width: markBox,
          background: QR_BG,
          boxShadow: `0 0 0 3px ${QR_BG}`,
        }}
        aria-hidden
      >
        <svg viewBox="0 0 80 80" width={brand} height={brand}>
          <circle
            cx="40"
            cy="40"
            r="39"
            fill={markFill}
            stroke={MARK_GOLD}
            strokeOpacity="0.7"
            strokeWidth="0.8"
          />
          <g fill={MARK_GOLD}>
            <rect x="37.5" y="14" width="5" height="52" rx="0.5" />
            <rect x="14" y="37.5" width="52" height="5" rx="0.5" />
            <rect x="34" y="11" width="12" height="3.5" rx="0.5" />
            <rect x="34" y="65.5" width="12" height="3.5" rx="0.5" />
            <rect x="11" y="34" width="3.5" height="12" rx="0.5" />
            <rect x="65.5" y="34" width="3.5" height="12" rx="0.5" />
            <circle cx="40" cy="40" r="7" fill={markFill} />
            <circle
              cx="40"
              cy="40"
              r="5.5"
              fill="none"
              stroke={MARK_GOLD}
              strokeWidth="1"
            />
            <circle cx="40" cy="40" r="2" fill={MARK_GOLD} />
          </g>
        </svg>
      </div>
    </div>
  );
}
