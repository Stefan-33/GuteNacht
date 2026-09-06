import type { StoryMeta } from '../../engine/types';

interface Props {
  stories: StoryMeta[];
  onOpen: (id: string) => void;
}

export function Library({ stories, onOpen }: Props) {
  return (
    <div className="library">
      <header className="library-head">
        <div className="moon" aria-hidden="true" />
        <h1>GuteNacht</h1>
        <p>Du liest vor. Die Geschichte macht die Geräusche.</p>
      </header>

      <ul className="story-list">
        {stories.map((s) => (
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

      <p className="library-foot">
        Am besten mit Chrome auf dem Handy. Beim ersten Start fragt der Browser
        nach dem Mikrofon – das braucht die App, um deinem Vorlesen zu folgen.
      </p>
    </div>
  );
}
