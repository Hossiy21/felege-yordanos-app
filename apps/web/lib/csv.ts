/**
 * CSV for exports. Opens in Excel with Amharic intact (UTF-8 byte order
 * mark). Cells that a spreadsheet would run as a formula (=, +, -, @ …) get
 * a leading apostrophe: names come from self-registration.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The whole file, header first, CRLF line ends. */
export function toCsv(
  rows: (string | number | null | undefined)[][],
): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** A file name without characters browsers or systems refuse. */
export const csvFileName = (base: string) =>
  `${base.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'export'}.csv`;
