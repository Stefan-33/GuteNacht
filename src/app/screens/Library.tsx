import { useMemo, useState } from 'react';
import type { StoryMeta } from '../../engine/types';

interface Props {
  stories: StoryMeta[];
  onOpen: (id: string) => void;
}

/**
 * Filter über den Kategorien der Geschichten. Bewusst wenige und grobe:
 * Wer abends mit einem müden Kind auf dem Arm ein Handy bedient, will
 * nicht vierzehn Schlagworte lesen, sondern eine Richtung wählen.
 */
const FILTERS: { label: string; match: (s: StoryMeta) => boolean }[] = [
  { label: 'Alle', match: () => true },
  { label: 'Märchen', match: (s) => s.categories.some((c) => c === 'maerchen' || c === 'fabel') },
  { label: 'Tiere', match: (s) => s.categories.includes('tiere') },
  { label: 'Fantasie', match: (s) => s.categories.includes('fantasie') },
  { label: 'Lustig', match: (s) => s.categories.includes('lustig') },
  { label: 'Zum Einschlafen', match: (s) => s.categories.some((c) => c === 'einschlafen' || c === 'ruhig') },
];

export function Library({ stories, onOpen }: Props) {
  const [filter, setFilter] = useState(0);

  const shown = useMemo(
    () => stories.filter(FILTERS[filter].match),
    [stories, filter],
  );

  const surprise = () => {
    const pool = shown.length > 0 ? shown : stories;
    onOpen(pool[Math.floor(Math.random() * pool.length)].id);
  };

  const minutes = stories.reduce((a, s) => a + s.minutes, 0);

  return (
    <div className="library">
      <header className="library-head">
        <div className="moon" aria-hidden="true" />
        <h1>GuteNacht</h1>
        <p>Du liest vor. Die Geschichte macht die Geräusche.</p>
      </header>

      <div className="filters" role="tablist">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            role="tab"
            aria-selected={i === filter}
            className={`chip${i === filter ? ' on' : ''}`}
            onClick={() => setFilter(i)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <button className="surprise" onClick={surprise}>
        ✨ Überrasch mich
      </button>

      <ul className="story-list">
        {shown.map((s) => (
          <li key={s.id}>
            <button className="story-card" onClick={() => onOpen(s.id)}>
              <span className="story-title">{s.title}</span>
              {s.subtitle && <span className="story-subtitle">{s.subtitle}</span>}
              <span className="story-meta">
                <span className="pill">{s.ageMin}–{s.ageMax} Jahre</span>
                <span className="pill">{s.minutes} Min</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="library-foot">Hier ist noch nichts. Nimm einen anderen Filter.</p>
      )}

      <p className="library-foot">
        {stories.length} Geschichten, zusammen rund {minutes} Minuten Vorlesezeit.
        <br />
        Am besten mit Chrome auf dem Handy. Beim ersten Start fragt der Browser
        nach dem Mikrofon – das braucht die App, um deinem Vorlesen zu folgen.
      </p>
    </div>
  );
}
