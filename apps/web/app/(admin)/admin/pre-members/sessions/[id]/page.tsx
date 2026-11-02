import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import {
  db,
  preMembers,
  registrationSessions,
} from '@felege-yordanos/db/server';
import { canManageRegistrationSessions } from '@/lib/permissions';
import { sessionState } from '@/lib/registration-sessions';
import { requireUser } from '@/lib/session';
import { SessionDisplay } from './session-display';

/** The app's public address, for the link in the QR. */
async function appOrigin(): Promise<string> {
  const configured = process.env['BETTER_AUTH_URL'];
  if (configured) return configured.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

/** Full-screen QR for a TV or tablet at the desk, with a live count. */
export default async function SessionDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canManageRegistrationSessions(user)) redirect('/admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [session] = await db
    .select()
    .from(registrationSessions)
    .where(eq(registrationSessions.id, id))
    .limit(1);
  if (!session) notFound();
  const count = await db.$count(preMembers, eq(preMembers.sessionId, id));

  return (
    <SessionDisplay
      id={session.id}
      label={session.label}
      url={`${await appOrigin()}/join?s=${session.token}`}
      opensAt={session.opensAt.toISOString()}
      closesAt={session.closesAt.toISOString()}
      initialCount={count}
      initialState={sessionState(session)}
    />
  );
}
