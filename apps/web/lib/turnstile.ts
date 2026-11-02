/**
 * Cloudflare Turnstile (spam protection on the public /join form).
 *
 * Keys: TURNSTILE_SITE_KEY (public, sent to the page) and
 * TURNSTILE_SECRET_KEY. Outside production, Cloudflare's test keys (always
 * pass) are used when they are not set. In production missing keys make
 * /join refuse registrations (fail closed).
 */
import 'server-only';

const TEST_SITE_KEY = '1x00000000000000000000AA';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function keys(): { siteKey: string; secretKey: string } | null {
  const siteKey = process.env['TURNSTILE_SITE_KEY'];
  const secretKey = process.env['TURNSTILE_SECRET_KEY'];
  if (siteKey && secretKey) return { siteKey, secretKey };
  if (process.env['NODE_ENV'] !== 'production')
    return { siteKey: TEST_SITE_KEY, secretKey: TEST_SECRET_KEY };
  return null;
}

/** The site key for the widget, or null when Turnstile is not configured. */
export const turnstileSiteKey = () => keys()?.siteKey ?? null;

/** Checks a widget token with Cloudflare. False on any error. */
export async function verifyTurnstile(
  token: string,
  ip: string | null,
): Promise<boolean> {
  const k = keys();
  if (!k || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: k.secretKey, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[turnstile] verify failed:', (err as Error).message);
    return false;
  }
}
