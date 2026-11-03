'use client';

/**
 * Filter controls that live in the URL (shareable links): changing one
 * replaces the query string and the server page renders again. Used by the
 * people list and the person pages.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const fieldCls =
  'h-9 w-full rounded-[10px] border border-parchment-edge bg-parchment-soft px-2.5 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 dark:bg-parchment-deep';

/** Set (or clear, with '') URL parameters; any change goes back to page 1. */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    const q = next.toString();
    startTransition(() =>
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
    );
  };
  return { params, set, pending };
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-gold-deep">
        {label}
      </span>
      {children}
    </label>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  name,
  label,
  options,
  allLabel,
  resets = [],
  className,
}: {
  name: string;
  label: string;
  options: FilterOption[];
  /** Label of the empty choice; omit when the options include ''. */
  allLabel?: string;
  /** Parameters cleared along with a change (e.g. the sort direction). */
  resets?: string[];
  className?: string;
}) {
  const { params, set } = useUrlFilters();
  return (
    <Field label={label} className={className}>
      <select
        value={params.get(name) ?? ''}
        onChange={(e) =>
          set({
            ...Object.fromEntries(resets.map((r) => [r, ''])),
            [name]: e.target.value,
          })
        }
        className={fieldCls}
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function FilterDate({
  name,
  label,
  className,
}: {
  name: string;
  label: string;
  className?: string;
}) {
  const { params, set } = useUrlFilters();
  return (
    <Field label={label} className={className}>
      <input
        type="date"
        value={params.get(name) ?? ''}
        onChange={(e) => set({ [name]: e.target.value })}
        className={cn(fieldCls, 'font-mono')}
      />
    </Field>
  );
}

/** A number applied on Enter or when the field loses focus. */
export function FilterNumber({
  name,
  label,
  placeholder,
  min,
  max,
  className,
}: {
  name: string;
  label: string;
  placeholder?: string;
  min: number;
  max: number;
  className?: string;
}) {
  const { params, set } = useUrlFilters();
  const current = params.get(name) ?? '';
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  const apply = () => {
    if (value !== current) set({ [name]: value });
  };
  return (
    <Field label={label} className={className}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        className={cn(fieldCls, 'font-mono')}
      />
    </Field>
  );
}

/** Text search, applied while typing (after a short pause). */
export function FilterSearch({
  name = 'q',
  label,
  placeholder,
  className,
}: {
  name?: string;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const { params, set } = useUrlFilters();
  const current = params.get(name) ?? '';
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  // The latest setter, so the pause restarts only when the text changes.
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (value.trim() === current) return;
    const id = setTimeout(
      () => setRef.current({ [name]: value.trim() }),
      350,
    );
    return () => clearTimeout(id);
  }, [value, current, name]);
  return (
    <Field label={label} className={className}>
      <span className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className={cn(fieldCls, 'pl-8 placeholder:text-ink-faint')}
        />
      </span>
    </Field>
  );
}

/**
 * Date-range presets (Ethiopian years and months): choosing one sets `from`
 * and `to`; the choice shows while the dates match it.
 */
export function PeriodSelect({
  label,
  periods,
  className,
}: {
  label: string;
  periods: { key: string; label: string; from: string; to: string }[];
  className?: string;
}) {
  const t = useT();
  const { params, set } = useUrlFilters();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const current =
    !from && !to
      ? ''
      : (periods.find((p) => p.from === from && p.to === to)?.key ?? 'custom');
  return (
    <Field label={label} className={className}>
      <select
        value={current}
        onChange={(e) => {
          const p = periods.find((x) => x.key === e.target.value);
          if (e.target.value === '') set({ from: '', to: '' });
          else if (p) set({ from: p.from, to: p.to });
        }}
        className={fieldCls}
      >
        <option value="">{t('All time')}</option>
        {current === 'custom' && (
          <option value="custom">{t('Custom dates')}</option>
        )}
        {periods.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Clears the given parameters (shown only when one is set). */
export function ClearFilters({ names }: { names: string[] }) {
  const t = useT();
  const { params, set, pending } = useUrlFilters();
  const active = names.some((n) => params.get(n));
  if (!active) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => set(Object.fromEntries(names.map((n) => [n, ''])))}
      className="inline-flex h-9 items-center gap-1.5 self-end whitespace-nowrap rounded-[10px] px-2.5 text-[12px] font-medium text-gold-deep hover:bg-gold/10"
    >
      <X className="h-3.5 w-3.5" />
      {t('Clear filters')}
    </button>
  );
}

/**
 * Filter panel: always open on desktop; on phones behind a "Filters" button
 * showing how many of `names` are set (open by default when any is).
 */
export function CollapsibleFilters({
  names,
  className,
  children,
}: {
  names: string[];
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const params = useSearchParams();
  const active = names.filter((n) => params.get(n)).length;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-[12.5px] font-semibold text-brand md:hidden dark:text-gold-light"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('Filters')}
          {active > 0 && (
            <span className="rounded-full bg-gold/20 px-1.5 font-mono text-[10.5px] text-gold-deep">
              {active}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      <div className={cn(open ? 'mt-3 grid' : 'hidden', 'md:mt-0 md:grid', className)}>
        {children}
      </div>
    </>
  );
}
