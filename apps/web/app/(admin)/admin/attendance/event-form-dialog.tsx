'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { departments, events } from '@felege-yordanos/db/schema';
import { Info, Repeat, Trash2, TriangleAlert, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLocale, useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import {
  type Recurrence,
  cadencePhrase,
  deptColor,
  generateOccurrences,
  maxRecurrenceUntil,
  formatYmd,
  parseYmd,
  toYmd,
  todayYmd,
} from '@/lib/events';
import {
  createEvent,
  deleteEvent,
  updateEvent,
  updateSeriesEnd,
} from './actions';
import { primaryBtn } from '@/components/events/event-ui';
import { AudienceField } from '@/components/forms/audience-field';
import type { Audience } from '@/lib/audience';
import { CHECK_IN_DEFAULT_MIN, CHECK_IN_MAX_MIN } from '@/lib/check-in-window';

type EventRow = typeof events.$inferSelect;
type Department = typeof departments.$inferSelect;

type RepeatChoice = 'none' | Recurrence;

const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** Amharic for each repeat option (shown as the small second line in English). */
const REPEAT_AM: Record<RepeatChoice, string> = {
  none: 'የለም',
  weekly: 'ሳምንታዊ',
  biweekly: 'በየሁለት ሳምንቱ',
  monthly: 'ወርሃዊ',
};

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  event: EventRow | null;
  defaultDate?: string | null;
  departments: Department[];
  userDeptId: number | null;
  /** Department heads who may only create events for their own department. */
  lockDepartment: boolean;
  /** All occurrences sharing the edited event's recurrence_group. */
  seriesEvents: EventRow[];
  /** Event ids that already have attendance — never delete/regenerate these. */
  attendedIds: Set<string>;
}

const labelCls =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep';

/** Recessed parchment field. */
const fieldCls =
  'h-auto rounded-[10px] border border-parchment-edge bg-parchment-soft px-[13px] py-2.5 text-[13px] text-ink shadow-[inset_0_1px_2px_rgba(10,60,54,0.04)] placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30 dark:bg-parchment-deep dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]';
const monoCls = `${fieldCls} font-mono`;

/** Add whole months, clamping the day. Used for the default Until. */
function addMonths(ymd: string, months: number): string {
  const d = parseYmd(ymd);
  const first = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toYmd(
    new Date(
      first.getFullYear(),
      first.getMonth(),
      Math.min(d.getDate(), days),
    ),
  );
}

