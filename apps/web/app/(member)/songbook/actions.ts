'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/session';
import { canViewSongbook } from '@/lib/permissions';
import { fail, NOT_ALLOWED, ok, type ActionResult } from '@/lib/action-result';
import { saveSongView } from '@/lib/song-views';

/** Records an opened song without trusting a client-supplied user. */
export async function recordSongView(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canViewSongbook(user)) return fail(NOT_ALLOWED);
  const songId = z.uuid().safeParse(id);
  if (!songId.success) return fail('Song not found.');

  try {
    await saveSongView(user.id, songId.data);
    return ok();
  } catch (error) {
    // History is a convenience feature; a failed write must not block songs.
    console.error('[song views] record failed:', error);
    return fail('Could not record song view.');
  }
}
