import { eq } from 'drizzle-orm';
import { db, registrationSessions } from '@felege-yordanos/db/server';
import { isSessionToken, sessionState } from '@/lib/registration-sessions';
import { turnstileSiteKey } from '@/lib/turnstile';
import { JoinForm } from './join-form';

/**
 * Public self-registration for pre-members, opened from a session QR
 * (/join?s=<token>). Only works while that session is open.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const siteKey = turnstileSiteKey();

  let open = false;
  if (isSessionToken(s) && siteKey) {
    const [session] = await db
      .select({
        opensAt: registrationSessions.opensAt,
        closesAt: registrationSessions.closesAt,
        closedAt: registrationSessions.closedAt,
      })
      .from(registrationSessions)
      .where(eq(registrationSessions.token, s))
      .limit(1);
    open = !!session && sessionState(session) === 'open';
  }

  return (
    <JoinForm
      sessionToken={open && s ? s : null}
      siteKey={open ? siteKey : null}
    />
  );
}
