import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { categories, db, songs } from '@felege-yordanos/db/server';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';
import { categoryDotMap, hasEthiopic, songNumber } from '@/lib/category-color';
import { LyricsCard } from '../lyrics';
import { AudioPlayer } from '@/components/audio-player';
import { songAudioSrc } from '@/lib/media';
import { RecordSongView } from '../record-song-view';

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const t = await getT();

  // Song ids are uuids; anything else cannot match (and would make Postgres throw).
  if (!z.uuid().safeParse(id).success) notFound();

  const [[song], categoryRows] = await Promise.all([
    db.select().from(songs).where(eq(songs.id, id)).limit(1),
    // Only for the category dot color (same order as the list, so fallbacks match).
    db
      .select({ name: categories.name, color: categories.color })
      .from(categories)
      .orderBy(asc(categories.sortOrder)),
  ]);
  if (!song) notFound();

  const dot = categoryDotMap(categoryRows).get(song.category);
  const audioSrc = songAudioSrc(song);

  return (
    <div className="mx-auto max-w-2xl px-[22px] pb-6 pt-3.5 md:px-7 md:py-7">
      <RecordSongView songId={song.id} />
      <Link
        href="/songbook"
        className="mb-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-gold-deep transition-colors hover:text-brand dark:hover:text-gold-light"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('Back to songbook')}
      </Link>

      {/* Title row */}
      <div className="flex items-start gap-3.5">
        <div className="sacred-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-gold/30 shadow-[0_6px_16px_-8px_rgba(10,60,54,0.5)]">
          <span className="font-display text-2xl font-medium tabular-nums text-gold">
            {songNumber(song.number)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-ethiopic text-2xl font-semibold leading-[1.15] text-brand-ink">
            {song.title}
          </h1>
          {song.titleEn && (
            <p className="mt-0.5 font-display text-[15px] italic text-ink-muted">
              {song.titleEn}
            </p>
          )}
        </div>
      </div>

      {/* Category + recording */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-brand/[0.08] px-2.5 py-1 text-[11px] font-medium text-brand dark:bg-gold/[0.12] dark:text-gold-light',
            hasEthiopic(song.category) && 'font-ethiopic',
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-gold"
            style={dot ? { background: dot } : undefined}
          />
          {song.category}
        </span>
        {audioSrc && <AudioPlayer src={audioSrc} className="flex-1" />}
      </div>

      <LyricsCard
        lyrics={song.lyrics}
        label={t('Lyrics')}
        emptyLabel={t('No lyrics available.')}
      />
    </div>
  );
}
