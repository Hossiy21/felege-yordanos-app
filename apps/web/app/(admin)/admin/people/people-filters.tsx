'use client';

import {
  ClearFilters,
  CollapsibleFilters,
  FilterDate,
  FilterNumber,
  FilterSearch,
  FilterSelect,
  PeriodSelect,
  type FilterOption,
} from '@/components/people/url-filters';
import { useT } from '@/lib/i18n/client';

const FILTER_NAMES = [
  'type',
  'status',
  'dept',
  'from',
  'to',
  'rate_below',
  'streak_min',
  'not_seen_since',
  'q',
];

/** Filters of the people list (all in the URL). */
export function PeopleFilters({
  deptOptions,
  periods,
}: {
  deptOptions: FilterOption[];
  periods: { key: string; label: string; from: string; to: string }[];
}) {
  const t = useT();
  return (
    <CollapsibleFilters
      names={[...FILTER_NAMES, 'sort']}
      className="grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-6"
    >
      <FilterSearch
        label={t('Search')}
        placeholder={t('Name or ID…')}
        className="col-span-2"
      />
      <FilterSelect
        name="type"
        label={t('Type')}
        allLabel={t('All')}
        options={[
          { value: 'member', label: t('Members') },
          { value: 'pre_member', label: t('Pre-members') },
        ]}
      />
      <FilterSelect
        name="status"
        label={t('Status')}
        options={[
          { value: '', label: t('Active') },
          { value: 'inactive', label: t('Withdrawn / inactive') },
          { value: 'all', label: t('All') },
        ]}
      />
      <FilterSelect
        name="dept"
        label={t('Department')}
        allLabel={t('All')}
        options={deptOptions}
      />
      <FilterSelect
        name="sort"
        label={t('Sort by')}
        resets={['dir']}
        options={[
          { value: '', label: t('Name') },
          { value: 'last_seen', label: t('Last seen (oldest first)') },
          { value: 'streak', label: t('Missed in a row') },
          { value: 'rate', label: t('Rate') },
          { value: 'expected', label: t('Expected') },
          { value: 'attended', label: t('Attended') },
          { value: 'code', label: t('ID') },
        ]}
      />
      <PeriodSelect label={t('Period')} periods={periods} />
      <FilterDate name="from" label={t('From')} />
      <FilterDate name="to" label={t('To')} />
      <FilterNumber
        name="rate_below"
        label={t('Rate below %')}
        placeholder="50"
        min={1}
        max={100}
      />
      <FilterNumber
        name="streak_min"
        label={t('Missed in a row ≥')}
        placeholder="3"
        min={1}
        max={999}
      />
      <FilterDate name="not_seen_since" label={t('Not seen since')} />
      <div className="col-span-2 flex items-end justify-end md:col-span-4 lg:col-span-6">
        <ClearFilters names={FILTER_NAMES} />
      </div>
    </CollapsibleFilters>
  );
}
