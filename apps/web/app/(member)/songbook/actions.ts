'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, songs } from '@felege-yordanos/db/server';
import { requireUser } from '@/lib/session';
import { saveSongView } from '@/lib/song-views';

/** Records an opened song without trusting a client-supplied user. */
export async function recordSongView(id: string): Promise<void> {
  const user = await requireUser();
  const songId = z.uuid().safeParse(id);
  if (!songId.success) return;

  const [song] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.id, songId.data))
    .limit(1);
  if (!song) return;

  try {
    await saveSongView(user.id, song.id);
    revalidatePath('/dashboard');
  } catch (error) {
    // History is a convenience feature; a failed write must not block songs.
    console.error('[song views] record failed:', error);
  }
}
