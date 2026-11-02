'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Check, Info, ScanLine, X } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';

export type ScanResult =
  | {
      kind: 'success';
      name: string;
      memberId: string;
      time: string;
      preMember?: boolean;
    }
  | { kind: 'already'; name: string; memberId: string; preMember?: boolean }
  /** A real ID that may not check in here (message in English). */
  | { kind: 'refused'; code: string; message: string; preMember: boolean }
  | { kind: 'invalid'; code: string };

interface QRScannerProps {
  active: boolean; // true when the QR tab is selected
  onMemberId: (memberId: string) => Promise<ScanResult>;
  presentCount: number;
  total: number;
}

type Status = 'idle' | 'starting' | 'running' | 'denied' | 'error';

// Loose shape for the bits of Html5Qrcode we touch — keeps us off the lib's types
type ScannerInstance = {
  start: (
    cameraIdOrConfig: { facingMode: string } | string,
    config: Record<string, unknown>,
    onSuccess: (decoded: string) => void,
    onError: (error: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear?: () => void;
  isScanning?: boolean;
};

export function QRScanner({
  active,
  onMemberId,
  presentCount,
  total,
}: QRScannerProps) {
  const t = useT();
  // Unique per instance: the phone and desktop layouts can both mount a scanner.
  const VIDEO_ELEMENT_ID = `fy-qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const instanceRef = useRef<ScannerInstance | null>(null);
  const lastValueRef = useRef<string>('');
  const lastAtRef = useRef<number>(0);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);

  useEffect(() => {
    if (!active) {
      void teardown();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Ensure any previous instance is fully torn down before starting fresh
        await teardown();
        if (cancelled) return;

        setStatus('starting');
        setErrorMessage('');

        const mod = await import('html5-qrcode');
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Html5Qrcode = (mod as any).Html5Qrcode;
        const instance = new Html5Qrcode(
          VIDEO_ELEMENT_ID,
          false,
        ) as ScannerInstance;
        instanceRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            // NOTE: no `qrbox` — let the library scan the whole frame.
            // A fixed qrbox restricts decode to a tiny center region that
            // rarely aligns with the visible viewfinder.
            disableFlip: false,
          },
          (decoded) => {
            void handleDecode(decoded);
          },
          // Per-frame "no QR detected" — extremely noisy, ignore
          () => undefined,
        );

        if (cancelled) {
          await teardown();
          return;
        }

        setStatus('running');
      } catch (err) {
        if (cancelled) return;
        console.error('[QR scanner] start failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const lower = msg.toLowerCase();
        if (
          lower.includes('permission') ||
          lower.includes('notallowed') ||
          lower.includes('denied')
        ) {
          setStatus('denied');
          setErrorMessage('');
        } else {
          setStatus('error');
          setErrorMessage(msg || t('Unknown camera error'));
        }
      }
    })();

    return () => {
      cancelled = true;
      void teardown();
    };
  }, [active]);

  async function teardown() {
    const inst = instanceRef.current;
    if (!inst) return;
    instanceRef.current = null;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
    } catch (err) {
      console.warn('[QR scanner] stop ignored:', err);
    }
    try {
      inst.clear?.();
    } catch {
      // ignore
    }
  }

  async function handleDecode(decoded: string) {
    try {
      const now = Date.now();
      // Debounce: same code ignored within 2s, any code within 600ms
      if (now - lastAtRef.current < 600) return;
      if (decoded === lastValueRef.current && now - lastAtRef.current < 2000)
        return;
      lastValueRef.current = decoded;
      lastAtRef.current = now;

      const result = await onMemberId(decoded);
      setLastScan(result);
    } catch (err) {
      console.error('[QR scanner] decode handler failed:', err);
      setLastScan({ kind: 'invalid', code: decoded });
    }
  }

  function retry() {
    // Flip status to force the effect to re-run by clearing transient flags;
    // the effect deps are on `active` so we re-trigger by toggling state through
    // a quick teardown + restart. Easier path: just call the same start logic.
    setStatus('idle');
    setErrorMessage('');
    // Kick the effect: since we depend on `active`, and `active` hasn't changed,
    // the cleanest restart is to clear instance and rely on a manual rerun.
    void (async () => {
      try {
        await teardown();
        setStatus('starting');
        const mod = await import('html5-qrcode');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Html5Qrcode = (mod as any).Html5Qrcode;
        const instance = new Html5Qrcode(
          VIDEO_ELEMENT_ID,
          false,
        ) as ScannerInstance;
        instanceRef.current = instance;
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, disableFlip: false },
          (decoded) => void handleDecode(decoded),
          () => undefined,
        );
        setStatus('running');
      } catch (err) {
        console.error('[QR scanner] retry failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const lower = msg.toLowerCase();
        if (
          lower.includes('permission') ||
          lower.includes('notallowed') ||
          lower.includes('denied')
        ) {
          setStatus('denied');
        } else {
          setStatus('error');
          setErrorMessage(msg || t('Unknown camera error'));
        }
      }
    })();
  }

  return (
    <div>
      {/* Camera viewfinder */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-parchment-edge bg-gradient-to-b from-black to-neutral-900">
        <div
          id={VIDEO_ELEMENT_ID}
          className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        {(status === 'idle' || status === 'starting') && (
          <ScannerStateMessage
            icon={<Camera className="h-6 w-6 text-gold" />}
            title={t('Starting camera…')}
            subtitle={t('Allow camera access if prompted')}
          />
        )}
        {status === 'denied' && (
          <ScannerStateMessage
            icon={<Camera className="h-6 w-6 text-status-absent" />}
            title={t('Camera permission required')}
            subtitle={t('Allow camera in your browser, then retry.')}
            action={<RetryButton onClick={retry} label={t('Retry')} />}
          />
        )}
        {status === 'error' && (
          <ScannerStateMessage
            icon={<X className="h-6 w-6 text-status-absent" />}
            title={t('Scanner unavailable')}
            subtitle={
              errorMessage || t('Your browser may not support camera access.')
            }
            action={<RetryButton onClick={retry} label={t('Retry')} />}
          />
        )}

        {status === 'running' && (
          <>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2">
              <Corner pos="tl" />
              <Corner pos="tr" />
              <Corner pos="bl" />
              <Corner pos="br" />
              <div
                aria-hidden
                className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse"
                style={{
                  background:
                    'linear-gradient(to right, transparent, rgb(var(--fy-gold)) 50%, transparent)',
                  boxShadow:
                    '0 0 16px rgba(212,168,67,0.7), 0 0 32px rgba(212,168,67,0.4)',
                }}
              />
            </div>

            <div className="sacred-gradient pointer-events-none absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-gold/30 px-2.5 py-1 text-cream opacity-90 backdrop-blur-sm">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-status-present shadow-[0_0_6px_#4F7B3E]"
              />
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gold-light/80">
                {t('Live')}
              </span>
              <span className="font-mono text-[12px] font-bold text-gold">
                {presentCount}
              </span>
              <span className="font-mono text-[10px] text-gold-light/60">
                / {total}
              </span>
            </div>

            <div className="pointer-events-none absolute bottom-4 left-1/2 w-[80%] -translate-x-1/2 text-center">
              <div className="font-ethiopic text-[13px] tracking-[0.04em] text-gold-light">
                ኮድ በመስኩ ውስጥ ያስቀምጡ
              </div>
              <div className="mt-0.5 font-display text-xs italic text-cream/60">
                Position QR code inside the frame
              </div>
            </div>
          </>
        )}
      </div>

      {lastScan ? (
        <ScanFeedbackBanner result={lastScan} />
      ) : status === 'running' ? (
        <p className="mt-3 text-center text-[10px] italic text-ink-muted">
          {t('Scan a QR · ready for the next member')}
        </p>
      ) : null}
    </div>
  );
}

function RetryButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gold/40 bg-gold/20 px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/30"
    >
      {label}
    </button>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base =
    'absolute h-7 w-7 ' +
    (pos === 'tl'
      ? 'left-0 top-0 rounded-tl-xl border-l-[3px] border-t-[3px]'
      : pos === 'tr'
        ? 'right-0 top-0 rounded-tr-xl border-r-[3px] border-t-[3px]'
        : pos === 'bl'
          ? 'bottom-0 left-0 rounded-bl-xl border-b-[3px] border-l-[3px]'
          : 'bottom-0 right-0 rounded-br-xl border-b-[3px] border-r-[3px]');
  return (
    <span
      aria-hidden
      className={base + ' border-gold'}
      style={{ filter: 'drop-shadow(0 0 4px rgba(212,168,67,0.4))' }}
    />
  );
}

function ScannerStateMessage({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-black to-neutral-900 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-cream/[0.08]">
        {icon}
      </div>
      <div className="font-display text-base font-medium text-cream">
        {title}
      </div>
      <div className="break-words text-[11px] text-cream/60">{subtitle}</div>
      {action}
    </div>
  );
}

function ScanFeedbackBanner({ result }: { result: ScanResult }) {
  const t = useT();
  if (result.kind === 'success') {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-status-present/30 bg-status-present-bg px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-present">
          <Check className="h-[22px] w-[22px] text-cream" strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-medium leading-tight text-brand-ink">
            {result.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-status-present">
            <ScanLine className="h-2.5 w-2.5" />
            {t('Checked in')} · {result.memberId}
            {result.preMember && <PreMemberBadge />}
          </div>
        </div>
        <div className="shrink-0 font-mono text-[10px] font-semibold text-status-present">
          {result.time}
        </div>
      </div>
    );
  }
  if (result.kind === 'already') {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-status-late/40 bg-status-late-bg px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-late">
          <Info className="h-5 w-5 text-cream" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-medium leading-tight text-brand-ink">
            {result.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-status-late">
            {t('Already marked present')} · {result.memberId}
            {result.preMember && <PreMemberBadge />}
          </div>
        </div>
      </div>
    );
  }
  if (result.kind === 'refused') {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-status-absent/40 bg-status-absent-bg px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-absent">
          <X className="h-[22px] w-[22px] text-cream" strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-medium leading-tight text-brand-ink">
            {t(result.message)}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] font-medium text-status-absent">
            {result.code.slice(0, 32)}
            {result.preMember && <PreMemberBadge />}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-status-absent/40 bg-status-absent-bg px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-absent">
        <X className="h-[22px] w-[22px] text-cream" strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-medium leading-tight text-brand-ink">
          {t('Invalid QR code')}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-status-absent">
          {t('Not a Felege Yordanos member ID')} · {result.code.slice(0, 32)}
        </div>
      </div>
    </div>
  );
}
