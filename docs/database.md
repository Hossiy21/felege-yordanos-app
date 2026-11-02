# Database

PostgreSQL 17 with Drizzle ORM. Everything lives in `libs/db`:

| Path | What |
|---|---|
| `src/schema/app.ts` | application tables (mirrors the original production schema) |
| `src/schema/auth.ts` | Better Auth tables |
| `src/server.ts` | server-only `db` client: `import { db } from '@felege-yordanos/db/server'` |
| `migrations/` | generated SQL migrations (never edit applied ones) |
| `scripts/seed.ts` | sample data and test logins |

## Tables

| Table | Purpose |
|---|---|
| departments | the 9 departments (ids set explicitly) |
| profiles | one per login: role, department, display name |
| members, member_types, member_jobs, member_academic_education, member_spiritual_education | parish member register |
| categories, songs | songbook |
| events, attendance | events (incl. recurring series) and check-ins; `events.audience` = `members` (default) / `pre_members` / `everyone`; an attendance row has exactly one of `member_id` / `pre_member_id` |
| pre_members | ቅድመ አባላት: people learning at the school without an SSU ID. Own table (never rows in `members`). `code` = `FYP-<Ethiopian year>-<4 digits>`, set on approval; status `pending` / `active` / `rejected` / `withdrawn` / `promoted`; promotion: `promoted_member_id`, `promoted_at`, `promoted_by`, `promotion_linked_account` |
| pre_member_id_counters | last FYP number per Ethiopian year (incremented inside the approval transaction) |
| pre_member_history | append-only log per pre-member: action, `actor_user_id` (null = self-registration), server time `at`, `details` jsonb. A trigger refuses UPDATE and DELETE |
| member_link_requests | `/claim` requests; exactly one of `member_id` / `pre_member_id` |
| registration_sessions | self-registration windows for `/join` (random `token`, `opens_at`, `closes_at`, `closed_at` when closed early); `pre_members.session_id` tags who registered through which session |
| rate_limits | request counts per key and fixed window (`/join` limits per IP and per session); windows older than a day are pruned |
| notices, notice_reads | notice board (`notices.audience` as for events) and read marks |
| donations | donations; receipt file key in `receipt_url` |
| auth_users, auth_sessions, auth_accounts, auth_verifications | Better Auth |

`members.auth_user_id` links a login to a member record, `pre_members.auth_user_id` to a pre-member record (both set when an admin approves a `/claim` request). Link requests for pre-members live in `member_link_requests` (nullable `pre_member_id` and a check that exactly one id is set) instead of a sibling table, so the admin queue and the one-open-request rule stay in one place.

## Workflow

```bash
pnpm db:setup        # start Postgres (Docker), migrate, seed
# edit libs/db/src/schema/*.ts
pnpm db:generate     # creates libs/db/migrations/NNNN_name.sql; commit it
pnpm db:migrate      # apply
pnpm db:studio       # browse data
docker compose down -v && pnpm db:setup   # wipe and start over
```

## Files

Receipts are stored on disk under `UPLOAD_DIR` (default `apps/web/.data/uploads`, git-ignored) and served by `app/api/receipts/[...key]` after a permission check. On the server this folder is a Docker volume that must be included in backups.
