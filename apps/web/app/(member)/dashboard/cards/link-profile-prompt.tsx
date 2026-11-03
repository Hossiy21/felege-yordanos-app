import Link from 'next/link';
import { ArrowRight, Link2, MailCheck, type LucideIcon } from 'lucide-react';
import { getLocale, getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';
import { RequestSuggestedLink } from './request-suggested-link';

const ACTION_BTN =
  'sacred-gradient inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-gold/40 px-3.5 py-2 text-xs font-semibold tracking-[0.04em] text-cream shadow-[0_6px_16px_-6px_rgba(10,60,54,0.4),inset_0_1px_0_rgba(212,168,67,0.25)] transition-opacity hover:opacity-95 disabled:opacity-60';

/**
 * Gold-accented card with an icon, a title, a short note and one button:
 * a link (`href` + `action`) or `button` in its place.
 */
async function PromptCard({
  className,
  icon: Icon,
  title,
  notes,
  href,
  action,
  button,
}: {
  className?: string;
  icon: LucideIcon;
  title: string;
  notes: React.ReactNode[];
  href: string;
  action: string;
  button?: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <section
      className={cn(
        'gold-accent-l flex items-center gap-3.5 rounded-2xl border border-parchment-edge bg-parchment-soft py-3.5 pl-5 pr-4 shadow-[0_1px_0_rgba(10,60,54,0.04),0_4px_14px_-8px_rgba(10,60,54,0.12)] dark:shadow-[0_4px_14px_-8px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/[0.16] dark:bg-gold/[0.14]">
        <Icon
          className="h-[18px] w-[18px] text-gold-deep"
          strokeWidth={1.75}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'leading-tight text-brand-ink',
            locale === 'am'
              ? 'font-ethiopic text-sm font-semibold'
              : 'font-display text-[17px] font-medium md:text-lg',
          )}
        >
          {title}
        </p>
        {notes.map((note, i) => (
          <p key={i} className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">
            {note}
          </p>
        ))}
      </div>
      {button ?? (
        <Link href={href} className={ACTION_BTN}>
          {action}
          <ArrowRight className="h-3 w-3 text-gold" />
        </Link>
      )}
    </section>
  );
}

/** Shown to users without a linked member record: links to /claim. */
export async function LinkProfilePrompt({
  className,
  pending = false,
  suggestedCode = null,
}: {
  className?: string;
  /** An open link request is waiting for an admin. */
  pending?: boolean;
  /** FYP ID of the pre-member record with this account's email (#139). */
  suggestedCode?: string | null;
}) {
  const t = await getT();
  if (suggestedCode && !pending) {
    return (
      <PromptCard
        className={className}
        icon={Link2}
        title={t('We found your ቅድመ አባል record')}
        notes={[
          <>
            {t('Pre-member ID')}:{' '}
            <span className="whitespace-nowrap font-mono text-ink">
              {suggestedCode}
            </span>
          </>,
          t('An admin confirms the link before it becomes active.'),
        ]}
        href="/claim"
        action={t('Link')}
        button={
          <RequestSuggestedLink code={suggestedCode} className={ACTION_BTN} />
        }
      />
    );
  }
  return (
    <PromptCard
      className={className}
      icon={Link2}
      title={pending ? t('Waiting for approval') : t('Link your member profile')}
      notes={[
        pending
          ? t('An admin will confirm your member link soon.')
          : t('Required for events and donations'),
      ]}
      href="/claim"
      action={pending ? t('View') : t('Link')}
    />
  );
}

/** Shown instead of the link prompt until the email is verified. */
export async function VerifyEmailPrompt({
  className,
  staff = false,
}: {
  className?: string;
  /** The profile has a staff role that starts after verification. */
  staff?: boolean;
}) {
  const t = await getT();
  return (
    <PromptCard
      className={className}
      icon={MailCheck}
      title={t('Verify your email')}
      notes={[
        t('Required for events, notices and donations'),
        ...(staff
          ? [t('Your staff access starts after you verify your email.')]
          : []),
      ]}
      href="/verify-email"
      action={t('Verify')}
    />
  );
}
