import Link from 'next/link';
import { Card, PageHead, SectionHeader } from '@/components/ds';
import { LogoMedallion } from '@/components/brand/logo-medallion';
import { LangToggle } from '@/components/lang-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { intlLocale } from '@/lib/i18n/config';
import { getLocale, getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';
import { LegalFooter } from './auth-ui';

/** Shown on /privacy and /terms. Change it whenever their text changes. */
export const LEGAL_EFFECTIVE_DATE = '2026-11-10';

/** A paragraph, or a bulleted list. English text; Amharic is in lib/i18n/dict/legal.ts. */
export type LegalBlock = string | string[];
export type LegalSection = { title: string; blocks: LegalBlock[] };

// Same look as linkClass in auth-ui (a client module, so its constants can't be imported here).
const linkClass =
  'font-semibold text-brand underline-offset-2 hover:underline dark:text-gold-light';

const LINK_OR_EMAIL = /\[([^\]]+)\]\(([^)]+)\)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** Turns `[label](url)` and email addresses in translated text into links. */
function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_OR_EMAIL)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const [, label, href, email] = m;
    if (email) {
      parts.push(
        <a key={i} href={`mailto:${email}`} className={linkClass}>
          {email}
        </a>,
      );
    } else if (href.startsWith('/')) {
      parts.push(
        <Link key={i} href={href} className={linkClass}>
          {label}
        </Link>,
      );
    } else {
      parts.push(
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {label}
        </a>,
      );
    }
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Public, readable page for the privacy policy and the terms (signed in or out). */
export async function LegalPage({
  title,
  sub,
  sections,
}: {
  title: string;
  sub: string;
  sections: LegalSection[];
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const effective = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${LEGAL_EFFECTIVE_DATE}T00:00:00Z`));
  const body = cn(
    'text-[14px] leading-relaxed text-ink md:text-[15px]',
    locale === 'am' && 'font-ethiopic',
  );

  return (
    <div className="parchment-bg flex min-h-screen flex-col">
      <header className="border-b border-parchment-edge">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link
            href="/"
            aria-label={t('Back to home')}
            className="flex min-w-0 items-center gap-2.5"
          >
            <LogoMedallion size={32} />
            <span className="truncate font-ethiopic text-[15px] font-semibold text-brand-ink">
              ፈለገ ዮርዳኖስ ሰንበት ት/ቤት
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-8 md:px-8 md:pt-12">
        <PageHead en={title} sub={sub} className="mb-2" />
        <p className="font-mono text-[11px] text-ink-muted">
          {t('Effective date: {date}', { date: effective })}
        </p>

        <Card className="mt-6 flex flex-col gap-8 md:p-8">
          {sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-3">
              <SectionHeader en={s.title} />
              {s.blocks.map((b, i) =>
                typeof b === 'string' ? (
                  <p key={i} className={body}>
                    <RichText text={t(b)} />
                  </p>
                ) : (
                  <ul key={i} className={cn(body, 'flex list-disc flex-col gap-2 pl-5 marker:text-gold-deep')}>
                    {b.map((item) => (
                      <li key={item}>
                        <RichText text={t(item)} />
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </Card>
      </main>

      <LegalFooter className="pb-8" />
    </div>
  );
}
