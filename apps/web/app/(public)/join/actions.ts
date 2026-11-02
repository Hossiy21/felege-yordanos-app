'use server';

import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  preMembers,
  registrationSessions,
} from '@felege-yordanos/db/server';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { logPreMember } from '@/lib/pre-member-queries';
import { preMemberDetailsSchema } from '@/lib/pre-member-schema';
import { hitRateLimit } from '@/lib/rate-limit';
import {
  isSessionToken,
  REGISTRATION_CLOSED,
  registrationReference,
  sessionState,
} from '@/lib/registration-sessions';
import { verifyTurnstile } from '@/lib/turnstile';

const CLOSED = REGISTRATION_CLOSED;
const TOO_MANY =
  'Too many registrations right now. Please wait a few minutes or ask a volunteer at the desk.';
const NOT_HUMAN = 'Please complete the check that you are not a robot.';

/**
 * Many people register from the same Wi-Fi at the school, so the per-IP
 * limit is generous; Turnstile stops bots. Per session it caps a runaway.
 */
const LIMITS = {
  ip: { windowSeconds: 10 * 60, max: 20 },
  session: { windowSeconds: 60 * 60, max: 300 },
};

/** Client IP: Cloudflare's header, else the first X-Forwarded-For entry. */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip =
    h.get('cf-connecting-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip');
  return ip ? ip.slice(0, 64) : null;
}

const inputSchema = preMemberDetailsSchema.extend({
  sessionToken: z.string().max(64),
  turnstileToken: z.string().max(2048),
});

/**
 * Self-registration through a session QR (public, no login). Creates a
 * pending pre-member tagged with the session; an admin approves it later.
 * Never says whether the email or phone is already known: duplicates show
 * to the admin on approval.
 */
export async function submitRegistration(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<{ reference: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Invalid input.');
  const { sessionToken, turnstileToken, ...details } = parsed.data;
  if (!isSessionToken(sessionToken)) return fail(CLOSED);

  const ip = await clientIp();
  const [ipOk, sessionOk] = await Promise.all([
    hitRateLimit(
      db,
      `join:ip:${ip ?? 'unknown'}`,
      LIMITS.ip.windowSeconds,
      LIMITS.ip.max,
    ),
    hitRateLimit(
      db,
      `join:session:${sessionToken}`,
      LIMITS.session.windowSeconds,
      LIMITS.session.max,
    ),
  ]);
  if (!ipOk || !sessionOk) return fail(TOO_MANY);

  const [session] = await db
    .select()
    .from(registrationSessions)
    .where(eq(registrationSessions.token, sessionToken))
    .limit(1);
  if (!session || sessionState(session) !== 'open') return fail(CLOSED);

  if (!(await verifyTurnstile(turnstileToken, ip))) return fail(NOT_HUMAN);

  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(preMembers)
        .values({ ...details, source: 'self', sessionId: session.id })
        .returning({ id: preMembers.id });
      await logPreMember(tx, row.id, 'submitted', null, {
        sessionId: session.id,
        sessionLabel: session.label,
      });
      return row.id;
    });
    return ok({ reference: registrationReference(id) });
  } catch (err) {
    console.error('[join] registration failed:', (err as Error).message);
    return fail('Something went wrong. Please try again.');
  }
}
