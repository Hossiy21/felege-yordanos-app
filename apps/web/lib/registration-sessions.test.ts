import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { hitRateLimit } from './rate-limit';
import {
  isSessionToken,
  newSessionToken,
  parseRegistrationReference,
  registrationReference,
  sessionState,
} from './registration-sessions';

const at = (hhmm: string) => new Date(`2026-11-01T${hhmm}:00+03:00`);

describe('sessionState', () => {
  const s = { opensAt: at('08:00'), closesAt: at('12:00'), closedAt: null };

  it('is open from opens_at to closes_at (exclusive)', () => {
    assert.equal(sessionState(s, at('07:59')), 'scheduled');
    assert.equal(sessionState(s, at('08:00')), 'open');
    assert.equal(sessionState(s, at('11:59')), 'open');
    assert.equal(sessionState(s, at('12:00')), 'closed');
  });

  it('is closed once closed early', () => {
    assert.equal(
      sessionState({ ...s, closedAt: at('09:00') }, at('09:30')),
      'closed',
    );
  });
});

describe('session tokens and references', () => {
  it('makes random 32-character URL-safe tokens', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    assert.notEqual(a, b);
    assert.equal(isSessionToken(a), true);
    assert.equal(isSessionToken('short'), false);
    assert.equal(isSessionToken(`${a.slice(0, 31)}/`), false);
    assert.equal(isSessionToken(null), false);
  });

  it('round-trips references', () => {
    assert.equal(registrationReference(42), 'R-42');
    assert.equal(parseRegistrationReference('r-42'), 42);
    assert.equal(parseRegistrationReference(' R42 '), 42);
    assert.equal(parseRegistrationReference('FYP-2019-0001'), null);
  });
});

describe('rate limit (database)', async () => {
  const url =
    process.env['DATABASE_URL'] ??
    'postgres://felege:felege@localhost:5432/felege';
  const KEY = `test:${newSessionToken()}`;
  let client: import('postgres').Sql | null = null;
  let db: import('drizzle-orm/postgres-js').PostgresJsDatabase | null = null;

  try {
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    client = postgres(url, {
      max: 10,
      connect_timeout: 3,
      onnotice: () => undefined,
    });
    await client`select 1 from rate_limits limit 1`;
    db = drizzle(client);
  } catch {
    await client?.end();
    client = null;
  }

  const cleanup = async () => {
    if (client) await client`delete from rate_limits where key = ${KEY}`;
  };
  before(cleanup);
  after(async () => {
    await cleanup();
    await client?.end();
  });

  it(
    'allows `max` requests per window, also in parallel',
    {
      skip: !db && 'no database',
    },
    async () => {
      const conn = db;
      if (!conn) return;
      const results = await Promise.all(
        Array.from({ length: 8 }, () => hitRateLimit(conn, KEY, 600, 5)),
      );
      assert.equal(results.filter(Boolean).length, 5);
      assert.equal(await hitRateLimit(conn, KEY, 600, 5), false);
    },
  );
});
