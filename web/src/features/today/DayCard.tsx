import { descriptionLines } from '../../domain/day';

export type DayStatus = 'pending' | 'done' | 'skip';

/** Opis treninga red po red; uz vežbu snage stoji veza ka video uputstvu (otvara se u novom prozoru). */
export function Description({ desc }: { desc: string | null }) {
  const lines = descriptionLines(desc);
  return (
    <div className="desc">
      {lines.map((ln, i) => (
        <span key={i}>
          {i ? '\n' : ''}
          {ln.text}
          {ln.video ? (
            <>
              {' '}
              <a
                className="yt"
                href={ln.video.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Kako se izvodi: ${ln.video.exercise} (${ln.video.author}, YouTube${ln.video.unverified ? ', neprovereno' : ''})`}
              >
                video{ln.video.unverified ? ' · neprovereno' : ''}
              </a>
            </>
          ) : null}
        </span>
      ))}
    </div>
  );
}
