'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { recordSongView } from '@/app/(member)/songbook/actions';

// Shared across song routes and the cached dashboard in this browser tab.
const pendingViews = new Set<Promise<void>>();
let historyChanged = false;

export function recordOpenedSong(songId: string): void {
  const pending = recordSongView(songId)
    .then((result) => {
      if (result.ok) historyChanged = true;
    })
    .catch((error) => {
      console.error('[song views] record failed:', error);
    });
  pendingViews.add(pending);
  void pending.then(() => pendingViews.delete(pending));
}

/** Refresh on returning to the dashboard, never while reading a song. */
export function SongHistoryRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    let active = true;

    async function refreshHistory() {
      // A quick return may happen before the server finishes saving the view.
      await Promise.all([...pendingViews]);
      if (!active || !historyChanged) return;
      historyChanged = false;
      router.refresh();
    }

    void refreshHistory();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return null;
}
