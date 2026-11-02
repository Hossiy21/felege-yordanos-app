'use client';

import { useState } from 'react';
import { CalendarClock, Pin } from 'lucide-react';
import { Card, StatusPill } from '@/components/ds';
import { useLocale, useT } from '@/lib/i18n/client';
import { intlLocale } from '@/lib/i18n/config';
import { hasEthiopic } from '@/lib/category-color';
import { mediaUrl } from '@/lib/media';
import type { NoticeView } from '@/lib/notices';
import { NoticeCategoryChip } from './notice-category';
import { cn } from '@/lib/utils';
import { AudienceTag } from '@/components/forms/audience-tag';

/** Long messages start collapsed, with "Read full notice". */
const isLong = (body: string) =>
  body.length > 360 || body.split('\n').length > 6;

/** Department label of a notice: its department, or "Everyone". */
export function useNoticeDepartment() {
  const t = useT();
  const locale = useLocale();
  return (n: Pick<NoticeView, 'departmentNameEn' | 'departmentNameAm'>) =>
    n.departmentNameEn
      ? locale === 'en'
        ? n.departmentNameEn
        : (n.departmentNameAm ?? n.departmentNameEn)
      : t('Everyone');
}

/**
 * One notice on the board. `featured` = the pinned notice at the top
 * (larger title and image). `actions` = edit/delete buttons (admin list).
 */
export function NoticeCard({
  notice,
  featured,
  actions,
  className,
}: {
  notice: NoticeView;
  featured?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const department = useNoticeDepartment();
  const [open, setOpen] = useState(false);
  const long = isLong(notice.body);

  const date = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Addis_Ababa',
    }).format(new Date(iso));

  return (
    <Card
      className={cn(
        'relative overflow-hidden p-0',
        featured && 'border-gold/40',
        notice.expired && 'opacity-75',
        className,
      )}
    >
      {featured && (
        <div
          className="tibeb-gold pointer-events-none absolute inset-x-0 top-0 h-1.5 opacity-70"
          aria-hidden
        />
      )}
      {notice.imageKey && (
        <img
          src={mediaUrl(notice.imageKey)}
          alt=""
          loading="lazy"
          className={cn(
            'w-full border-b border-parchment-edge bg-parchment-deep object-cover',
            featured ? 'aspect-[16/8] md:aspect-[21/8]' : 'aspect-[16/7]',
          )}
        />
      )}
      <div className={cn('p-4', featured && 'md:p-5')}>
        <div className="flex flex-wrap items-center gap-1.5">
          <NoticeCategoryChip category={notice.category} />
          {notice.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/[0.16] px-2 py-[3px] text-[10.5px] font-semibold text-gold-deep">
              <Pin className="h-[10px] w-[10px]" />
              {featured ? t('Pinned notice') : t('Pinned')}
            </span>
          )}
          {/* "Everyone" (no department) next to an audience tag would contradict it. */}
          {(notice.departmentId !== null || notice.audience === 'members') && (
            <span
              className={cn(
                'inline-flex items-center rounded-full bg-brand/[0.08] px-2 py-[3px] text-[10.5px] font-medium text-brand dark:bg-gold/[0.12] dark:text-gold-light',
                locale === 'am' && 'font-ethiopic',
              )}
            >
              {department(notice)}
            </span>
          )}
          <AudienceTag audience={notice.audience} />
          {notice.expired && <StatusPill tone="neutral">{t('Expired')}</StatusPill>}
          <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
            {date(notice.createdAt)}
          </span>
        </div>

        <h3
          className={cn(
            'mt-2.5 leading-tight text-brand-ink',
            hasEthiopic(notice.title)
              ? 'font-ethiopic font-semibold'
              : 'font-display font-medium',
            featured
              ? 'text-[21px] md:text-[24px]'
              : hasEthiopic(notice.title)
                ? 'text-[16px]'
                : 'text-[19px]',
          )}
        >
          {notice.title}
        </h3>

        {notice.summary && (
          <p
            className={cn(
              'mt-1.5 whitespace-pre-line break-words text-[13px] font-semibold leading-relaxed text-ink',
              hasEthiopic(notice.summary) && 'font-ethiopic',
            )}
          >
            {notice.summary}
          </p>
        )}
        <p
          className={cn(
            'mt-1.5 whitespace-pre-line break-words text-[13px] leading-relaxed text-ink',
            hasEthiopic(notice.body) && 'font-ethiopic',
            long && !open && 'line-clamp-5',
          )}
        >
          {notice.body}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1.5 text-[11.5px] font-semibold text-gold-deep hover:underline"
          >
            {open ? t('Show less') : t('Read full notice')}
          </button>
        )}

        {(notice.authorName || notice.expiresAt || actions) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-parchment-edge pt-2.5 text-[11px] text-ink-muted">
            {notice.authorName && (
              <span>
                {t('Posted by')}{' '}
                <span className="font-medium text-ink">{notice.authorName}</span>
              </span>
            )}
            {notice.expiresAt && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {t('Until')} {date(notice.expiresAt)}
              </span>
            )}
            {actions && (
              <span className="ml-auto flex items-center gap-1.5">{actions}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
