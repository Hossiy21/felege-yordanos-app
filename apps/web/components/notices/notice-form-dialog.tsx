'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, ImageIcon, ImagePlus, RefreshCw, Trash2, X } from 'lucide-react';
import type { NoticeCategory } from '@felege-yordanos/db/schema';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { hasEthiopic } from '@/lib/category-color';
import { useLocale, useT } from '@/lib/i18n/client';
import { intlLocale } from '@/lib/i18n/config';
import { bilingual } from '@/lib/i18n/translate';
import {
  IMAGE_ACCEPT,
  imageFileType,
  mediaUrl,
  NOTICE_IMAGE_MAX_BYTES,
} from '@/lib/media';
import {
  expiryToDate,
  NOTICE_BODY_MAX,
  NOTICE_SUMMARY_MAX,
  NOTICE_TITLE_MAX,
  todayInEthiopia,
  type NoticeView,
} from '@/lib/notices';
import { cn } from '@/lib/utils';
import type { Audience } from '@/lib/audience';
import { AudienceField } from '@/components/forms/audience-field';
import { createNotice, updateNotice } from '@/app/(admin)/admin/notices/actions';
import { NOTICE_CATEGORY_META, NoticeCategoryChip, UnreadDot } from './notice-category';

const LABEL =
  'mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep';
const FIELD =
  'h-auto rounded-md border border-solid border-parchment-edge bg-parchment-soft px-4 py-3 text-[14px] text-ink shadow-[inset_0_1px_2px_rgba(10,60,54,0.04)] placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:ring-offset-0 dark:bg-parchment-deep';
const SMALL_BTN =
  'inline-flex items-center gap-1 rounded-full border border-parchment-edge bg-parchment-soft px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-parchment-deep';
/** Striped "photo" area, as in the design. */
const PHOTO_PLACEHOLDER =
  'bg-parchment-deep bg-[repeating-linear-gradient(135deg,rgb(var(--fy-gold)/0.10)_0_10px,transparent_10px_20px)]';

/** Radix Select needs a non-empty value; this one means "for everyone". */
const EVERYONE = 'everyone';

export interface PostableDepartment {
  id: number;
  nameEn: string;
  nameAm: string;
}

/** On/off switch row (photo, pin). */
function ToggleRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-lg border border-parchment-edge bg-parchment-soft px-4 py-3.5 text-left transition-colors hover:bg-parchment-deep/60 dark:bg-parchment-deep"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-brand-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-ink-muted">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-parchment-edge-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-[left]',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

/**
 * New / edit notice: form on the left, live preview on the right (phones:
 * full screen, preview below the form). Saves through the admin server
 * actions, which check the permission rules again.
 */
