import { cologne } from './phonetics';
import { tokenize } from './tokenize';
import type { Cue, Paragraph, Story, StoryMeta } from './types';

/** Rohformat, wie es die Content-Pipeline ablegt. */
export interface RawCue {
  type: 'sfx' | 'amb' | 'amb-stop';
  sound: string;
  gain: number;
  lead: number;
}
export interface RawItem {
  w?: string;
  c?: RawCue;
}
export interface RawStory extends StoryMeta {
  blocks: RawItem[][];
}

/**
 * Übersetzt das Rohformat in die Laufzeit-Struktur: Token-Array für den
 * Aligner, Cues mit Token-Positionen, Absätze für die Anzeige.
 *
 * Wichtig: Die Tokenisierung passiert hier - also mit exakt derselben
 * Funktion, durch die auch die Spracherkennung läuft. Genau deshalb
 * rechnet die Content-Pipeline keine Token-Indizes vor.
 */
export function compileStory(raw: RawStory): Story {
  const tokens: string[] = [];
  const cues: Cue[] = [];
  const paragraphs: Paragraph[] = [];
  let markNextWord = false;

  for (const block of raw.blocks) {
    const words = [];
    for (const item of block) {
      if (item.c) {
        cues.push({
          at: tokens.length,
          type: item.c.type,
          sound: item.c.sound,
          gain: item.c.gain,
          lead: item.c.lead,
        });
        // Nur Effekte werden im Text markiert - eine Atmosphäre hat kein
        // einzelnes Wort, an dem sie hängt.
        if (item.c.type === 'sfx') markNextWord = true;
        continue;
      }
      if (!item.w) continue;

      const produced = tokenize(item.w);
      const firstToken = produced.length > 0 ? tokens.length : -1;
      tokens.push(...produced);
      words.push({ text: item.w, token: firstToken, cue: markNextWord });
      if (produced.length > 0) markNextWord = false;
    }
    if (words.length > 0) paragraphs.push({ words });
  }

  // Nach Auslösezeitpunkt sortieren, damit die Session sie der Reihe nach abarbeiten kann.
  cues.sort((a, b) => (a.at - a.lead) - (b.at - b.lead));

  return {
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle,
    source: raw.source,
    ageMin: raw.ageMin,
    ageMax: raw.ageMax,
    minutes: raw.minutes,
    categories: raw.categories,
    tokens,
    codes: tokens.map(cologne),
    cues,
    paragraphs,
  };
}

export async function loadIndex(): Promise<StoryMeta[]> {
  const res = await fetch('/stories/index.json');
  if (!res.ok) throw new Error('Bibliothek konnte nicht geladen werden');
  return res.json();
}

export async function loadStory(id: string): Promise<Story> {
  const res = await fetch(`/stories/${id}.json`);
  if (!res.ok) throw new Error(`Geschichte "${id}" nicht gefunden`);
  return compileStory(await res.json());
}
