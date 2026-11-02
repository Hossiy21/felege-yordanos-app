/**
 * Application tables.
 *
 * Exact mirror of the live Supabase database (exported 2026-10-02), so that
 * production data can be copied across 1:1 at cutover. Table names, column
 * names, types, nullability, defaults and constraints match production.
 * Tighten things (NOT NULL, new defaults) in later migrations, after the
 * data has been checked, never in this mirror.
 *
 * Differences from production (intentional):
 * - No RLS policies. Authorization is enforced in server code.
 * - profiles.id and members.auth_user_id reference auth_users (Better Auth)
 *   instead of Supabase's auth.users. Constraint names are unchanged.
 *
 * Note: the old supabase/migrations folder (now removed) did not match
 * production; this file is the reference.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  foreignKey,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authUsers } from './auth';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).defaultNow();
// Ids in production have no default: they are always set explicitly
// (departments and members come from the parish register).
const bigintId = (name = 'id') => bigint(name, { mode: 'number' });

// Foreign keys are declared at table level so their names match production
// (Drizzle's column-level .references() generates different names).

export const ROLES = ['member', 'dept_head', 'admin', 'super_admin'] as const;
export type Role = (typeof ROLES)[number];

/* ─── Departments ─────────────────────────────────────────── */

export const departments = pgTable('departments', {
  id: bigintId().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameAm: text('name_am').notNull(),
  createdAt: createdAt(),
});

/* ─── Profiles (one per login account) ───────────────────── */

export const profiles = pgTable(
  'profiles',
  {
    // Same id as the auth user (auth_users.id).
    id: uuid('id').primaryKey(),
    role: text('role').$type<Role>().notNull().default('member'),
    departmentId: bigintId('department_id'),
    displayName: text('display_name'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'profiles_role_check',
      sql`${t.role} = ANY (ARRAY['member'::text, 'dept_head'::text, 'admin'::text, 'super_admin'::text])`,
    ),
    foreignKey({
      name: 'profiles_id_fkey',
      columns: [t.id],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'profiles_department_id_fkey',
      columns: [t.departmentId],
      foreignColumns: [departments.id],
    }),
  ],
);

/* ─── Members (parish register) ──────────────────────────── */

export const GENDERS = ['ወንድ', 'ሴት'] as const;
export type Gender = (typeof GENDERS)[number];

export const memberTypes = pgTable('member_types', {
  id: bigintId().primaryKey(),
  name: text('name').notNull().unique('member_types_name_key'),
});

export const members = pgTable(
  'members',
  {
    id: bigintId().primaryKey(),
    memberId: text('member_id').notNull().unique('members_member_id_key'),
    memberTypeId: bigintId('member_type_id'),
    departmentId: bigintId('department_id'),
    memberState: text('member_state'),
    status: text('status').default('Active'),
    registrationDate: date('registration_date'),
    documentNumber: text('document_number'),
    title: text('title'),
    name: text('name').notNull(),
    fatherName: text('father_name').notNull(),
    grandfatherName: text('grandfather_name'),
    motherFullName: text('mother_full_name'),
    godName: text('god_name'),
    baptisedChurch: text('baptised_church'),
    birthDate: date('birth_date'),
    gender: text('gender').$type<Gender>(),
    maritalStatus: text('marital_status'),
    addressState: text('address_state'),
    addressCity: text('address_city'),
    addressSubCity: text('address_sub_city'),
    addressWoreda: text('address_woreda'),
    addressSefer: text('address_sefer'),
    addressPhone: text('address_phone'),
    addressPhoneTwo: text('address_phone_two'),
    addressEmail: text('address_email'),
    addressHouseNumber: text('address_house_number'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Login account linked through the /claim flow.
    authUserId: uuid('auth_user_id').unique('members_auth_user_id_key'),
  },
  (t) => [
    check(
      'members_gender_check',
      sql`${t.gender} = ANY (ARRAY['ወንድ'::text, 'ሴት'::text])`,
    ),
    index('idx_members_auth_user_id').on(t.authUserId),
    foreignKey({
      name: 'members_auth_user_id_fkey',
      columns: [t.authUserId],
      foreignColumns: [authUsers.id],
    }),
    foreignKey({
      name: 'members_member_type_id_fkey',
      columns: [t.memberTypeId],
      foreignColumns: [memberTypes.id],
    }),
    foreignKey({
      name: 'members_department_id_fkey',
      columns: [t.departmentId],
      foreignColumns: [departments.id],
    }),
  ],
);

export const memberJobs = pgTable(
  'member_jobs',
  {
    id: bigintId().primaryKey(),
    memberId: bigintId('member_id').notNull(),
    jobType: text('job_type'),
    company: text('company'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    tillPresent: boolean('till_present').default(false),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'member_jobs_member_id_fkey',
      columns: [t.memberId],
      foreignColumns: [members.id],
    }).onDelete('cascade'),
  ],
);

