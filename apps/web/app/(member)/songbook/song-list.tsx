'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type {
  categories as categoriesTable,
  songs as songsTable,
} from '@felege-yordanos/db/schema';
import { Chip } from '@/components/ds';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import {
  categoryDotMap,
  hasEthiopic,
  matchesSongSearch,
  songNumber,
} from '@/lib/category-color';

type Song = typeof songsTable.$inferSelect;
type Category = typeof categoriesTable.$inferSelect;

interface SongListProps {
  songs: Song[];
  categories: Category[];
}

/** Phone songbook: search, category pills, song cards. */
export function SongList({ songs, categories }: SongListProps) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const dots = useMemo(() => categoryDotMap(categories), [categories]);

  const filtered = songs.filter(
    (song) =>
      matchesSongSearch(song, search) &&
      (!activeCategory || song.category === activeCategory),
  );

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3.5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          aria-label={t('Search songs')}
          placeholder={t('Search by title, number, or lyrics…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-parchment-edge bg-parchment-soft py-[11px] pl-[38px] pr-3.5 text-[13px] text-ink shadow-[inset_0_1px_2px_rgba(10,60,54,0.04)] outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-gold/30 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
        />
      </div>

      {/* Category pills */}
      <div className="-mx-[22px] mb-4 flex gap-1.5 overflow-x-auto px-[22px] pb-0.5">
        <Chip
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
          amharic={hasEthiopic(t('All'))}
          className="px-3.5 py-1.5 text-[11.5px]"
        >
          {t('All')}
        </Chip>
        {categories.map((cat) => {
          const active = activeCategory === cat.name;
          return (
            <Chip
              key={cat.id}
              active={active}
              dot={dots.get(cat.name)}
              amharic={hasEthiopic(cat.name)}
              onClick={() => setActiveCategory(active ? null : cat.name)}
              className="px-3.5 py-1.5 text-[11.5px]"
            >
              {cat.name}
            </Chip>
          );
        })}
      </div>

      {/* Songs */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">
          {t('No songs found')}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((song) => (
            <Link
              key={song.id}
              href={`/songbook/${song.id}`}
              className="flex items-center gap-3 rounded-xl border border-parchment-edge bg-parchment-soft py-[11px] pl-3 pr-3.5 transition-colors hover:bg-parchment-deep"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-parchment-edge bg-gradient-to-br from-parchment-soft to-parchment-deep">
                <span className="font-display text-[18px] font-semibold tabular-nums lining-nums text-brand dark:text-gold">
                  {songNumber(song.number)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-ethiopic text-base font-semibold leading-[1.15] text-brand-ink">
                  {song.title}
                </div>
                {song.titleEn && (
                  <div className="truncate font-display text-[12.5px] italic text-ink-muted">
                    {song.titleEn}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-gold-deep',
                  hasEthiopic(song.category) && 'font-ethiopic',
                )}
              >
                {song.category}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