export function NoticeFormDialog({
  open,
  onOpenChange,
  notice,
  departments,
  canPostToEveryone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The notice to edit, or null for a new one. */
  notice: NoticeView | null;
  /** Departments this user may post to. */
  departments: PostableDepartment[];
  /** Admins may post for everyone. */
  canPostToEveryone: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-ink/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          // Above the overlay whatever order the two mount in.
          className="fixed inset-0 z-[51] flex flex-col bg-parchment shadow-fy-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(90dvh,880px)] md:w-[min(94vw,1080px)] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-xl md:border md:border-parchment-edge"
        >
          <NoticeForm
            // A fresh form for each notice.
            key={notice?.id ?? 'new'}
            notice={notice}
            departments={departments}
            canPostToEveryone={canPostToEveryone}
            onDone={() => onOpenChange(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function NoticeForm({
  notice,
  departments,
  canPostToEveryone,
  onDone,
}: {
  notice: NoticeView | null;
  departments: PostableDepartment[];
  canPostToEveryone: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();
  const locale = useLocale();
  const isEdit = !!notice;
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<NoticeCategory>(
    notice?.category ?? 'general',
  );
  const [title, setTitle] = useState(notice?.title ?? '');
  const [summary, setSummary] = useState(notice?.summary ?? '');
  const [body, setBody] = useState(notice?.body ?? '');
  const [dept, setDept] = useState(
    notice
      ? notice.departmentId === null
        ? EVERYONE
        : String(notice.departmentId)
      : canPostToEveryone
        ? EVERYONE
        : String(departments[0]?.id ?? ''),
  );
  const [withPhoto, setWithPhoto] = useState(!!notice?.imageKey);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [audience, setAudience] = useState<Audience>(
    notice?.audience ?? 'members',
  );
  const [expiresOn, setExpiresOn] = useState(
    notice?.expiresAt ? expiryToDate(notice.expiresAt) : '',
  );
  const [saving, setSaving] = useState(false);

  // Local preview of a newly chosen image.
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const shownImage = withPhoto
    ? (preview ??
      (notice?.imageKey && !removeImage ? mediaUrl(notice.imageKey) : null))
    : null;

  const deptName = (d: PostableDepartment) =>
    locale === 'en' ? d.nameEn : d.nameAm;
  const selectedDept = departments.find((d) => String(d.id) === dept);
  const fmt = new Intl.NumberFormat(intlLocale(locale));
  const today = new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'long',
    timeZone: 'Africa/Addis_Ababa',
  }).format(notice ? new Date(notice.createdAt) : new Date());
  const head = bilingual(locale, isEdit ? 'Edit notice' : 'New notice');
  const canSubmit = title.trim() !== '' && body.trim() !== '' && !saving;

  function showError(message: string) {
    toast({
      title: t('Error'),
      description: t(message),
      variant: 'destructive',
    });
  }

  function pickImage(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!imageFileType(file.name, file.type))
      return showError('Only JPG, PNG and WEBP images are allowed.');
    if (file.size > NOTICE_IMAGE_MAX_BYTES)
      return showError('Image is larger than 5 MB.');
    setImage(file);
    setRemoveImage(false);
  }

  function togglePhoto(on: boolean) {
    setWithPhoto(on);
    if (!on) {
      setImage(null);
      if (notice?.imageKey) setRemoveImage(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const formData = new FormData();
    formData.set('category', category);
    formData.set('title', title);
    formData.set('summary', summary);
    formData.set('body', body);
    formData.set('departmentId', dept === EVERYONE ? '' : dept);
    formData.set('audience', audience);
    if (pinned) formData.set('pinned', 'on');
    formData.set('expiresOn', expiresOn);
    if (withPhoto && image) formData.set('image', image);
    if (removeImage || (!withPhoto && notice?.imageKey))
      formData.set('removeImage', '1');

    const res = notice
      ? await updateNotice(notice.id, formData)
      : await createNotice(formData);
    setSaving(false);

    if (!res.ok) return showError(res.error);
    toast({ title: isEdit ? t('Notice updated') : t('Notice posted') });
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-parchment-edge px-[22px] pb-4 pt-5 md:px-8 md:pb-5 md:pt-7">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-xs tracking-[0.06em] text-gold-deep',
              locale === 'am' ? 'font-display' : 'font-ethiopic',
            )}
          >
            {head.secondary}
          </div>
          <DialogPrimitive.Title
            className={cn(
              'mt-0.5 leading-[1.05] text-brand-ink',
              locale === 'am'
                ? 'font-ethiopic text-[26px] font-semibold md:text-[30px]'
                : 'font-display text-[28px] font-medium md:text-[32px]',
            )}
          >
            {head.primary}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t('A one-line summary members see on the board.')}
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-parchment-edge bg-parchment-soft text-ink transition-colors hover:bg-parchment-deep"
          aria-label={t('Close')}
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>

      {/* Form + preview. Phones: one scroll. Desktop: two columns. */}
      <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:overflow-hidden">
        <div className="space-y-5 px-[22px] py-5 md:overflow-y-auto md:px-8 md:py-6">
          {/* Type */}
          <div>
            <div className={LABEL}>{t('Type')}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
              {(Object.keys(NOTICE_CATEGORY_META) as NoticeCategory[])
                .map((c) => {
                  const { icon: Icon, label } = NOTICE_CATEGORY_META[c];
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(c)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border px-3.5 py-3 text-left text-[13px] transition-colors',
                        locale === 'am' && 'font-ethiopic',
                        active
                          ? 'border-gold bg-gold/[0.14] font-semibold text-brand-ink'
                          : 'border-parchment-edge bg-parchment-soft text-ink hover:bg-parchment-deep dark:bg-parchment-deep',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          c === 'urgent' ? 'text-status-absent' : 'text-gold-deep',
                        )}
                      />
                      {t(label)}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="notice-title" className={LABEL}>
              {t('Title')}
            </label>
            <Input
              id="notice-title"
              required
              maxLength={NOTICE_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('e.g. Feast of the Apostles')}
              className={cn(FIELD, hasEthiopic(title) && 'font-ethiopic')}
            />
          </div>

          {/* Summary */}
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="notice-summary" className={LABEL}>
                {t('Summary')} · {t('optional')}
              </label>
              <span className="font-mono text-[11px] text-ink-muted">
                {fmt.format(summary.length)}/{fmt.format(NOTICE_SUMMARY_MAX)}
              </span>
            </div>
            <Textarea
              id="notice-summary"
              rows={2}
              value={summary}
              onChange={(e) =>
                setSummary(e.target.value.slice(0, NOTICE_SUMMARY_MAX))
              }
              placeholder={t('One or two sentences shown on the board')}
              className={cn(FIELD, 'min-h-[76px] resize-y')}
            />
          </div>

          {/* Full message */}
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="notice-body" className={LABEL}>
                {t('Full message')}
              </label>
              <span className="font-mono text-[11px] text-ink-muted">
                {fmt.format(body.length)}/{fmt.format(NOTICE_BODY_MAX)}
              </span>
            </div>
            <Textarea
              id="notice-body"
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, NOTICE_BODY_MAX))}
              placeholder={t(
                'Details members see when they open the notice. Leave a blank line between paragraphs.',
              )}
              className={cn(FIELD, 'min-h-[150px] resize-y leading-[1.7]')}
            />
          </div>

          {/* Who sees it: members, pre-members or both */}
          <AudienceField value={audience} onChange={setAudience} />

          {/* For (department) + end date */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="notice-department" className={LABEL}>
                {t('For')}
              </label>
              <Select value={dept} onValueChange={setDept} required>
                <SelectTrigger
                  id="notice-department"
                  disabled={!canPostToEveryone && departments.length <= 1}
                  className={cn(
                    FIELD,
                    'focus:ring-2 focus:ring-gold/30 focus:ring-offset-0',
                    locale === 'am' && 'font-ethiopic',
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60] border-parchment-edge bg-parchment-soft">
                  {canPostToEveryone && (
                    <SelectItem value={EVERYONE}>{t('Everyone')}</SelectItem>
                  )}
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      <span className={cn(locale === 'am' && 'font-ethiopic')}>
                        {deptName(d)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="notice-until" className={LABEL}>
                {t('Show until')} · {t('optional')}
              </label>
              <Input
                id="notice-until"
                type="date"
                // An expired notice keeps its old date when edited.
                min={
                  expiresOn && expiresOn < todayInEthiopia()
                    ? expiresOn
                    : todayInEthiopia()
                }
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                className={cn(FIELD, 'font-mono text-[13px]')}
              />
            </div>
          </div>

          {/* Photo */}
          <div className="space-y-2.5">
            <ToggleRow
              checked={withPhoto}
              onChange={togglePhoto}
              title={t('Include a photo')}
              hint={t('JPG, PNG or WEBP · max 5 MB')}
            />
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            {withPhoto &&
              (shownImage ? (
                <div className="overflow-hidden rounded-lg border border-parchment-edge">
                  <img
                    src={shownImage}
                    alt=""
                    className="aspect-[16/7] w-full bg-parchment-deep object-cover"
                  />
                  <div className="flex items-center gap-1.5 border-t border-parchment-edge bg-parchment-soft px-3 py-2 dark:bg-parchment-deep">
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-muted">
                      {image?.name ?? t('Current image')}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className={cn(SMALL_BTN, 'text-brand dark:text-gold')}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t('Replace')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImage(null);
                        if (notice?.imageKey) setRemoveImage(true);
                      }}
                      className={cn(SMALL_BTN, 'text-status-absent')}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('Remove')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-md border border-dashed border-gold/50 bg-parchment-soft px-4 py-3.5 text-left transition-colors hover:bg-parchment-deep dark:bg-parchment-deep"
                >
                  <ImagePlus className="h-5 w-5 shrink-0 text-gold-deep" />
                  <span className="text-[13px] font-semibold text-brand-ink">
                    {t('Add an image')}
                  </span>
                </button>
              ))}
          </div>

          {/* Pin */}
          <ToggleRow
            checked={pinned}
            onChange={setPinned}
            title={t('Pin as featured')}
            hint={t('Pinned notices stay above the others; the newest is featured.')}
          />
        </div>

        {/* Preview */}
        <div className="border-t border-parchment-edge bg-parchment-deep/40 px-[22px] py-5 md:overflow-y-auto md:border-l md:border-t-0 md:px-7 md:py-6">
          <div className={LABEL}>{t('Preview')}</div>
          <div className="rounded-lg border border-parchment-edge bg-parchment-soft p-5 shadow-[0_4px_14px_-8px_rgba(10,60,54,0.12)] dark:bg-parchment-deep">
            {withPhoto && (
              <div
                className={cn(
                  'mb-4 flex aspect-[16/8] items-center justify-center overflow-hidden rounded-md',
                  !shownImage && PHOTO_PLACEHOLDER,
                )}
              >
                {shownImage ? (
                  <img src={shownImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-gold-deep">
                    <ImageIcon className="h-6 w-6" />
                    <span className="font-ethiopic text-[11px]">{t('photo')}</span>
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <NoticeCategoryChip category={category} />
              <span className="ml-auto flex items-center gap-1.5">
                <UnreadDot />
                <span className="font-mono text-[11.5px] text-ink-muted">
                  {today}
                </span>
              </span>
            </div>
            <div
              className={cn(
                'mt-3 break-words leading-tight',
                title ? 'text-brand-ink' : 'text-ink-faint',
                hasEthiopic(title) || (!title && locale === 'am')
                  ? 'font-ethiopic text-[22px] font-semibold'
                  : 'font-display text-[24px] font-medium',
              )}
            >
              {title || t('Notice title')}
            </div>
            <p className="mt-2.5 line-clamp-3 whitespace-pre-line break-words text-[13px] leading-relaxed text-ink">
              {summary ||
                body ||
                t('A one-line summary members see on the board.')}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-parchment-edge pt-3.5 text-[12px]">
              <span className={cn('text-ink-muted', locale === 'am' && 'font-ethiopic')}>
                {dept === EVERYONE
                  ? t('Everyone')
                  : selectedDept
                    ? deptName(selectedDept)
                    : ''}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-brand dark:text-gold">
                {t('Read full notice')}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <p className="mt-3.5 text-[12px] text-ink-muted">
            {pinned
              ? t('Will appear as the featured notice at the top of the board.')
              : t('Will appear at the top of the Latest list.')}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="grid grid-cols-[1fr_2fr] gap-3 border-t border-parchment-edge bg-parchment px-[22px] py-3.5 md:px-8 md:py-5">
        <DialogPrimitive.Close
          type="button"
          className="rounded-md border border-parchment-edge bg-parchment-soft px-4 py-3.5 text-[14px] font-semibold text-brand transition-colors hover:bg-parchment-deep dark:bg-parchment-deep dark:text-gold"
        >
          {t('Cancel')}
        </DialogPrimitive.Close>
        <button
          type="submit"
          disabled={!canSubmit}
          className="sacred-gradient rounded-md border border-gold/40 px-5 py-3.5 text-[14px] font-semibold tracking-[0.04em] text-cream shadow-[0_6px_16px_-6px_rgba(10,60,54,0.4),inset_0_1px_0_rgba(212,168,67,0.25)] transition-opacity hover:opacity-95 disabled:opacity-45"
        >
          {saving
            ? t('Saving…')
            : isEdit
              ? t('Save changes')
              : t('Publish notice')}
        </button>
      </div>
    </form>
  );
}
