import { redirect } from 'next/navigation';
import { canViewPersonAttendance } from '@/lib/permissions';
import { loadPreMemberRecord } from '@/lib/people-queries';
import { requireUser } from '@/lib/session';
import { PersonPage, queryOf, routeId } from '../../person-page';

/**
 * Attendance of one pre-member (pre_members.id). A promoted pre-member is
 * one person with their member row: their page is the member's.
 */
export default async function PreMemberAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp, user] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);
  const person = await loadPreMemberRecord(routeId(id));
  if (person && !canViewPersonAttendance(user, person)) redirect('/admin');
  if (person?.promotedMemberId)
    redirect(`/admin/people/m/${person.promotedMemberId}${queryOf(sp)}`);
  return <PersonPage person={person} searchParams={sp} />;
}
