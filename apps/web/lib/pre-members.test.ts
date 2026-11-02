import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  expectedKinds,
  expectedPeople,
  parsePersonKey,
  personKey,
} from './audience';
import { nextPreMemberNumber } from './pre-member-ids';
import {
  ethiopianYearOf,
  formatPreMemberCode,
  parsePreMemberCode,
  phoneKey,
} from './pre-members';
import { classifyScanCode, scanLookupKey } from './scan-code';

describe('pre-member codes', () => {
  it('formats the year and a 4-digit number', () => {
    assert.equal(formatPreMemberCode(2019, 1), 'FYP-2019-0001');
    assert.equal(formatPreMemberCode(2019, 42), 'FYP-2019-0042');
    assert.equal(formatPreMemberCode(2019, 12345), 'FYP-2019-12345');
  });

  it('normalizes typed codes, any case', () => {
    assert.equal(parsePreMemberCode('fyp-2019-1'), 'FYP-2019-0001');
    assert.equal(parsePreMemberCode(' FYP-2019-0007 '), 'FYP-2019-0007');
    assert.equal(parsePreMemberCode('FYP-19-0001'), null);
    assert.equal(parsePreMemberCode('FYP-2019-'), null);
    assert.equal(parsePreMemberCode('ssu/01/03/05/00042'), null);
  });

  it('uses the Ethiopian year in Addis Ababa time', () => {
    // Meskerem 1, 2019 E.C. = 11 September 2026.
    assert.equal(ethiopianYearOf(new Date('2026-09-10T12:00:00+03:00')), 2018);
    assert.equal(ethiopianYearOf(new Date('2026-09-11T00:30:00+03:00')), 2019);
    // 22:00 UTC on 10 September is already 11 September in Addis Ababa.
    assert.equal(ethiopianYearOf(new Date('2026-09-10T22:00:00Z')), 2019);
    assert.equal(ethiopianYearOf(new Date('2026-10-31T09:00:00Z')), 2019);
  });

  it('compares phones by their last 9 digits', () => {
    assert.equal(phoneKey('+251 911 234 567'), '911234567');
    assert.equal(phoneKey('0911234567'), '911234567');
    assert.equal(phoneKey('1234'), null);
    assert.equal(phoneKey(null), null);
  });
});

describe('classifyScanCode', () => {
  it('recognizes pre-member codes (case-insensitive)', () => {
    assert.deepEqual(classifyScanCode('FYP-2019-0001'), {
      kind: 'pre_member',
      code: 'FYP-2019-0001',
    });
    assert.deepEqual(classifyScanCode('fyp-2019-12'), {
      kind: 'pre_member',
      code: 'FYP-2019-0012',
    });
  });

  it('treats a broken FYP code as invalid, not as a member ID', () => {
    assert.deepEqual(classifyScanCode('FYP-abc'), { kind: 'invalid' });
  });

  it('fills in short member numbers', () => {
    assert.deepEqual(classifyScanCode('42'), {
      kind: 'member',
      memberId: 'ssu/01/03/05/00042',
    });
    assert.deepEqual(classifyScanCode('ssu/01/03/05/00042'), {
      kind: 'member',
      memberId: 'ssu/01/03/05/00042',
    });
  });

  it('refuses empty input', () => {
    assert.deepEqual(classifyScanCode('   '), { kind: 'invalid' });
  });

  it('gives one lookup key for every form of a code', () => {
    assert.equal(scanLookupKey('fyp-2019-1'), scanLookupKey('FYP-2019-0001'));
    assert.equal(scanLookupKey('42'), 'ssu/01/03/05/00042');
    assert.equal(scanLookupKey(''), null);
  });
});

describe('who is expected at an event', () => {
  const members = [
    { id: 1, code: 'ssu/01/03/05/00001', name: 'Abebe', fatherName: 'K' },
    { id: 2, code: 'ssu/01/03/05/00002', name: 'Selam', fatherName: 'T' },
  ];
  const preMembers = [
    { id: 1, code: 'FYP-2019-0001', name: 'Mekdes', fatherName: 'A' },
  ];

  it('members: only members', () => {
    const list = expectedPeople('members', members, preMembers);
    assert.deepEqual(
      list.map((p) => p.key),
      ['m:1', 'm:2'],
    );
    assert.deepEqual(expectedKinds('members'), ['member']);
  });

  it('pre_members: only pre-members', () => {
    const list = expectedPeople('pre_members', members, preMembers);
    assert.deepEqual(
      list.map((p) => p.key),
      ['p:1'],
    );
    assert.equal(list[0].kind, 'pre_member');
    assert.deepEqual(expectedKinds('pre_members'), ['pre_member']);
  });

  it('everyone: both, sorted by name, keys never collide', () => {
    const list = expectedPeople('everyone', members, preMembers);
    assert.deepEqual(
      list.map((p) => p.key),
      ['m:1', 'p:1', 'm:2'],
    );
    assert.deepEqual(expectedKinds('everyone'), ['member', 'pre_member']);
  });

  it('round-trips person keys and refuses bad ones', () => {
    assert.deepEqual(parsePersonKey(personKey('pre_member', 7)), {
      kind: 'pre_member',
      id: 7,
    });
    assert.deepEqual(parsePersonKey('m:12'), { kind: 'member', id: 12 });
    assert.equal(parsePersonKey('x:1'), null);
    assert.equal(parsePersonKey('m:0'), null);
    assert.equal(parsePersonKey('m:1;drop'), null);
  });
});

