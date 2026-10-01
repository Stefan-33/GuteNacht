import { useEffect, useState } from 'react';
import { Library } from './screens/Library';
import { Reader } from './screens/Reader';
import { loadIndex, loadSoundStatus, loadStory } from '../engine/story';
import type { SoundStatus } from '../engine/story';
import type { Story, StoryMeta } from '../engine/types';

export function App() {
  const [index, setIndex] = useState<StoryMeta[] | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sounds, setSounds] = useState<SoundStatus>({ have: 0, need: 0 });

  useEffect(() => {
    loadIndex().then(setIndex).catch((e: Error) => setError(e.message));
    loadSoundStatus().then(setSounds);
  }, []);

  const open = (id: string) => {
    setError(null);
    loadStory(id).then(setStory).catch((e: Error) => setError(e.message));
  };

  if (error) {
    return <div className="center"><p className="notice">{error}</p></div>;
  }
  if (story) {
    return <Reader story={story} onBack={() => setStory(null)} />;
  }
  if (!index) {
    return <div className="center"><p className="muted">Wird geladen…</p></div>;
  }
  return <Library stories={index} onOpen={open} sounds={sounds} />;
}
