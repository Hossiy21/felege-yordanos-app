import Link from 'next/link';
import { ArrowRight, ChevronRight, Play } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ds';
import { getT } from '@/lib/i18n/server';
import { songAudioSrc } from '@/lib/media';

export interface SongbookPreviewSong {
  id: string;
  number: number | null;
  title: string;
  titleEn: string | null;
  audioUrl: string | null;
  audioKey: string | null;
}

/** Right-column card showing this signed-in user's recently opened songs. */
export async function SongbookPreviewCard({
  songs,
}: {
  songs: SongbookPreviewSong[];
}) {
  const t = await getT();
  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <SectionHeader en="From the songbook" am="ከመዝሙር መጽሐፍ" />
        <Link
          href="/songbook"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gold-deep hover:underline"
        >
          {t('Open songbook')}
          <ArrowRight className="h-[11px] w-[11px]" />
        </Link>
      </div>

      {songs.length === 0 ? (
        <Link
          href="/songbook"
          className="group flex items-center justify-between gap-3 rounded-xl border border-dashed border-parchment-edge px-3.5 py-4 text-[12.5px] text-ink-muted transition-colors hover:border-gold/50 hover:bg-gold/[0.05] hover:text-brand-ink"
        >
          <span>{t('Open a song to see it here.')}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gold-deep transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <ul>
          {songs.map((song, i) => (
            <li
              key={song.id}
              className={i > 0 ? 'border-t border-parchment-edge' : undefined}
            >
              <Link
                href={`/songbook/${song.id}`}
                className="group -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-gold/[0.06]"
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-parchment-edge bg-gradient-to-br from-parchment-soft to-parchment-deep font-display text-[13px] font-semibold text-brand dark:text-gold">
                  {song.number != null
                    ? String(song.number).padStart(2, '0')
                    : '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-ethiopic text-[13px] font-semibold text-brand-ink">
                    {song.title}
                  </span>
                  {song.titleEn && (
                    <span className="block truncate font-display text-[11.5px] italic text-ink-muted">
                      {song.titleEn}
                    </span>
                  )}
                </span>
                {songAudioSrc(song) ? (
                  <Play
                    className="h-3 w-3 shrink-0 text-gold-deep"
                    aria-label={t('Play recording')}
                  />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-colors group-hover:text-gold-deep" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
