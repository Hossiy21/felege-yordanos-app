import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emailKey,
  preMemberEmailMatch,
  suggestedPreMemberCode,
  type MatchAccount,
  type MatchCandidate,
} from './pre-member-match';

const account = (over: Partial<MatchAccount> = {}): MatchAccount => ({
  email: 'abebe@example.com',
  emailVerified: true,
  linked: false,
  pendingRequest: false,
  rejectedPreMemberIds: [],
  ...over,
});

const record = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: 1,
  code: 'FYP-2019-0001',
  status: 'active',
  email: 'abebe@example.com',
  authUserId: null,
  ...over,
});

describe('claim suggestion', () => {
  it('suggests the one active, unlinked record with the email', () => {
    assert.equal(suggestedPreMemberCode(account(), [record()]), 'FYP-2019-0001');
  });

  it('needs a verified email', () => {
    assert.equal(
      suggestedPreMemberCode(account({ emailVerified: false }), [record()]),
      null,
    );
  });

  it('never suggests to linked accounts or accounts with an open request', () => {
    assert.equal(
      suggestedPreMemberCode(account({ linked: true }), [record()]),
      null,
    );
    assert.equal(
      suggestedPreMemberCode(account({ pendingRequest: true }), [record()]),
      null,
    );
  });

  it('suggests nothing for 0 or 2 matching records', () => {
    assert.equal(suggestedPreMemberCode(account(), []), null);
    assert.equal(
      suggestedPreMemberCode(account(), [
        record({ email: 'someone@example.com' }),
      ]),
      null,
    );
    assert.equal(
      suggestedPreMemberCode(account(), [
        record(),
        record({ id: 2, code: 'FYP-2019-0002' }),
      ]),
      null,
    );
  });

  it('only active records match', () => {
    for (const status of ['pending', 'rejected', 'withdrawn', 'promoted'] as const) {
      assert.equal(
        suggestedPreMemberCode(account(), [record({ status })]),
        null,
        status,
      );
    }
    // An old rejected duplicate does not hide the active record.
    assert.equal(
      suggestedPreMemberCode(account(), [
        record({ id: 2, status: 'rejected', code: null }),
        record(),
      ]),
      'FYP-2019-0001',
    );
  });

  it('skips records linked to an account', () => {
    assert.equal(
      suggestedPreMemberCode(account(), [record({ authUserId: 'other' })]),
      null,
    );
    // Same email on two active records, one taken: still ambiguous.
    assert.equal(
      suggestedPreMemberCode(account(), [
        record({ authUserId: 'other' }),
        record({ id: 2, code: 'FYP-2019-0002' }),
      ]),
      null,
    );
  });

  it('does not suggest a record an admin refused for this account', () => {
    assert.equal(
      suggestedPreMemberCode(account({ rejectedPreMemberIds: [1] }), [record()]),
      null,
    );
    assert.equal(
      suggestedPreMemberCode(account({ rejectedPreMemberIds: [7] }), [record()]),
      'FYP-2019-0001',
    );
  });

  it('ignores case and surrounding spaces in emails', () => {
    assert.equal(
      suggestedPreMemberCode(account({ email: ' Abebe@Example.COM ' }), [
        record({ email: 'abebe@example.com ' }),
      ]),
      'FYP-2019-0001',
    );
    assert.equal(emailKey('  '), null);
    assert.equal(emailKey(null), null);
    assert.equal(suggestedPreMemberCode(account({ email: ' ' }), [record({ email: ' ' })]), null);
  });

  it('records without an email never match', () => {
    assert.equal(
      suggestedPreMemberCode(account(), [record({ email: null })]),
      null,
    );
  });
});

describe('admin email badge', () => {
  const verified = { email: 'Abebe@example.com', emailVerified: true };

  it('matches a verified account with the record email', () => {
    assert.equal(preMemberEmailMatch(verified, 'abebe@example.com'), 'match');
  });

  it('is different for another email or an unverified account', () => {
    assert.equal(preMemberEmailMatch(verified, 'kebede@example.com'), 'different');
    assert.equal(
      preMemberEmailMatch({ ...verified, emailVerified: false }, 'abebe@example.com'),
      'different',
    );
  });

  it('shows nothing when the record has no email', () => {
    assert.equal(preMemberEmailMatch(verified, null), null);
    assert.equal(preMemberEmailMatch(verified, ' '), null);
  });
});
