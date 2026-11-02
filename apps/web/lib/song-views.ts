import 'server-only';

import { db, songViews } from '@felege-yordanos/db/server';

/** Upserts a trusted, server-derived user's latest view of an existing song. */
export async function saveSongView(userId: string, songId: string) {
  await db
    .insert(songViews)
    .values({ userId, songId })
    .onConflictDoUpdate({
      target: [songViews.userId, songViews.songId],
      set: { viewedAt: new Date() },
    });
}
