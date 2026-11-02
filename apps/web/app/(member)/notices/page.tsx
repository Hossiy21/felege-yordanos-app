import { redirect } from 'next/navigation';
import { listNotices, postableDepartments } from '@/lib/notice-queries';
import {
  canEditNotice,
  canManageNotices,
  canSeeExpiredNotices,
  canViewNotices,
  isAdmin,
  visibleAudiences,
} from '@/lib/permissions';
import { requireMemberOrPreMember } from '@/lib/session';
import { NoticeBoard } from './notice-board';

export default async function NoticesPage() {
  // Members and pre-members, each for their own audience.
  const user = await requireMemberOrPreMember();
  if (!canViewNotices(user)) redirect('/dashboard');
  const canManage = canManageNotices(user);

  const [notices, departments] = await Promise.all([
    listNotices({
      userId: user.id,
      includeExpired: canSeeExpiredNotices(user),
      audiences: visibleAudiences(user),
    }),
    canManage ? postableDepartments(user) : Promise.resolve([]),
  ]);

  return (
    <div className="px-[22px] pb-6 pt-4 md:px-7 md:py-7">
      <NoticeBoard
        notices={notices.map((n) => ({ ...n, canEdit: canEditNotice(user, n) }))}
        canManage={canManage}
        departments={departments}
        canPostToEveryone={isAdmin(user)}
      />
    </div>
  );
}
