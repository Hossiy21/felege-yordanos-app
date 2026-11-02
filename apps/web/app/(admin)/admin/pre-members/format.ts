import { eatDate, eatTime } from '@/lib/check-in-window';
import { formatYmd } from '@/lib/events';

/** "Oct 31, 2026" / Amharic month names, on the Ethiopian-time date. */
export const formatShortDate = (at: Date | string, locale: 'am' | 'en') =>
  formatYmd(eatDate(new Date(at)), locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Date and time in Ethiopian time ("Oct 31, 2026 · 14:05"). */
export const formatDateTime = (at: Date | string, locale: 'am' | 'en') =>
  `${formatShortDate(at, locale)} · ${eatTime(new Date(at))}`;
