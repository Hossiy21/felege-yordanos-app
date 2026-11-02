/**
 * Gives out pre-member IDs. Runs inside the approval transaction: the counter
 * row of the year is created or incremented in one statement, which locks it
 * until the transaction ends, so two approvals at the same time never get the
 * same number and a rolled-back approval leaves no gap.
 *
 * No 'server-only' import so the unit test can run it against a database;
 * only server code imports this file.
 */
import { sql } from 'drizzle-orm';
import { ethiopianYearOf, formatPreMemberCode } from './pre-members';

/** Anything with drizzle's execute(): db or a transaction. */
type Executor = {
  execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown>;
};

/** Next number for `year` (1, 2, …). Call inside a transaction. */
export async function nextPreMemberNumber(
  tx: Executor,
  year: number,
): Promise<number> {
  const rows = (await tx.execute(sql`
    INSERT INTO pre_member_id_counters (year, last) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last = pre_member_id_counters.last + 1
    RETURNING last
  `)) as unknown as { last: number }[];
  const last = rows[0]?.last;
  if (typeof last !== 'number') throw new Error('ID counter failed');
  return last;
}

/** Next ID for an approval at `at` ("FYP-<Ethiopian year>-<number>"). */
export async function nextPreMemberCode(
  tx: Executor,
  at: Date = new Date(),
): Promise<string> {
  const year = ethiopianYearOf(at);
  return formatPreMemberCode(year, await nextPreMemberNumber(tx, year));
}
