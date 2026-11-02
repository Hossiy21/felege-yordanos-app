/**
 * Reads for the summary of a closed event (/admin/attendance/[eventId]).
 * Callers check canViewEventSummary (lib/permissions.ts) first; the numbers
 * are computed by lib/event-summary.ts.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import {
  attendance,
  authUsers,
  db,
  profiles,
  type events,
} from '@felege-yordanos/db/server';
import { attendanceRowKey } from './audience';
import { computeEventSummary, type EventSummary } from './event-summary';
import { loadExpectedPeople } from './expected-people';

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
  const [people, rows, closedByName] = await Promise.all([
    // Same list as the check-in screen (and the close), by audience.
    loadExpectedPeople(event),
    db
      .select({
        memberId: attendance.memberId,
        preMemberId: attendance.preMemberId,
        status: attendance.status,
        checkedInAt: attendance.checkedInAt,
        method: attendance.method,
        markedBy: attendance.markedBy,
        displayName: profiles.displayName,
        loginName: authUsers.name,
      })
      .from(attendance)
      .leftJoin(profiles, eq(profiles.id, attendance.markedBy))
      .leftJoin(authUsers, eq(authUsers.id, attendance.markedBy))
      .where(eq(attendance.eventId, event.id)),
    staffName(event.closedBy),
  ]);

  const summary = computeEventSummary(
    event,
    people,
    rows.map((r) => ({
      key: attendanceRowKey(r),
      status: r.status,
      checkedInAt: r.checkedInAt,
      method: r.method,
      markedBy: r.markedBy,
      markedByName: r.displayName || r.loginName,
    })),
  );
  return { ...summary, closedByName };
}
