import { adminHrefsFor } from '@/lib/nav';
import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/session';

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { displayName, email, role } = user;
  return (
    <AppShell
      role={role}
      displayName={displayName}
      email={email}
      adminHrefs={adminHrefsFor(user)}
      preMember={user.access === 'pre_member'}
    >
      {children}
    </AppShell>
  );
}