export const memberAcademicEducation = pgTable(
  'member_academic_education',
  {
    id: bigintId().primaryKey(),
    memberId: bigintId('member_id').notNull(),
    level: text('level'),
    fieldOfStudy: text('field_of_study'),
    institution: text('institution'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    tillPresent: boolean('till_present').default(false),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'member_academic_education_member_id_fkey',
      columns: [t.memberId],
      foreignColumns: [members.id],
    }).onDelete('cascade'),
  ],
);

export const memberSpiritualEducation = pgTable(
  'member_spiritual_education',
  {
    id: bigintId().primaryKey(),
    memberId: bigintId('member_id').notNull(),
    title: text('title'),
    college: text('college'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    awardBy: text('award_by'),
    customAwardGiver: text('custom_award_giver'),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'member_spiritual_education_member_id_fkey',
      columns: [t.memberId],
      foreignColumns: [members.id],
    }).onDelete('cascade'),
  ],
);

/* ─── Registration sessions (/join) ──────────────────────── */

/**
 * A self-registration window for pre-members: an admin opens it, the app
 * shows a QR to /join?s=<token>. The token only works while the session is
 * open (opens_at <= now < closes_at, not closed early).
 */
export const registrationSessions = pgTable(
  'registration_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Random, unguessable; never reused.
    token: text('token').notNull().unique('registration_sessions_token_key'),
    label: text('label').notNull(),
    opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    // Closed early by an admin.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'registration_sessions_window_check',
      sql`${t.closesAt} > ${t.opensAt}`,
    ),
    index('idx_registration_sessions_opens_at').on(t.opensAt.desc()),
    foreignKey({
      name: 'registration_sessions_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'registration_sessions_closed_by_fkey',
      columns: [t.closedBy],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
  ],
);

/**
 * Request counts per key and time window (self-registration rate limits:
 * per IP and per session). Old windows are pruned as new ones are written.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'rate_limits_pkey', columns: [t.key, t.windowStart] }),
    index('idx_rate_limits_window_start').on(t.windowStart),
  ],
);

/* ─── Pre-members (ቅድመ አባል) ─────────────────────────────── */

/**
 * People learning at the school who are not registered members yet (no SSU
 * ID). Kept apart from `members`, which mirrors the SSU register. Approval
 * assigns `code` (FYP-<Ethiopian year>-<4 digits>, from
 * pre_member_id_counters); an admin promotes them once their member row
 * exists. Every change is logged in pre_member_history.
 */
export const PRE_MEMBER_STATUSES = [
  'pending',
  'active',
  'rejected',
  'withdrawn',
  'promoted',
] as const;
export type PreMemberStatus = (typeof PRE_MEMBER_STATUSES)[number];

export const PRE_MEMBER_SOURCES = ['self', 'admin'] as const;
export type PreMemberSource = (typeof PRE_MEMBER_SOURCES)[number];

