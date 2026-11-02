'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { members, Role } from '@felege-yordanos/db/schema';
import { KeyRound, Link2, LogOut, Pencil, Printer } from 'lucide-react';
import { Card, Eyebrow, SectionHeader } from '@/components/ds';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MemberQR } from '@/components/member-qr';
import { authClient } from '@/lib/auth-client';
import { useLocale, useT } from '@/lib/i18n/client';
import type { Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';
import { initialsOf, RolePill } from '@/components/role-pill';
import { MemberQRCard } from './member-qr-card';
import { PreMemberBadge } from '@/components/pre-members/pre-member-badge';
import { updateDisplayName } from './actions';

type Member = typeof members.$inferSelect;

/** The fields of the linked member record this screen shows. */
export type LinkedMember = Pick<
  Member,
  | 'memberId'
  | 'name'
  | 'fatherName'
  | 'grandfatherName'
  | 'gender'
  | 'addressPhone'
>;

interface ProfileFormProps {
  email: string;
  displayName: string;
  role: Role;
  member: LinkedMember | null;
  /** Department display name (Amharic) for the desktop info card. */
  deptName?: string | null;
  /** `member` is the linked pre-member record (FYP code): plum QR card. */
  preMember?: boolean;
}

const LABEL =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep';
const FIELD =
  'rounded-[10px] border border-solid border-parchment-edge bg-parchment-soft px-3.5 py-[11px] text-[13px] text-ink shadow-[inset_0_1px_2px_rgba(10,60,54,0.04)] dark:bg-parchment-deep dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]';
const INPUT = cn(
  FIELD,
  'h-auto leading-normal md:text-[13px] placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30',
);
const SECONDARY =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-parchment-edge bg-parchment-soft px-3.5 py-[9px] text-[12.5px] font-semibold text-brand transition-colors hover:bg-parchment-deep disabled:pointer-events-none disabled:opacity-50 dark:text-gold-light';
const AVATAR =
  'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-deep font-display font-bold text-brand-deep';

/** Gender is stored in Amharic (ወንድ / ሴት). */
function genderLabel(gender: string | null, locale: Locale): string | null {
  if (!gender) return null;
  if (locale === 'am') return gender;
  return gender === 'ወንድ' ? 'Male' : gender === 'ሴት' ? 'Female' : gender;
}

export function ProfileForm({
  email,
  displayName,
  role,
  member,
  deptName,
  preMember = false,
}: ProfileFormProps) {
  const qrVariant = preMember ? 'pre_member' : 'member';
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  const initials = initialsOf(displayName, member?.name, email);
  const fullName = displayName || member?.name || email;
  const dirty = name !== displayName;
  const memberLine = member
    ? [
        [member.name, member.fatherName, member.grandfatherName]
          .filter(Boolean)
          .join(' '),
        genderLabel(member.gender, locale),
        member.addressPhone,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  async function handleSave() {
    setSaving(true);
    const res = await updateDisplayName(name);
    setSaving(false);
    if (!res.ok) {
      toast({
        title: t('Error'),
        description: t(res.error),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('Saved'),
        description: t('Your profile has been updated.'),
      });
      router.refresh();
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  const claimPrompt = (
    <Card className="gold-accent-l flex items-center gap-3 px-4 py-3.5 pl-5">
      <div className="rounded-full bg-brand/10 p-2.5 dark:bg-gold/[0.12]">
        <Link2 className="h-4 w-4 text-brand dark:text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">
          {t('Link your member profile')}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-muted">
          {t('Required to get your check-in QR code')}
        </p>
      </div>
      <Link
        href="/claim"
        className="sacred-gradient shrink-0 rounded-[10px] border border-gold/40 px-3.5 py-2 text-xs font-semibold text-cream shadow-fy-md hover:opacity-95"
      >
        {t('Link')}
      </Link>
    </Card>
  );

  return (
    <>
      {/* ─── PHONE (< md) ─── */}
      <div className="space-y-[18px] md:hidden">
        {/* Avatar + name */}
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              AVATAR,
              'h-[60px] w-[60px] text-[22px] shadow-[0_4px_12px_-4px_rgba(212,168,67,0.45)]',
            )}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[19px] font-medium leading-[1.1] text-brand-ink">
              {fullName}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">
              {email}
            </div>
            {preMember ? (
              <PreMemberBadge className="mt-1.5" />
            ) : (
              <RolePill
                role={role}
                t={t}
                variant="list"
                className="mt-1.5 px-2 py-0.5 text-[9px] tracking-[0.06em]"
              />
            )}
          </div>
        </div>

        {member ? (
          <MemberQRCard memberId={member.memberId} variant={qrVariant} />
        ) : (
          claimPrompt
        )}

        {/* Account */}
        <section>
          <Eyebrow className="mb-2">{t('Account')}</Eyebrow>
          <Card className="rounded-xl px-4 py-3.5 shadow-none dark:shadow-none">
            <label
              htmlFor="display-name"
              className={cn(LABEL, 'mb-1 text-[9.5px]')}
            >
              {t('Display name')}
            </label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Enter your name')}
              className={cn(INPUT, 'py-[9px] text-[13.5px]')}
            />

            {member && (
              <div className="mt-3 border-t border-parchment-edge pt-3">
                <div className={cn(LABEL, 'mb-1 text-[9.5px]')}>
                  {t(preMember ? 'Pre-member record' : 'Member record')} ·{' '}
                  {t('linked')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-brand/[0.08] px-2 py-0.5 font-mono text-[11px] font-semibold text-brand dark:bg-gold/10 dark:text-gold-light">
                    {member.memberId}
                  </span>
                  <Link2
                    className="h-3 w-3 text-status-present"
                    aria-label={t('linked')}
                  />
                </div>
                {memberLine && (
                  <p className="mt-1.5 text-[11.5px] text-ink-muted">
                    {memberLine}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="sacred-gradient mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 py-2.5 text-[13px] font-semibold text-cream shadow-fy-md transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {saving ? t('Saving…') : t('Save changes')}
            </button>
          </Card>
        </section>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-parchment-edge bg-transparent py-[11px] text-[13px] font-medium text-status-absent transition-colors hover:bg-status-absent/[0.06] disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          {signingOut ? t('Signing out…') : t('Sign out')}
        </button>
      </div>

      {/* ─── DESKTOP (md+) ─── */}
      <div className="hidden grid-cols-[1fr_380px] items-start gap-4 md:grid">
        {/* Info card */}
        <Card className="p-[26px]">
          <div className="mb-5 flex items-center gap-4">
            <div
              className={cn(
                AVATAR,
                'h-[58px] w-[58px] text-[22px] shadow-[0_6px_16px_-8px_rgba(164,122,24,0.6)]',
              )}
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl font-medium leading-[1.1] text-brand-ink">
                {fullName}
              </h2>
              <div className="mt-[5px] flex flex-wrap items-center gap-2">
                {member && (
                  <span className="rounded-full border border-gold/30 bg-gold/[0.14] px-2 py-0.5 font-mono text-[10.5px] text-gold-deep">
                    {member.memberId}
                  </span>
                )}
                {deptName ? (
                  <span className="font-ethiopic text-[11px] text-ink-muted">
                    {deptName}
                  </span>
                ) : preMember ? (
                  <PreMemberBadge />
                ) : (
                  <RolePill role={role} t={t} />
                )}
              </div>
            </div>
          </div>

          {/* Ornament rule */}
          <div className="flex items-center gap-2.5" aria-hidden>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-parchment-edge" />
            <span className="flex items-center gap-1">
              <span className="h-[3px] w-[3px] rounded-full bg-gold opacity-40" />
              <span className="h-[3px] w-[3px] rounded-full bg-gold" />
              <span className="h-[3px] w-[3px] rounded-full bg-gold opacity-40" />
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-parchment-edge" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="desk-display-name" className={LABEL}>
                {t('Full name')}
              </label>
              <Input
                id="desk-display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Enter your name')}
                className={INPUT}
              />
            </div>
            <ReadOnlyField
              label={t('Phone')}
              value={member?.addressPhone}
              mono
            />
            <ReadOnlyField label={t('Department')} value={deptName} />
            <ReadOnlyField label={t('Email')} value={email} />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className={SECONDARY}
            >
              <Pencil className="h-[13px] w-[13px]" />
              {saving ? t('Saving…') : t('Save changes')}
            </button>
            <Link href="/forgot-password" className={SECONDARY}>
              <KeyRound className="h-[13px] w-[13px]" />
              {t('Change password')}
            </Link>
          </div>
        </Card>

        {/* Check-in code */}
        <Card className="p-[26px] text-center">
          <SectionHeader
            en="Check-in code"
            am="የመግቢያ ኮድ"
            as="h2"
            className="[&>div]:mb-0.5"
          />
          {member ? (
            <>
              <div className="mx-auto mt-4 w-fit rounded-[14px] border border-parchment-edge bg-parchment-soft p-3 shadow-[0_8px_20px_-12px_rgba(10,60,54,0.35)] dark:bg-cream">
                <MemberQR
                  value={member.memberId}
                  size={168}
                  variant={qrVariant}
                />
              </div>
              <div className="mt-3 font-mono text-[13px] tracking-[0.08em] text-ink">
                {member.memberId}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-normal text-ink-muted">
                {t('Show this code at the door to check in.')}
              </p>
              <div className="mt-3.5 flex justify-center">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={SECONDARY}
                >
                  <Printer className="h-[13px] w-[13px]" />
                  {t('Print card')}
                </button>
              </div>
            </>
          ) : (
            <div className="mt-5 flex flex-col items-center">
              <div className="rounded-full border border-gold/30 bg-gold/10 p-3 text-gold-deep">
                <Link2 className="h-5 w-5" />
              </div>
              <p className="mt-3 text-[12.5px] leading-normal text-ink-muted">
                {t('Link your member profile to get a check-in QR code.')}
              </p>
              <Link href="/claim" className={cn(SECONDARY, 'mt-3.5')}>
                <Link2 className="h-[13px] w-[13px]" />
                {t('Link your member profile')}
              </Link>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function ReadOnlyField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <div
        className={cn(
          FIELD,
          'truncate',
          mono && 'font-mono',
          !value && 'text-ink-faint',
        )}
      >
        {value || '—'}
      </div>
    </div>
  );
}
