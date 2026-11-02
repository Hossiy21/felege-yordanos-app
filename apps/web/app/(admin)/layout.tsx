import { adminHrefsFor } from '@/lib/nav';
import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Members are sent back to the dashboard. Each admin page still checks
  // the exact roles and departments it allows.
  const user = await requireRole(['dept_head', 'admin', 'super_admin']);
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