export const preMembers = pgTable(
  'pre_members',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    // Assigned on approval, never reused.
    code: text('code').unique('pre_members_code_key'),
    status: text('status')
      .$type<PreMemberStatus>()
      .notNull()
      .default('pending'),
    source: text('source').$type<PreMemberSource>().notNull(),
    name: text('name').notNull(),
    fatherName: text('father_name').notNull(),
    grandfatherName: text('grandfather_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    // Rejection or withdrawal note (admins only).
    note: text('note'),
    // Self-registration: the session whose QR was used.
    sessionId: uuid('session_id'),
    // Login account linked through /claim.
    authUserId: uuid('auth_user_id').unique('pre_members_auth_user_id_key'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'),
    promotedMemberId: bigintId('promoted_member_id'),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
    promotedBy: uuid('promoted_by'),
    // The promotion set members.auth_user_id (undo removes only that link).
    promotionLinkedAccount: boolean('promotion_linked_account')
      .notNull()
      .default(false),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'pre_members_status_check',
      sql`${t.status} = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'withdrawn'::text, 'promoted'::text])`,
    ),
    check(
      'pre_members_source_check',
      sql`${t.source} = ANY (ARRAY['self'::text, 'admin'::text])`,
    ),
    // Approved records always have an ID.
    check(
      'pre_members_code_check',
      sql`${t.status} IN ('pending', 'rejected') OR ${t.code} IS NOT NULL`,
    ),
    check(
      'pre_members_promoted_check',
      sql`${t.status} <> 'promoted' OR ${t.promotedMemberId} IS NOT NULL`,
    ),
    index('idx_pre_members_status').on(t.status),
    index('idx_pre_members_session_id').on(t.sessionId),
    foreignKey({
      name: 'pre_members_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [registrationSessions.id],
    }).onDelete('set null'),
    index('idx_pre_members_phone').on(t.phone),
    index('idx_pre_members_email').on(sql`lower(${t.email})`),
    // One promotion per member row.
    uniqueIndex('pre_members_promoted_member_id_key')
      .on(t.promotedMemberId)
      .where(sql`${t.status} = 'promoted'`),
    foreignKey({
      name: 'pre_members_auth_user_id_fkey',
      columns: [t.authUserId],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'pre_members_promoted_member_id_fkey',
      columns: [t.promotedMemberId],
      foreignColumns: [members.id],
    }),
    foreignKey({
      name: 'pre_members_approved_by_fkey',
      columns: [t.approvedBy],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'pre_members_promoted_by_fkey',
      columns: [t.promotedBy],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'pre_members_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
  ],
);

/** Last number given out per Ethiopian year (FYP-<year>-<number>). */
export const preMemberIdCounters = pgTable('pre_member_id_counters', {
  year: integer('year').primaryKey(),
  last: integer('last').notNull(),
});

export const PRE_MEMBER_ACTIONS = [
  'submitted',
  'created',
  'approved',
  'rejected',
  'edited',
  'linked',
  'unlinked',
  'promoted',
  'promotion_undone',
  'withdrawn',
  'reinstated',
] as const;
export type PreMemberAction = (typeof PRE_MEMBER_ACTIONS)[number];

/**
 * Who did what to a pre-member, and when (server time). Append-only: a
 * trigger refuses UPDATE and DELETE. actor_user_id is null for
 * self-registration.
 */
export const preMemberHistory = pgTable(
  'pre_member_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    preMemberId: bigintId('pre_member_id').notNull(),
    action: text('action').$type<PreMemberAction>().notNull(),
    actorUserId: uuid('actor_user_id'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    details: jsonb('details')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    check(
      'pre_member_history_action_check',
      sql`${t.action} = ANY (ARRAY['submitted'::text, 'created'::text, 'approved'::text, 'rejected'::text, 'edited'::text, 'linked'::text, 'unlinked'::text, 'promoted'::text, 'promotion_undone'::text, 'withdrawn'::text, 'reinstated'::text])`,
    ),
    index('idx_pre_member_history_pre_member_id').on(t.preMemberId, t.at),
    foreignKey({
      name: 'pre_member_history_pre_member_id_fkey',
      columns: [t.preMemberId],
      foreignColumns: [preMembers.id],
    }),
    foreignKey({
      name: 'pre_member_history_actor_user_id_fkey',
      columns: [t.actorUserId],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
  ],
);

/* ─── Songbook ───────────────────────────────────────────── */

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique('categories_name_key'),
  emoji: text('emoji').default('🎵'),
  color: text('color').default('#0E7490'),
  sortOrder: integer('sort_order').default(0),
  createdAt: createdAt(),
});

export const songs = pgTable('songs', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: integer('number').unique('songs_number_key'),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  // Category name. Production has no foreign key here.
  category: text('category').notNull(),
  lyrics: text('lyrics').notNull(),
  // External recording link (pasted URL).
  audioUrl: text('audio_url'),
  // Uploaded recording in the media store ("audio/<uuid>.<ext>"). Played
  // instead of audio_url when both are set.
  audioKey: text('audio_key'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** The latest time each signed-in user opened each song. */
export const songViews = pgTable(
  'song_views',
  {
    userId: uuid('user_id').notNull(),
    songId: uuid('song_id').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'song_views_pkey', columns: [t.userId, t.songId] }),
    index('idx_song_views_user_viewed_at').on(t.userId, t.viewedAt.desc()),
    foreignKey({
      name: 'song_views_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'song_views_song_id_fkey',
      columns: [t.songId],
      foreignColumns: [songs.id],
    }).onDelete('cascade'),
  ],
);

/* ─── Events & attendance ────────────────────────────────── */

export const RECURRENCES = ['weekly', 'biweekly', 'monthly'] as const;

/**
 * Who an event or notice is for. Members see 'members' and 'everyone',
 * pre-members 'pre_members' and 'everyone', staff all. Rules in
 * lib/permissions.ts, expected people at an event in lib/expected-people.ts.
 */
export const AUDIENCES = ['members', 'pre_members', 'everyone'] as const;
export type Audience = (typeof AUDIENCES)[number];
export type Recurrence = (typeof RECURRENCES)[number];

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    eventDate: date('event_date').notNull(),
    departmentId: bigintId('department_id'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    startTime: time('start_time'),
    endTime: time('end_time'),
    // Shared id linking all occurrences of one recurring series.
    recurrenceGroup: uuid('recurrence_group'),
    recurrence: text('recurrence').$type<Recurrence>(),
    // Current end date of the series (<= 12 months from start, enforced in app).
    recurrenceUntil: date('recurrence_until'),
    // Check-in window relative to the start time (Ethiopian time). Department
    // heads can only check people in inside it; admins at any time.
    checkInOpensBeforeMin: integer('check_in_opens_before_min')
      .notNull()
      .default(20),
    checkInClosesAfterMin: integer('check_in_closes_after_min')
      .notNull()
      .default(20),
    // Set when a volunteer or admin closes the event: unmarked members were
    // marked absent (method 'auto_close') and check-in stopped.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by'),
    audience: text('audience').$type<Audience>().notNull().default('members'),
  },
  (t) => [
    check(
      'events_audience_check',
      sql`${t.audience} = ANY (ARRAY['members'::text, 'pre_members'::text, 'everyone'::text])`,
    ),
    check(
      'events_check_in_window_check',
      sql`${t.checkInOpensBeforeMin} BETWEEN 0 AND 720 AND ${t.checkInClosesAfterMin} BETWEEN 0 AND 720`,
    ),
    check(
      'events_recurrence_check',
      sql`(${t.recurrence} IS NULL) OR (${t.recurrence} = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text]))`,
    ),
    index('idx_events_department_id').on(t.departmentId),
    index('idx_events_date').on(t.eventDate.desc().nullsFirst()),
    index('idx_events_recurrence_group')
      .on(t.recurrenceGroup)
      .where(sql`${t.recurrenceGroup} IS NOT NULL`),
    foreignKey({
      name: 'events_department_id_fkey',
      columns: [t.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      name: 'events_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [profiles.id],
    }),
    foreignKey({
      name: 'events_closed_by_fkey',
      columns: [t.closedBy],
      foreignColumns: [profiles.id],
    }),
  ],
);

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** How a check-in was made: which check-in tab, or the event close. */
export const CHECK_IN_METHODS = ['qr', 'quick_id', 'list', 'auto_close'] as const;
export type CheckInMethod = (typeof CHECK_IN_METHODS)[number];

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').notNull(),
    // Exactly one of member_id / pre_member_id is set.
    memberId: bigintId('member_id'),
    preMemberId: bigintId('pre_member_id'),
    status: text('status').$type<AttendanceStatus>().notNull(),
    markedBy: uuid('marked_by'),
    createdAt: createdAt(),
    // Server time of the first present/late mark; null for absent and for
    // rows marked before times were recorded.
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    method: text('method').$type<CheckInMethod>(),
  },
  (t) => [
    unique('attendance_event_id_member_id_key').on(t.eventId, t.memberId),
    unique('attendance_event_id_pre_member_id_key').on(
      t.eventId,
      t.preMemberId,
    ),
    check(
      'attendance_one_person_check',
      sql`(${t.memberId} IS NULL) <> (${t.preMemberId} IS NULL)`,
    ),
    check(
      'attendance_status_check',
      sql`${t.status} = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text])`,
    ),
    check(
      'attendance_method_check',
      sql`(${t.method} IS NULL) OR (${t.method} = ANY (ARRAY['qr'::text, 'quick_id'::text, 'list'::text, 'auto_close'::text]))`,
    ),
    index('idx_attendance_event_id').on(t.eventId),
    index('idx_attendance_member_id').on(t.memberId),
    index('idx_attendance_pre_member_id').on(t.preMemberId),
    foreignKey({
      name: 'attendance_event_id_fkey',
      columns: [t.eventId],
      foreignColumns: [events.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'attendance_member_id_fkey',
      columns: [t.memberId],
      foreignColumns: [members.id],
    }),
    foreignKey({
      name: 'attendance_pre_member_id_fkey',
      columns: [t.preMemberId],
      foreignColumns: [preMembers.id],
    }),
    foreignKey({
      name: 'attendance_marked_by_fkey',
      columns: [t.markedBy],
      foreignColumns: [profiles.id],
    }),
  ],
);

/* ─── Donations ──────────────────────────────────────────── */

export const PAYMENT_METHODS = [
  'bank_transfer',
  'telebirr',
  'cash',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const DONATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const donations = pgTable(
  'donations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donorId: uuid('donor_id').notNull(),
    // Returned as a string by the driver to avoid floating point errors.
    amount: numeric('amount').notNull(),
    currency: text('currency').default('ETB'),
    paymentMethod: text('payment_method').$type<PaymentMethod>(),
    // Storage key of the receipt file, e.g. "<user id>/<file name>".
    receiptUrl: text('receipt_url'),
    notes: text('notes'),
    status: text('status').$type<DonationStatus>().notNull().default('pending'),
    verifiedBy: uuid('verified_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    rejectionReason: text('rejection_reason'),
  },
  (t) => [
    check(
      'donations_payment_method_check',
      sql`${t.paymentMethod} = ANY (ARRAY['bank_transfer'::text, 'telebirr'::text, 'cash'::text, 'other'::text])`,
    ),
    check(
      'donations_status_check',
      sql`${t.status} = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])`,
    ),
    index('idx_donations_donor_id').on(t.donorId),
    index('idx_donations_status').on(t.status),
    foreignKey({
      name: 'donations_donor_id_fkey',
      columns: [t.donorId],
      foreignColumns: [profiles.id],
    }),
    foreignKey({
      name: 'donations_verified_by_fkey',
      columns: [t.verifiedBy],
      foreignColumns: [profiles.id],
    }),
  ],
);

/* ─── Member link requests ───────────────────────────────── */

/**
 * A signed-in user asks to be linked to a member record (members.member_id)
 * or to a pre-member record (pre_members.code): exactly one of member_id /
 * pre_member_id is set. An admin approves or rejects it; approval sets
 * members.auth_user_id or pre_members.auth_user_id. Ids are sequential, so
 * linking is never automatic.
 */
export const LINK_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;
export type LinkRequestStatus = (typeof LINK_REQUEST_STATUSES)[number];

export const memberLinkRequests = pgTable(
  'member_link_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    memberId: bigintId('member_id'),
    preMemberId: bigintId('pre_member_id'),
    status: text('status')
      .$type<LinkRequestStatus>()
      .notNull()
      .default('pending'),
    // Shown to the requester when a request is rejected.
    note: text('note'),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'member_link_requests_status_check',
      sql`${t.status} = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`,
    ),
    check(
      'member_link_requests_one_record_check',
      sql`(${t.memberId} IS NULL) <> (${t.preMemberId} IS NULL)`,
    ),
    // At most one open request per account.
    uniqueIndex('member_link_requests_one_pending_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index('idx_member_link_requests_status').on(t.status),
    foreignKey({
      name: 'member_link_requests_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'member_link_requests_member_id_fkey',
      columns: [t.memberId],
      foreignColumns: [members.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'member_link_requests_pre_member_id_fkey',
      columns: [t.preMemberId],
      foreignColumns: [preMembers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'member_link_requests_decided_by_fkey',
      columns: [t.decidedBy],
      foreignColumns: [authUsers.id],
    }).onDelete('set null'),
  ],
);

/* ─── Notice board ───────────────────────────────────────── */

export const NOTICE_CATEGORIES = [
  'general',
  'urgent',
  'event',
  'liturgical',
  'fundraising',
  'community',
] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];

/**
 * Announcements on /notices. department_id null = for everyone (parish-wide).
 * Who may post or edit: lib/permissions.ts (canPostNotice, canEditNotice).
 */
export const notices = pgTable(
  'notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    // Optional one-sentence lead, shown above the message and in previews.
    summary: text('summary'),
    // Plain text; line breaks are kept.
    body: text('body').notNull(),
    category: text('category')
      .$type<NoticeCategory>()
      .notNull()
      .default('general'),
    departmentId: bigintId('department_id'),
    audience: text('audience').$type<Audience>().notNull().default('members'),
    // Image in the media store ("notices/<uuid>.<ext>").
    imageKey: text('image_key'),
    pinned: boolean('pinned').notNull().default(false),
    // Hidden from members from this moment on (staff still see it).
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'notices_audience_check',
      sql`${t.audience} = ANY (ARRAY['members'::text, 'pre_members'::text, 'everyone'::text])`,
    ),
    check(
      'notices_category_check',
      sql`${t.category} = ANY (ARRAY['general'::text, 'urgent'::text, 'event'::text, 'liturgical'::text, 'fundraising'::text, 'community'::text])`,
    ),
    index('idx_notices_created_at').on(t.createdAt.desc()),
    index('idx_notices_department_id').on(t.departmentId),
    foreignKey({
      name: 'notices_department_id_fkey',
      columns: [t.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      name: 'notices_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [profiles.id],
    }).onDelete('set null'),
  ],
);

/** Which notices each user has opened (unread count and dots on /notices). */
export const noticeReads = pgTable(
  'notice_reads',
  {
    noticeId: uuid('notice_id').notNull(),
    userId: uuid('user_id').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'notice_reads_pkey', columns: [t.noticeId, t.userId] }),
    index('idx_notice_reads_user_id').on(t.userId),
    foreignKey({
      name: 'notice_reads_notice_id_fkey',
      columns: [t.noticeId],
      foreignColumns: [notices.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'notice_reads_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
  ],
);
