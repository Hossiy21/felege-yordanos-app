import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { listNotices, postableDepartments } from '@/lib/notice-queries';
import { canEditNotice, canManageNotices, isAdmin } from '@/lib/permissions';
import { requireUser } from '@/lib/session';
import { NoticesList } from './notices-list';

export default async function ManageNoticesPage() {
  const user = await requireUser();
  if (!canManageNotices(user)) redirect('/admin');
  const t = await getT();

  // Admins manage every notice; department heads the ones of their department.
  const [all, departments] = await Promise.all([
    listNotices({
      userId: user.id,
      includeExpired: true,
      departmentId: isAdmin(user) ? undefined : user.departmentId,
      audiences: null,
    }),
    postableDepartments(user),
  ]);
  const notices = all.filter((n) => canEditNotice(user, n));

  return (
    <div className="mx-auto max-w-4xl px-[22px] pb-6 pt-4 md:mx-0 md:max-w-[1040px] md:px-7 md:py-7">
      <Link
        href="/admin"
        className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-gold-deep transition-colors hover:text-brand md:hidden dark:hover:text-gold-light"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('Admin panel')}
      </Link>
      <NoticesList
        notices={notices}
        departments={departments}
        canPostToEveryone={isAdmin(user)}
        sub={
          isAdmin(user)
            ? 'Post announcements for everyone or for any department.'
            : 'Post announcements for your department.'
        }
      />
    </div>
  );
}
