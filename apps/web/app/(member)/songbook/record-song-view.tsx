'use client';

import { useEffect } from 'react';
import { recordOpenedSong } from '@/components/song-history-refresh';

export function RecordSongView({ songId }: { songId: string }) {
  useEffect(() => {
    recordOpenedSong(songId);
  }, [songId]);

  return null;
}
