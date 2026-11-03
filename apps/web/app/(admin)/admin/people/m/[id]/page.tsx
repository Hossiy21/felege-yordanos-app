import { loadMemberRecord } from '@/lib/people-queries';
import { PersonPage, routeId } from '../../person-page';

/** Attendance of one member (members.id), incl. their pre-member history. */
export default async function MemberAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const person = await loadMemberRecord(routeId(id));
  return <PersonPage person={person} searchParams={sp} />;
}
