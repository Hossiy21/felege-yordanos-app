import { redirect } from 'next/navigation';
import { Card, PageHead } from '@/components/ds';
import { BackLink } from '@/components/events/event-ui';
import { getT } from '@/lib/i18n/server';
import { canManagePreMembers } from '@/lib/permissions';
import { requireUser } from '@/lib/session';
import { PreMemberForm } from '../pre-member-form';

/** Admin registration of a walk-in (email and phone optional). */
export default async function NewPreMemberPage() {
  const user = await requireUser();
  if (!canManagePreMembers(user)) redirect('/admin');
  const t = await getT();

  return (
    <div className="mx-auto max-w-2xl px-[22px] pb-6 pt-4 md:mx-0 md:max-w-3xl md:px-7 md:py-7">
      <div className="mb-2.5">
        <BackLink href="/admin/pre-members">{t('Pre-members')}</BackLink>
      </div>
      <PageHead
        en="Register a pre-member"
        am="ቅድመ አባል መመዝገብ"
        sub="For walk-ins at the desk. Email and phone are optional here."
      />
      <Card className="p-[22px] md:p-[26px]">
        <PreMemberForm mode="create" />
      </Card>
    </div>
  );
}
