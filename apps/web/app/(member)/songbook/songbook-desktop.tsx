'use client';

import { useMemo, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import type {
  categories as categoriesTable,
  songs as songsTable,
} from '@felege-yordanos/db/schema';
import { AudioPlayer } from '@/components/audio-player';
import { Card, Chip } from '@/components/ds';
import { useT } from '@/lib/i18n/client';
import { songAudioSrc } from '@/lib/media';
import { cn } from '@/lib/utils';
import {
  categoryDotMap,
  hasEthiopic,
  matchesSongSearch,
  songNumber,
} from '@/lib/category-color';
import { LyricsCard } from './lyrics';
import { recordOpenedSong } from '@/components/song-history-refresh';

type Song = typeof songsTable.$inferSelect;
type Category = typeof categoriesTable.$inferSelect;

/**
 * Desktop songbook: a scrollable list pane on the
 * left and the selected song's lyrics on the right. Phones use SongList and
 * the per-song route instead; this renders only at md+.
 */
export function SongbookDesktop({
  songs,
  categories,
  className,
}: {
  songs: Song[];
  categories: Category[];
  className?: string;
}) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    songs[0]?.id ?? null,
  );

  const dots = useMemo(() => categoryDotMap(categories), [categories]);

  const filtered = songs.filter(
    (s) =>
      matchesSongSearch(s, search) &&
      (!activeCategory || s.category === activeCategory),
  );

  const selected =
    songs.find((s) => s.id === selectedId) ?? filtered[0] ?? songs[0] ?? null;
  const audioSrc = selected ? songAudioSrc(selected) : null;

  return (
    <div className={className}>
      <div className="grid grid-cols-[350px_1fr] items-start gap-4">
        {/* ── Left: list pane ── */}
        <Card className="flex max-h-[calc(100dvh-110px)] flex-col overflow-hidden p-0">
          <div className="px-5 pt-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-ethiopic text-[26px] font-bold leading-none text-brand dark:text-gold">
                  መዝሙር
                </div>
                <div className="mt-0.5 font-display text-[13px] italic text-ink-muted">
                  Songbook
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] text-gold-deep">
                  {songs.length}
                </div>
                <div className="text-[8.5px] uppercase tracking-[0.16em] text-ink-muted">
                  {t('songs')}
                </div>
              </div>
            </div>

            {/* Search */}
            <label className="mb-2.5 mt-3 flex items-center gap-2 rounded-[10px] border border-parchment-edge bg-parchment px-[11px] py-2 focus-within:ring-2 focus-within:ring-gold/30 dark:bg-parchment-deep">
              <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t('Search songs')}
                placeholder={t('Title, number, or lyrics…')}
                className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint"
              />
            </label>

            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={activeCategory === null}
                onClick={() => setActiveCategory(null)}
                amharic={hasEthiopic(t('All'))}
              >
                {t('All')}
              </Chip>
              {categories.map((c) => {
                const active = activeCategory === c.name;
                return (
                  <Chip
                    key={c.id}
                    active={active}
                    dot={dots.get(c.name)}
                    amharic={hasEthiopic(c.name)}
                    onClick={() => setActiveCategory(active ? null : c.name)}
                  >
                    {c.name}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* Scrollable song list */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2.5">
            {filtered.map((song) => {
              const active = song.id === selected?.id;
              return (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(song.id);
                    recordOpenedSong(song.id);
                  }}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left transition-colors',
                    active
                      ? 'bg-brand/[0.07] dark:bg-gold/[0.12]'
                      : 'hover:bg-parchment-deep/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-display text-sm font-semibold',
                      active
                        ? 'sacred-gradient border-gold/40 text-gold'
                        : 'border-parchment-edge bg-gradient-to-br from-parchment-soft to-parchment-deep text-brand dark:text-gold',
                    )}
                  >
                    {songNumber(song.number)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ethiopic text-[13.5px] font-semibold text-brand-ink">
                      {song.title}
                    </span>
                    {song.titleEn && (
                      <span className="block truncate font-display text-[11.5px] italic text-ink-muted">
                        {song.titleEn}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-gold-deep',
                      hasEthiopic(song.category) && 'font-ethiopic',
                    )}
                  >
                    {song.category}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-ink-muted">
                {t('No songs found')}
              </p>
            )}
          </div>
        </Card>

        {/* ── Right: detail pane ── */}
        <Card className="max-h-[calc(100dvh-110px)] overflow-y-auto p-[30px]">
          {selected ? (
            <div className="max-w-[640px]">
              <div className="flex items-start gap-4">
                <div className="sacred-gradient flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[14px] border border-gold/30 shadow-[0_6px_16px_-8px_rgba(10,60,54,0.5)]">
                  <span className="font-display text-[26px] font-medium text-gold">
                    {songNumber(selected.number)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-ethiopic text-[28px] font-semibold leading-[1.15] text-brand-ink">
                    {selected.title}
                  </h1>
                  {selected.titleEn && (
                    <div className="mt-0.5 font-display text-base italic text-ink-muted">
                      {selected.titleEn}
                    </div>
                  )}
                </div>
              </div>

              {/* Category + actions */}
              <div className="mt-4 flex items-center gap-2 print:hidden">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full bg-brand/[0.08] px-2.5 py-1 text-[11px] font-medium text-brand dark:bg-gold/[0.12] dark:text-gold-light',
                    hasEthiopic(selected.category) && 'font-ethiopic',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-gold"
                    style={
                      dots.has(selected.category)
                        ? { background: dots.get(selected.category) }
                        : undefined
                    }
                  />
                  {selected.category}
                </span>
                {audioSrc && (
                  <AudioPlayer
                    // A new player per song: switching songs stops playback.
                    key={selected.id}
                    src={audioSrc}
                    className="max-w-[420px] flex-1"
                  />
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center rounded-full border border-parchment-edge bg-parchment-soft px-2 py-1.5 text-gold-deep transition-colors hover:bg-parchment-deep"
                  aria-label={t('Print')}
                  title={t('Print')}
                >
                  <Printer className="h-[13px] w-[13px]" />
                </button>
              </div>

              <LyricsCard
                size="lg"
                lyrics={selected.lyrics}
                label={t('Lyrics')}
                emptyLabel={t('No lyrics available.')}
              />
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-ink-muted">
              {songs.length === 0
                ? t('No songs yet')
                : t('Select a song to view lyrics.')}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