export function EventFormDialog({
  open,
  onOpenChange,
  mode,
  event,
  defaultDate,
  departments,
  userDeptId,
  lockDepartment,
  seriesEvents,
  attendedIds,
}: EventFormDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const fmtLong = (ymd: string) =>
    formatYmd(ymd, locale, { month: 'short', day: 'numeric', year: 'numeric' });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [opensBefore, setOpensBefore] = useState(String(CHECK_IN_DEFAULT_MIN));
  const [closesAfter, setClosesAfter] = useState(String(CHECK_IN_DEFAULT_MIN));
  const [deptId, setDeptId] = useState('');
  const [audience, setAudience] = useState<Audience>('members');
  const [repeat, setRepeat] = useState<RepeatChoice>('none');
  const [until, setUntil] = useState('');
  const [seriesUntil, setSeriesUntil] = useState('');
  const [busy, setBusy] = useState(false);

  const inSeries = mode === 'edit' && !!event?.recurrenceGroup;

  // Reset the form whenever the dialog opens for a new target.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && event) {
      setTitle(event.title);
      setDescription(event.description ?? '');
      setEventDate(event.eventDate);
      setStartTime(event.startTime?.slice(0, 5) ?? '');
      setEndTime(event.endTime?.slice(0, 5) ?? '');
      setOpensBefore(String(event.checkInOpensBeforeMin));
      setClosesAfter(String(event.checkInClosesAfterMin));
      setDeptId(event.departmentId ? String(event.departmentId) : '');
      setAudience(event.audience);
      setRepeat('none');
      setUntil('');
      setSeriesUntil(event.recurrenceUntil ?? '');
    } else {
      setTitle('');
      setDescription('');
      setEventDate(defaultDate ?? '');
      setStartTime('');
      setEndTime('');
      setOpensBefore(String(CHECK_IN_DEFAULT_MIN));
      setClosesAfter(String(CHECK_IN_DEFAULT_MIN));
      setDeptId(userDeptId ? String(userDeptId) : '');
      setAudience('members');
      setRepeat('none');
      setUntil('');
      setSeriesUntil('');
    }
  }, [open, mode, event, defaultDate, userDeptId]);

  function getDeptName(id: number | null): string {
    if (!id) return t('General');
    const d = departments.find((x) => x.id === id);
    if (!d) return t('Unknown');
    return locale === 'am' ? d.nameAm : d.nameEn;
  }

  // ── Create: live recurrence preview ─────────────────────────────────────────
  const maxUntil = eventDate ? maxRecurrenceUntil(eventDate) : '';
  const cappedUntil = until && maxUntil && until > maxUntil ? maxUntil : until;
  const isCapped = !!until && !!maxUntil && until > maxUntil;
  const recurring = repeat !== 'none';
  const occurrences =
    recurring && eventDate && cappedUntil
      ? generateOccurrences(eventDate, repeat as Recurrence, cappedUntil)
      : [];
  const occCount = occurrences.length;

  function onRepeatChange(next: RepeatChoice) {
    setRepeat(next);
    if (next !== 'none' && eventDate && !until) {
      // Sensible default: 3 months out, clamped to the 12-month cap.
      const def = addMonths(eventDate, 3);
      setUntil(
        def > maxRecurrenceUntil(eventDate)
          ? maxRecurrenceUntil(eventDate)
          : def,
      );
    }
  }

  // Empty fields fall back to the default; the server validates the range.
  const checkInMinutes = () => ({
    checkInOpensBeforeMin:
      opensBefore === '' ? CHECK_IN_DEFAULT_MIN : Number(opensBefore),
    checkInClosesAfterMin:
      closesAfter === '' ? CHECK_IN_DEFAULT_MIN : Number(closesAfter),
  });

  // ── Submit (create) ─────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createEvent({
      title,
      description: description || null,
      eventDate,
      startTime: startTime || null,
      endTime: endTime || null,
      departmentId: deptId ? Number(deptId) : null,
      audience,
      ...checkInMinutes(),
      recurrence: recurring ? (repeat as Recurrence) : null,
      until: recurring ? cappedUntil || null : null,
    });

    setBusy(false);
    if (!res.ok) {
      toast({
        title: t('Error'),
        description: t(res.error),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: recurring
        ? t('{n} events created', { n: res.data.count })
        : t('Event created'),
      description: title,
    });
    onOpenChange(false);
    router.refresh();
  }

  // ── Submit (edit one occurrence) ────────────────────────────────────────────
  async function handleUpdate() {
    if (!event) return;
    setBusy(true);
    const res = await updateEvent(event.id, {
      title,
      description: description || null,
      eventDate,
      startTime: startTime || null,
      endTime: endTime || null,
      departmentId: deptId ? Number(deptId) : null,
      audience,
      ...checkInMinutes(),
    });
    setBusy(false);
    if (!res.ok) {
      toast({
        title: t('Error'),
        description: t(res.error),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('Event updated'), description: title });
    onOpenChange(false);
    router.refresh();
  }

  // ── Series: extend / shorten the end date ───────────────────────────────────
  async function handleSeriesEnd() {
    if (!event?.recurrenceGroup || !event.recurrence) return;
    const newUntil = seriesUntil;
    if (!newUntil) return;

    setBusy(true);
    const res = await updateSeriesEnd({ eventId: event.id, until: newUntil });
    setBusy(false);
    if (!res.ok) {
      toast({
        title: t('Error'),
        description: t(res.error),
        variant: 'destructive',
      });
      return;
    }

    const { added, removed, kept } = res.data;
    if (added === 0 && removed === 0) {
      toast({
        title: t('No change'),
        description: t('Series already ends there.'),
      });
      return;
    }

    toast({
      title: t('Series updated'),
      description: [
        added ? t('+{n} added.', { n: added }) : '',
        removed ? t('{n} removed.', { n: removed }) : '',
        kept ? t('{n} kept (has attendance).', { n: kept }) : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
    onOpenChange(false);
    router.refresh();
  }

  // ── Delete a single occurrence (attendance-guarded) ─────────────────────────
  async function handleDelete() {
    if (!event) return;
    if (attendedIds.has(event.id)) {
      toast({
        title: t('Cannot delete'),
        description: t('This event already has attendance recorded.'),
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    const res = await deleteEvent(event.id);
    setBusy(false);
    if (!res.ok) {
      toast({
        title: t('Error'),
        description: t(res.error),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('Event deleted'), description: event.title });
    onOpenChange(false);
    router.refresh();
  }

  /** Renders a translated sentence with `{count}` set in bold. */
  function withBoldCount(
    template: string,
    count: string,
    vars: Record<string, string>,
  ) {
    const [before, after = ''] = t(template, vars).split('{count}');
    return (
      <>
        {before}
        <strong className="font-mono font-semibold text-brand dark:text-gold">
          {count}
        </strong>
        {after}
      </>
    );
  }

  const hasAttendance = attendedIds.has(event?.id ?? '');
  const otherLang = (en: string, am: string) => (locale === 'am' ? en : am);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-[20px] border-parchment-edge bg-parchment bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,168,67,0.10)_0%,transparent_55%)] p-0 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.6)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,168,67,0.06)_0%,transparent_55%)] sm:max-w-[560px] sm:rounded-[20px] [&>button:last-child]:hidden max-sm:!bottom-0 max-sm:!left-0 max-sm:!right-0 max-sm:!top-auto max-sm:!w-full max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-b-none max-sm:!rounded-t-3xl">
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-ink-faint/30 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-parchment-edge px-6 pb-4 pt-3 sm:pt-5">
          <div>
            <div
              className={cn(
                'text-[11px] tracking-[0.06em] text-gold-deep',
                locale === 'am' ? 'font-display text-xs' : 'font-ethiopic',
              )}
            >
              {mode === 'create'
                ? otherLang('New event', 'አዲስ ስብሰባ')
                : otherLang('Edit event', 'ስብሰባ አርትዕ')}
            </div>
            <DialogTitle
              className={cn(
                'mt-0.5 leading-[1.05] text-brand-ink',
                locale === 'am'
                  ? 'font-ethiopic text-[22px] font-semibold'
                  : 'font-display text-2xl font-medium',
              )}
            >
              {mode === 'create' ? t('Create event') : t('Edit event')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {mode === 'create'
                ? t('Create a new event, optionally recurring.')
                : t('Edit this event or manage its recurring series.')}
            </DialogDescription>
          </div>
          <DialogClose
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-parchment-edge bg-parchment-soft text-ink-muted transition-colors hover:text-ink"
            aria-label={t('Close')}
          >
            <X className="h-[15px] w-[15px]" />
          </DialogClose>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-6 pb-6 pt-[18px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'create') handleCreate(e);
              else handleUpdate();
            }}
          >
            {/* Title */}
            <div>
              <Label htmlFor="ev-title" className={labelCls}>
                {t('Title')}
              </Label>
              <Input
                id="ev-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('e.g. Sunday Service')}
                required
                className={fieldCls}
              />
            </div>

            {/* Date / Start / End */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-[1.4fr_1fr_1fr]">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <Label htmlFor="ev-date" className={labelCls}>
                  {t('Date')}
                </Label>
                <Input
                  id="ev-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                  className={cn(monoCls, 'px-2.5')}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="ev-start" className={labelCls}>
                  {t('Start')}
                </Label>
                <Input
                  id="ev-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(monoCls, 'px-2.5')}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="ev-end" className={labelCls}>
                  {t('End')}
                </Label>
                <Input
                  id="ev-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={cn(monoCls, 'px-2.5')}
                />
              </div>
            </div>

            {/* Check-in window */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <div className="min-w-0">
                <Label htmlFor="ev-checkin-open" className={labelCls}>
                  {t('Check-in opens (min before start)')}
                </Label>
                <Input
                  id="ev-checkin-open"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={CHECK_IN_MAX_MIN}
                  step={1}
                  value={opensBefore}
                  onChange={(e) => setOpensBefore(e.target.value)}
                  className={cn(monoCls, 'px-2.5')}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="ev-checkin-close" className={labelCls}>
                  {t('Check-in closes (min after start)')}
                </Label>
                <Input
                  id="ev-checkin-close"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={CHECK_IN_MAX_MIN}
                  step={1}
                  value={closesAfter}
                  onChange={(e) => setClosesAfter(e.target.value)}
                  className={cn(monoCls, 'px-2.5')}
                />
              </div>
              <p className="col-span-2 -mt-1 text-[11px] leading-snug text-ink-muted">
                {t(
                  'Department heads can only check people in during this window. Admins can at any time.',
                )}
              </p>
            </div>

            {/* Department */}
            <div className="mt-3.5">
              <Label className={labelCls}>{t('Department')}</Label>
              {lockDepartment ? (
                <div className={cn(fieldCls, 'flex items-center gap-2')}>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: deptColor(userDeptId) }}
                  />
                  <span
                    className={locale === 'am' ? 'font-ethiopic' : 'font-body'}
                  >
                    {getDeptName(userDeptId)}
                  </span>
                </div>
              ) : (
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className={cn(fieldCls, 'h-[42px]')}>
                    <SelectValue
                      placeholder={t('Select department (optional)')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: deptColor(d.id) }}
                          />
                          <span
                            className={
                              locale === 'am' ? 'font-ethiopic' : 'font-body'
                            }
                          >
                            {locale === 'am' ? d.nameAm : d.nameEn}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Who is expected at check-in and on close */}
            <div className="mt-3.5">
              <AudienceField
                value={audience}
                onChange={setAudience}
                labelClassName={labelCls}
              />
            </div>

            {/* Description */}
            <div className="mt-3.5">
              <Label htmlFor="ev-desc" className={labelCls}>
                {t('Description')}{' '}
                <span className="font-normal normal-case tracking-normal text-ink-faint">
                  · {t('optional')}
                </span>
              </Label>
              <Textarea
                id="ev-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('Optional details')}
                rows={2}
                className={cn(fieldCls, 'min-h-0')}
              />
            </div>

            {/* Repeat (create only) */}
            {mode === 'create' && (
              <div className="mt-4 rounded-[14px] border border-dashed border-gold bg-gold/10 px-4 py-3.5 dark:bg-gold/[0.06]">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                    <Repeat className="h-3.5 w-3.5" /> {t('Repeat')}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] text-ink-muted',
                      locale === 'am' ? 'font-body' : 'font-ethiopic',
                    )}
                  >
                    {otherLang('Repeat', 'ድግግሞሽ')}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {REPEAT_OPTIONS.map((o) => {
                    const active = repeat === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => onRepeatChange(o.value)}
                        aria-pressed={active}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-2 text-[11px] transition-colors',
                          active
                            ? 'bg-brand font-semibold text-cream shadow-[0_2px_6px_-2px_rgba(10,60,54,0.4)]'
                            : 'border border-parchment-edge bg-parchment-soft font-medium text-ink hover:bg-parchment-deep',
                        )}
                      >
                        <span
                          className={
                            locale === 'am' ? 'font-ethiopic' : undefined
                          }
                        >
                          {locale === 'am' ? REPEAT_AM[o.value] : o.label}
                        </span>
                        <span
                          className={cn(
                            'text-[8.5px]',
                            locale === 'am' ? 'font-body' : 'font-ethiopic',
                            active ? 'opacity-85' : 'opacity-60',
                          )}
                        >
                          {locale === 'am' ? o.label : REPEAT_AM[o.value]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {recurring && (
                  <div className="mt-3">
                    <Label htmlFor="ev-until" className={labelCls}>
                      {t('Until')}
                    </Label>
                    <Input
                      id="ev-until"
                      type="date"
                      value={until}
                      min={eventDate || undefined}
                      max={maxUntil || undefined}
                      onChange={(e) => setUntil(e.target.value)}
                      className={monoCls}
                    />
                  </div>
                )}

                {eventDate && (!recurring || (cappedUntil && occCount > 0)) && (
                  <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-parchment-edge bg-parchment px-3 py-2.5">
                    <Info className="mt-0.5 h-[13px] w-[13px] shrink-0 text-gold-deep" />
                    <div className="text-[11.5px] leading-[1.45] text-ink">
                      {recurring
                        ? withBoldCount(
                            'Will create {count} {cadence} from {from} until {until}.',
                            t('{n} events', { n: occCount }),
                            {
                              cadence: cadencePhrase(
                                repeat as Recurrence,
                                eventDate,
                                locale,
                              ),
                              from: fmtLong(eventDate),
                              until: fmtLong(cappedUntil),
                            },
                          )
                        : withBoldCount(
                            'Creates {count} on {date}.',
                            t('1 event'),
                            { date: fmtLong(eventDate) },
                          )}
                      {recurring && isCapped && (
                        <span className="mt-0.5 block text-[10.5px] text-status-late">
                          {t('Capped at 12 months from the start date.')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Series controls (edit of a recurring occurrence) */}
            {inSeries && event && (
              <div className="mt-4 rounded-[14px] border border-dashed border-gold bg-gold/10 px-4 py-3.5 dark:bg-gold/[0.06]">
                <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                  <Repeat className="h-3.5 w-3.5" /> {t('Recurring series')}
                </div>
                <p className="mb-2.5 text-[11.5px] leading-snug text-ink-muted">
                  {t(
                    'This is one of {n} occurrences. Editing above changes only this one. To move where the series ends, set a new end date. Past and attended events are never touched.',
                    { n: seriesEvents.length },
                  )}
                </p>
                <Label htmlFor="ev-series-until" className={labelCls}>
                  {t('Series ends')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="ev-series-until"
                    type="date"
                    value={seriesUntil}
                    min={todayYmd()}
                    onChange={(e) => setSeriesUntil(e.target.value)}
                    className={monoCls}
                  />
                  <button
                    type="button"
                    disabled={busy || !seriesUntil}
                    onClick={handleSeriesEnd}
                    className="shrink-0 rounded-[10px] border border-gold/50 bg-parchment-soft px-3.5 text-xs font-semibold text-gold-deep transition-colors hover:bg-parchment-deep disabled:opacity-50"
                  >
                    {t('Update end')}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-[18px] flex items-center gap-2.5">
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy || hasAttendance}
                  title={
                    hasAttendance
                      ? t('Has attendance, cannot delete')
                      : t('Delete this event')
                  }
                  aria-label={t('Delete this event')}
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-parchment-edge bg-parchment-soft text-status-absent transition-colors hover:bg-status-absent-bg disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <DialogClose
                type="button"
                className="flex-1 rounded-xl border border-parchment-edge bg-parchment-soft py-3 text-[13px] font-semibold text-brand transition-colors hover:bg-parchment-deep dark:text-gold-light"
              >
                {t('Cancel')}
              </DialogClose>
              <button
                type="submit"
                disabled={busy}
                className={cn(primaryBtn, 'flex-[2] px-5 py-3 text-[13px]')}
              >
                {mode === 'create'
                  ? busy
                    ? t('Creating…')
                    : recurring
                      ? t('Create {n} events', { n: occCount })
                      : t('Create event')
                  : busy
                    ? t('Saving…')
                    : t('Save changes')}
              </button>
            </div>

            {mode === 'edit' && hasAttendance && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
                <TriangleAlert className="h-3 w-3 shrink-0 text-status-late" />
                {t(
                  'This event has attendance recorded and is protected from deletion.',
                )}
              </p>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
