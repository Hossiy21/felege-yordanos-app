/**
 * Date-range presets in the Ethiopian calendar for the attendance filters:
 * the current and previous Ethiopian year and the last months, each as a
 * Gregorian YYYY-MM-DD range (events are stored with Gregorian dates).
 * Pure: safe in server and client code.
 */
import { ETH_MONTHS, parseYmd, toEthiopic, toYmd } from './events';

/** English names of the Ethiopian months (Amharic: ETH_MONTHS). */
export const ETH_MONTHS_EN = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miyazya',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

export interface EthiopianPeriod {
  /** "y2019" or "m2019-02" (Ethiopian year and month). */
  key: string;
  kind: 'year' | 'month';
  year: number;
  /** 1–13 for months. */
  month: number | null;
  /** Gregorian YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
}

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** First day of the Ethiopian month that contains `d`. */
function monthStart(d: Date): Date {
  return addDays(d, 1 - toEthiopic(d).day);
}

/** Last day of the Ethiopian month that starts on `start`. */
function monthEnd(start: Date): Date {
  const { month } = toEthiopic(start);
  let d = start;
  while (toEthiopic(addDays(d, 1)).month === month) d = addDays(d, 1);
  return d;
}

/** 1 Meskerem of the Ethiopian year that contains `d`. */
function yearStart(d: Date): Date {
  let s = monthStart(d);
  while (toEthiopic(s).month !== 1) s = monthStart(addDays(s, -1));
  return s;
}

/** Last day (Pagume) of the Ethiopian year that starts on `start`. */
function yearEnd(start: Date): Date {
  const { year } = toEthiopic(start);
  // 365 or 366 days.
  const guess = addDays(start, 364);
  return toEthiopic(addDays(guess, 1)).year === year
    ? addDays(guess, 1)
    : guess;
}

/**
 * Presets for `today` (YYYY-MM-DD): this Ethiopian year, last year, then the
 * last `months` Ethiopian months, newest first (the 5–6 day Pagume included).
 */
export function ethiopianPeriods(
  today: string,
  months = 12,
): EthiopianPeriod[] {
  const now = parseYmd(today);
  const list: EthiopianPeriod[] = [];

  const thisYear = yearStart(now);
  const lastYear = yearStart(addDays(thisYear, -1));
  for (const s of [thisYear, lastYear]) {
    const { year } = toEthiopic(s);
    list.push({
      key: `y${year}`,
      kind: 'year',
      year,
      month: null,
      from: toYmd(s),
      to: toYmd(yearEnd(s)),
    });
  }

  let s = monthStart(now);
  for (let i = 0; i < months; i += 1) {
    const { year, month } = toEthiopic(s);
    list.push({
      key: `m${year}-${String(month).padStart(2, '0')}`,
      kind: 'month',
      year,
      month,
      from: toYmd(s),
      to: toYmd(monthEnd(s)),
    });
    s = monthStart(addDays(s, -1));
  }
  return list;
}

/** "ጥቅምት 2019" / "Tikimt 2019", "2019 ዓ.ም." / "2019 E.C." */
export function ethiopianPeriodLabel(
  p: EthiopianPeriod,
  locale: 'am' | 'en',
): string {
  if (p.kind === 'year')
    return locale === 'am' ? `${p.year} ዓ.ም.` : `${p.year} E.C.`;
  const names = locale === 'am' ? ETH_MONTHS : ETH_MONTHS_EN;
  return `${names[(p.month ?? 1) - 1]} ${p.year}`;
}
