import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accessLevel,
  canCloseEvent,
  canManagePreMembers,
  canSeeAudience,
  canViewEvent,
  canViewNotices,
  hasMemberAccess,
  hasPreMemberAccess,
  canReopenEvent,
  canViewEventSummary,
  closableFrom,
} from './permissions';

// Department 2 event, Sunday 15:30 EAT, check-in 15:10–15:50.
const event = {
  departmentId: 2,
  eventDate: '2026-10-11',
  startTime: '15:30:00',
  checkInOpensBeforeMin: 20,
  checkInClosesAfterMin: 20,
};
const at = (hhmm: string) => new Date(`2026-10-11T${hhmm}+03:00`);

const head = { id: 'h', role: 'dept_head' as const, departmentId: 2 };
const otherHead = { id: 'o', role: 'dept_head' as const, departmentId: 6 };
const programsHead = { id: 'p', role: 'dept_head' as const, departmentId: 3 };
const admin = { id: 'a', role: 'admin' as const, departmentId: null };
const member = { id: 'm', role: 'member' as const, departmentId: 2 };

describe('canCloseEvent', () => {
  it('lets the department head close once the event has started', () => {
    assert.equal(canCloseEvent(head, event, at('15:29')), false);
    assert.equal(canCloseEvent(head, event, at('15:30')), true);
    // Long after the check-in window closed.
    assert.equal(canCloseEvent(head, event, at('19:00')), true);
    assert.equal(canCloseEvent(programsHead, event, at('16:00')), true);
  });

  it('lets admins close at any time', () => {
    assert.equal(canCloseEvent(admin, event, at('08:00')), true);
  });

  it('refuses other departments and members', () => {
    assert.equal(canCloseEvent(otherHead, event, at('16:00')), false);
    assert.equal(canCloseEvent(member, event, at('16:00')), false);
  });

  it('matches closableFrom', () => {
    assert.equal(closableFrom(admin, event), 0);
    assert.equal(closableFrom(head, event), at('15:30').getTime());
    assert.equal(closableFrom(otherHead, event), null);
  });
});

describe('canReopenEvent / canViewEventSummary', () => {
  it('reopen is for admins only', () => {
    assert.equal(canReopenEvent(admin), true);
    assert.equal(canReopenEvent({ ...admin, role: 'super_admin' }), true);
    assert.equal(canReopenEvent(head), false);
  });

  it('summary follows who can read the attendance', () => {
    assert.equal(canViewEventSummary(head, event), true);
    assert.equal(canViewEventSummary(programsHead, event), true);
    assert.equal(canViewEventSummary(otherHead, event), false);
  });
});

describe('pre-member access', () => {
  const base = {
    id: 'u',
    departmentId: null,
    emailVerified: true,
    memberRecordId: null,
    preMemberRecordId: null,
  };
  const guest = { ...base, role: 'member' as const };
  const linkedMember = { ...guest, memberRecordId: 12 };
  const preMember = { ...guest, preMemberRecordId: 3 };
  const unverifiedPre = { ...preMember, emailVerified: false };
  const staff = { ...base, role: 'admin' as const };

  it('derives the access level', () => {
    assert.equal(accessLevel(guest), 'guest');
    assert.equal(accessLevel(linkedMember), 'member');
    assert.equal(accessLevel(preMember), 'pre_member');
    assert.equal(accessLevel(unverifiedPre), 'guest');
    assert.equal(accessLevel(staff), 'staff');
  });

  it('never gives pre-members member access', () => {
    assert.equal(hasMemberAccess(preMember), false);
    assert.equal(hasPreMemberAccess(preMember), true);
    assert.equal(hasPreMemberAccess(unverifiedPre), false);
    assert.equal(canViewNotices(preMember), true);
    assert.equal(canViewNotices(guest), false);
  });

  it('shows events and notices by audience', () => {
    const ev = (audience: 'members' | 'pre_members' | 'everyone') => ({
      audience,
    });
    assert.equal(canViewEvent(linkedMember, ev('members')), true);
    assert.equal(canViewEvent(linkedMember, ev('everyone')), true);
    assert.equal(canViewEvent(linkedMember, ev('pre_members')), false);
    assert.equal(canViewEvent(preMember, ev('members')), false);
    assert.equal(canViewEvent(preMember, ev('pre_members')), true);
    assert.equal(canViewEvent(preMember, ev('everyone')), true);
    assert.equal(canViewEvent(guest, ev('everyone')), false);
    assert.equal(canSeeAudience(staff, 'pre_members'), true);
    assert.equal(canSeeAudience(staff, 'members'), true);
  });

  it('lets only admins manage pre-members', () => {
    assert.equal(canManagePreMembers(admin), true);
    assert.equal(canManagePreMembers(head), false);
    assert.equal(canManagePreMembers(programsHead), false);
    assert.equal(canManagePreMembers(member), false);
  });
});
