/**
 * Server part of a person's attendance: loads the timeline, applies the URL
 * filters and passes the numbers to PersonAttendanceView. Callers check
 * canViewPersonAttendance first.
 */
import 'server-only';
import { deptShortLabel, todayYmd } from '@/lib/events';
import {
  ethiopianPeriodLabel,
  ethiopianPeriods,
} from '@/lib/ethiopian-periods';
import { getLocale } from '@/lib/i18n/server';
import { loadPersonTimeline, type PersonRecord } from '@/lib/people-queries';
import {
  filterTimeline,
  parseTimelineFilters,
  withoutStaffColumns,
  type TimelineEntry,
} from '@/lib/person-attendance';
import { PersonAttendanceView } from './person-attendance-view';

export async function PersonAttendanceSection({
  person,
  searchParams,
  staff,
  timeline: loaded,
}: {
  person: PersonRecord;
  searchParams: Record<string, string | string[] | undefined>;
  staff: boolean;
  /** Already loaded by the page (loadPersonTimeline). */
  timeline?: TimelineEntry[];
}) {
  const locale = await getLocale();
  const today = todayYmd();
  const timeline = loaded ?? (await loadPersonTimeline(person, today));
  const filters = parseTimelineFilters(searchParams);
  // The method filter is staff-only.
  if (!staff) filters.method = null;
  const filtered = filterTimeline(timeline, filters);
  const { totals } = filtered;
  // Staff-only columns never leave the server for the self view.
  const shown = staff ? filtered.shown : withoutStaffColumns(filtered.shown);

  // Options from the person's own events (all of them, not just the filtered).
  const deptIds = [
    ...new Set(timeline.map((e) => e.departmentId ?? 0)),
  ].sort((a, b) => a - b);
  const deptLabels: Record<string, string> = { general: deptShortLabel(null, locale) };
  for (const id of deptIds)
    if (id) deptLabels[String(id)] = deptShortLabel(id, locale);
  const deptOptions = deptIds.map((id) =>
    id
      ? { value: String(id), label: deptLabels[String(id)] }
      : { value: 'general', label: deptLabels.general },
  );

  const seriesLabels: Record<string, string> = {};
  for (const e of timeline)
    if (e.recurrenceGroup && !seriesLabels[e.recurrenceGroup])
      seriesLabels[e.recurrenceGroup] = e.title;
  const seriesOptions = Object.entries(seriesLabels)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const periods = ethiopianPeriods(today).map((p) => ({
    key: p.key,
    label: ethiopianPeriodLabel(p, locale),
    from: p.from,
    to: p.to,
  }));

  return (
    <PersonAttendanceView
      entries={shown}
      totals={totals}
      staff={staff}
      deptLabels={deptLabels}
      deptOptions={deptOptions}
      seriesOptions={seriesOptions}
      seriesLabels={seriesLabels}
      periods={periods}
      promoted={person.formerPreMember !== null}
      exportName={person.code || `${person.kind}-${person.id}`}
    />
  );
}
