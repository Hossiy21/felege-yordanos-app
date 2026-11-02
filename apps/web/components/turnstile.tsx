'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from '@/lib/i18n/client';

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      language?: string;
      theme?: 'auto' | 'light' | 'dark';
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading: Promise<void> | null = null;

/** Loads the Turnstile script once. */
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile widget. `onToken` gets a token to send with the form
 * (null when it expires). Bump `resetKey` to get a fresh token after a
 * failed submit (a token works once).
 */
export function Turnstile({
  siteKey,
  onToken,
  resetKey = 0,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const locale = useLocale();
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
          language: locale,
          theme: 'auto',
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile)
        window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, locale]);

  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      onTokenRef.current(null);
    }
  }, [resetKey]);

  return <div ref={ref} className="flex min-h-[65px] justify-center" />;
}