/**
 * ID counter against the real database (CI runs migrations before the tests).
 * Skipped when no database is reachable.
 */
describe('pre-member ID counter (database)', async () => {
  const url =
    process.env['DATABASE_URL'] ??
    'postgres://felege:felege@localhost:5432/felege';
  // A year no real approval uses.
  const YEAR = 1900;
  let client: import('postgres').Sql | null = null;
  let db: import('drizzle-orm/postgres-js').PostgresJsDatabase | null = null;

  try {
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    client = postgres(url, {
      max: 25,
      connect_timeout: 3,
      onnotice: () => undefined,
    });
    await client`select 1 from pre_member_id_counters limit 1`;
    db = drizzle(client);
  } catch {
    await client?.end();
    client = null;
  }

  const cleanup = async () => {
    if (client)
      await client`delete from pre_member_id_counters where year = ${YEAR}`;
  };
  before(cleanup);
  after(async () => {
    await cleanup();
    await client?.end();
  });

  it(
    'two approvals at the same time never get the same number',
    {
      skip: !db && 'no database',
    },
    async () => {
      const conn = db;
      if (!conn) return;
      const run = () =>
        conn.transaction(async (tx) => {
          const n = await nextPreMemberNumber(tx, YEAR);
          // Hold the row a little, as an approval does.
          await tx.execute(
            (await import('drizzle-orm')).sql`select pg_sleep(0.01)`,
          );
          return n;
        });
      const numbers = await Promise.all(Array.from({ length: 20 }, run));
      assert.deepEqual(
        [...numbers].sort((a, b) => a - b),
        Array.from({ length: 20 }, (_, i) => i + 1),
      );
    },
  );

  it(
    'a rolled-back approval leaves no gap',
    {
      skip: !db && 'no database',
    },
    async () => {
      const conn = db;
      if (!conn) return;
      await assert.rejects(
        conn.transaction(async (tx) => {
          await nextPreMemberNumber(tx, YEAR);
          throw new Error('approval failed');
        }),
      );
      const n = await conn.transaction((tx) => nextPreMemberNumber(tx, YEAR));
      assert.equal(n, 21);
    },
  );
});

describe('pre-member details', async () => {
  const { adminPreMemberSchema, diffDetails, preMemberDetailsSchema } =
    await import('./pre-member-schema');
  const base = {
    name: ' Mekdes ',
    fatherName: 'Alemu',
    grandfatherName: 'Bekele',
    email: 'Mekdes@Example.com',
    phone: '+251 911-234 567',
  };

  it('requires all five fields for self-registration', () => {
    const ok = preMemberDetailsSchema.parse(base);
    assert.equal(ok.name, 'Mekdes');
    assert.equal(ok.email, 'mekdes@example.com');
    assert.equal(ok.phone, '+251911234567');
    assert.equal(
      preMemberDetailsSchema.safeParse({ ...base, phone: '' }).success,
      false,
    );
    assert.equal(
      preMemberDetailsSchema.safeParse({ ...base, email: 'nope' }).success,
      false,
    );
    assert.equal(
      preMemberDetailsSchema.safeParse({ ...base, grandfatherName: ' ' })
        .success,
      false,
    );
  });

  it('lets admins leave email and phone empty', () => {
    const r = adminPreMemberSchema.parse({ ...base, email: '', phone: '' });
    assert.equal(r.email, null);
    assert.equal(r.phone, null);
    assert.equal(
      adminPreMemberSchema.safeParse({ ...base, phone: '12' }).success,
      false,
    );
  });

  it('lists only changed fields, old -> new', () => {
    const before = {
      name: 'A',
      fatherName: 'B',
      grandfatherName: 'C',
      email: null,
      phone: '0911',
    };
    assert.deepEqual(
      diffDetails(before, { ...before, name: 'A2', email: 'a@b.c' }),
      {
        name: { from: 'A', to: 'A2' },
        email: { from: null, to: 'a@b.c' },
      },
    );
    assert.deepEqual(diffDetails(before, before), {});
  });
});
