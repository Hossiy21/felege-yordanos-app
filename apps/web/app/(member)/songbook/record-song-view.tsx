'use client';

import { useEffect } from 'react';
import { recordSongView } from './actions';

export function RecordSongView({ songId }: { songId: string }) {
  useEffect(() => {
    void recordSongView(songId).catch((error) => {
      console.error('[song views] record failed:', error);
    });
  }, [songId]);

  return null;
}
