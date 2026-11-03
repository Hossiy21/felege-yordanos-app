/**
 * Reads for the summary of a closed event (/admin/attendance/[eventId]).
 * Callers check canViewEventSummary (lib/permissions.ts) first; the numbers
 * are computed by lib/event-summary.ts.
 *
 * The people are the event's attendance rows (lib/event-people.ts): closing
 * wrote one for everyone expected then, so the summary does not change when
 * people are added, promoted or withdrawn later.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import {
  authUsers,
  db,
  profiles,
  type events,
} from '@felege-yordanos/db/server';
import { computeEventSummary, type EventSummary } from './event-summary';
import { loadEventPeople } from './expected-people';

/** Display name of a staff account: profile name, else the login name. */
async function staffName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const [row] = await db
    .select({ displayName: profiles.displayName, name: authUsers.name })
    .from(authUsers)
    .leftJoin(profiles, eq(profiles.id, authUsers.id))
    .where(eq(authUsers.id, userId))
    .limit(1);
  return row ? row.displayName || row.name : null;
}

export async function loadEventSummary(
  event: typeof events.$inferSelect,
): Promise<EventSummary & { closedByName: string | null }> {
  const [{ people, rows }, closedByName] = await Promise.all([
    loadEventPeople(event),
    staffName(event.closedBy),
  ]);
  const summary = computeEventSummary(event, people, rows);
  return { ...summary, closedByName };
}
