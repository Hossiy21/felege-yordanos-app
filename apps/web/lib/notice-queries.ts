/**
 * Notice board reads, shared by /notices, the dashboard and /admin/notices.
 * Callers check the permission rules (lib/permissions.ts) first.
 */
import 'server-only';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  type SQL,
} from 'drizzle-orm';
import {
  db,
  departments,
  members,
  noticeReads,
  notices,
  profiles,
} from '@felege-yordanos/db/server';
import type { Audience } from './audience';
import type { NoticeView } from './notices';
import { isAdmin } from './permissions';
import type { CurrentUser } from './session';

/** Departments a user may post notices to: all for admins, else their own. */
export async function postableDepartments(user: CurrentUser) {
  const query = db
    .select({
      id: departments.id,
      nameEn: departments.nameEn,
      nameAm: departments.nameAm,
    })
    .from(departments)
    .orderBy(asc(departments.id));
  if (isAdmin(user)) return query;
  if (user.departmentId == null) return [];
  return query.where(eq(departments.id, user.departmentId));
}

export async function listNotices({
  userId,
  includeExpired,
  departmentId,
  audiences,
  limit,
}: {
  /** The current user: decides which notices count as read. */
  userId: string;
  /** Staff see expired notices too (canSeeExpiredNotices). */
  includeExpired: boolean;
  /** undefined = all, null = only "Everyone", a number = that department. */
  departmentId?: number | null;
  /**
   * Notices for these audiences only (visibleAudiences in
   * lib/permissions.ts); null = all (staff). Required so no caller forgets it.
   */
  audiences: Audience[] | null;
  limit?: number;
}): Promise<NoticeView[]> {
  const now = new Date();
  const where: SQL[] = [];
  const active = or(isNull(notices.expiresAt), gt(notices.expiresAt, now));
  if (!includeExpired && active) where.push(active);
  if (departmentId === null) where.push(isNull(notices.departmentId));
  else if (departmentId !== undefined)
    where.push(eq(notices.departmentId, departmentId));
  if (audiences !== null) {
    if (audiences.length === 0) return [];
    where.push(inArray(notices.audience, audiences));
  }

  const query = db
    .select({
      notice: notices,
      departmentNameEn: departments.nameEn,
      departmentNameAm: departments.nameAm,
      profileName: profiles.displayName,
      memberName: members.name,
      memberFatherName: members.fatherName,
      readAt: noticeReads.readAt,
    })
    .from(notices)
    .leftJoin(departments, eq(departments.id, notices.departmentId))
    .leftJoin(profiles, eq(profiles.id, notices.createdBy))
    .leftJoin(members, eq(members.authUserId, notices.createdBy))
    .leftJoin(
      noticeReads,
      and(eq(noticeReads.noticeId, notices.id), eq(noticeReads.userId, userId)),
    )
    .where(and(...where))
    .orderBy(desc(notices.pinned), desc(notices.createdAt))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);

  return rows.map((r) => {
    const n = r.notice;
    // Same name rule as getCurrentUser: profile name, else the member register.
    const profileName = r.profileName?.includes('@') ? null : r.profileName;
    const memberName = [r.memberName, r.memberFatherName]
      .filter(Boolean)
      .join(' ');
    return {
      id: n.id,
      title: n.title,
      summary: n.summary,
      body: n.body,
      category: n.category,
      departmentId: n.departmentId,
      audience: n.audience,
      departmentNameEn: r.departmentNameEn,
      departmentNameAm: r.departmentNameAm,
      imageKey: n.imageKey,
      pinned: n.pinned,
      expiresAt: n.expiresAt?.toISOString() ?? null,
      expired: !!n.expiresAt && n.expiresAt <= now,
      createdAt: n.createdAt.toISOString(),
      authorName: profileName?.trim() || memberName || null,
      read: r.readAt !== null,
    };
  });
}
