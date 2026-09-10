import { useEffect, useMemo, useRef } from 'react';
import { useReading } from '../useReading';
import type { Story } from '../../engine/types';

interface Props {
  story: Story;
  onBack: () => void;
}

export function Reader({ story, onBack }: Props) {
  const r = useReading(story);
  const textRef = useRef<HTMLDivElement>(null);
  const started = r.status !== 'idle';

  /** Flache Wortliste, um das aktuelle Wort schnell zu finden. */
  const words = useMemo(() => {
    const flat: { id: string; token: number }[] = [];
    story.paragraphs.forEach((p, pi) => {
      p.words.forEach((w, wi) => {
        if (w.token >= 0) flat.push({ id: `w-${pi}-${wi}`, token: w.token });
      });
    });
    return flat;
  }, [story]);

  /** Das nächste noch nicht gelesene Wort - dorthin scrollt die Ansicht. */
  const currentId = useMemo(() => {
    const next = words.find((w) => w.token >= r.position);
    return next?.id ?? words[words.length - 1]?.id ?? null;
  }, [words, r.position]);

  useEffect(() => {
    if (!currentId || !started) return;
    const el = document.getElementById(currentId);
    if (!el) return;
    // Aktuelles Wort ins obere Drittel holen - darunter bleibt Vorlauf sichtbar.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentId, started]);

  const statusLabel =
    r.status === 'listening' ? 'hört zu'
    : r.status === 'starting' ? 'startet…'
    : r.status === 'error' ? 'Problem'
    : 'pausiert';

  return (
    <div className="reader">
      <header className="reader-head">
        <button className="ghost" onClick={onBack} aria-label="Zurück zur Bibliothek">←</button>
        <div className="reader-title">
          <strong>{story.title}</strong>
          <span className={`status status-${r.status}`}>
            <i className="dot" /> {statusLabel}
          </span>
        </div>
        <button
          className="ghost"
          onClick={() => r.setMusicLevel((r.musicLevel + 1) % 3)}
          aria-label={`Musik ${['aus', 'leise', 'an'][r.musicLevel]} – tippen zum Wechseln`}
          title={`Musik ${['aus', 'leise', 'an'][r.musicLevel]}`}
        >
          {['🔇', '🔉', '🔊'][r.musicLevel]}
        </button>
        <button className="ghost" onClick={r.restart} aria-label="Von vorn beginnen">↺</button>
      </header>

      <div className="progress"><div style={{ width: `${r.progress * 100}%` }} /></div>

      {r.message && <div className="notice">{r.message}</div>}

      <div className="text" ref={textRef}>
        {story.paragraphs.map((p, pi) => (
          <p key={pi}>
            {p.words.map((w, wi) => {
              const passed = w.token >= 0 && w.token < r.position;
              const cls = [
                'w',
                passed ? 'read' : '',
                w.cue ? 'cue' : '',
                w.cue && passed ? 'lit' : '',
                `w-${pi}-${wi}` === currentId ? 'here' : '',
              ].filter(Boolean).join(' ');
              return (
                <span
                  key={wi}
                  id={`w-${pi}-${wi}`}
                  className={cls}
                  onClick={() => w.token >= 0 && r.jumpTo(w.token)}
                >
                  {w.text}{' '}
                </span>
              );
            })}
          </p>
        ))}
        <p className="source">{story.source}</p>
      </div>

      <footer className="reader-foot">
        {!started ? (
          <>
            <button className="primary" onClick={() => void r.start()}>
              Vorlesen starten
            </button>
            <p className="hint">
              {r.micAvailable
                ? 'Lies einfach laut vor. Die Geräusche kommen von allein.'
                : 'Dieser Browser kann keine Spracherkennung – tippe auf ein Wort, um weiterzuspringen.'}
            </p>
          </>
        ) : (
          <>
            <button className="secondary" onClick={r.pause}>Pause</button>
            <p className="hint">
              Verhört sich die App? Tippe auf das Wort, bei dem du gerade bist.
              {r.musicLevel > 0 && ' Hilft das nicht, stell die Musik oben leiser.'}
            </p>
          </>
        )}
      </footer>
    </div>
  );
}
