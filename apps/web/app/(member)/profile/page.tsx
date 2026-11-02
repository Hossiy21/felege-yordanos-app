import { eq } from 'drizzle-orm';
import {
  db,
  departments,
  members,
  preMembers,
  profiles,
} from '@felege-yordanos/db/server';
import { PageHead } from '@/components/ds';
import { requireUser } from '@/lib/session';
import { PreMemberDetailsForm } from './pre-member-details-form';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const user = await requireUser();

  const [[profile], [member]] = await Promise.all([
    db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1),
    // The member record linked to this account through /claim.
    db
      .select({
        memberId: members.memberId,
        name: members.name,
        fatherName: members.fatherName,
        grandfatherName: members.grandfatherName,
        gender: members.gender,
        addressPhone: members.addressPhone,
      })
      .from(members)
      .where(eq(members.authUserId, user.id))
      .limit(1),
  ]);

  // An active pre-member: their record (ID, QR and editable details).
  const [pre] =
    !member && user.access === 'pre_member' && user.preMemberRecordId !== null
      ? await db
          .select()
          .from(preMembers)
          .where(eq(preMembers.id, user.preMemberRecordId))
          .limit(1)
      : [];

  let deptName: string | null = null;
  if (user.departmentId != null) {
    const [dept] = await db
      .select({ nameAm: departments.nameAm })
      .from(departments)
      .where(eq(departments.id, user.departmentId))
      .limit(1);
    deptName = dept?.nameAm ?? null;
  }

  return (
    <div className="mx-auto max-w-md px-[22px] pb-6 pt-4 md:mx-0 md:max-w-none md:px-7 md:py-7">
      <PageHead en="My profile" am="መገለጫ" className="mb-3.5 md:mb-4" />

      <ProfileForm
        email={user.email}
        displayName={profile?.displayName ?? ''}
        role={user.role}
        member={
          member ??
          (pre?.code
            ? {
                memberId: pre.code,
                name: pre.name,
                fatherName: pre.fatherName,
                grandfatherName: pre.grandfatherName,
                gender: null,
                addressPhone: pre.phone,
              }
            : null)
        }
        preMember={!member && !!pre}
        deptName={deptName}
      />
      {pre && (
        <PreMemberDetailsForm
          initial={{
            name: pre.name,
            fatherName: pre.fatherName,
            grandfatherName: pre.grandfatherName,
            // Walk-ins registered without an email: suggest the account's.
            email: pre.email ?? user.email,
            phone: pre.phone ?? '',
          }}
        />
      )}
    </div>
  );
}
