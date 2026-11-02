/**
 * Fixed-window rate limits stored in Postgres (rate_limits), so they hold
 * across app restarts and containers without another service.
 *
 * No 'server-only' import so the unit test can run it against a database;
 * only server code imports this file.
 */
import { sql } from 'drizzle-orm';

type Executor = {
  execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown>;
};

/**
 * Counts one request for `key` in the current window of `windowSeconds` and
 * returns whether it is within `max`. Counting and checking is one statement,
 * so parallel requests cannot all slip through.
 */
export async function hitRateLimit(
  db: Executor,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const rows = (await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (
      ${key},
      to_timestamp(floor(extract(epoch FROM now()) / ${windowSeconds}) * ${windowSeconds}),
      1
    )
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `)) as unknown as { count: number }[];
  // Now and then, drop windows older than a day.
  if (Math.random() < 0.05)
    await db.execute(
      sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`,
    );
  return (rows[0]?.count ?? Infinity) <= max;
}
