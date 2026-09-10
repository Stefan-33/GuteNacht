/**
 * Datenmodell der Engine. Bewusst frei von React/DOM-Bezügen, damit der
 * spätere React-Native-Port die Dateien unter src/engine/ unverändert
 * übernehmen kann (nur die Adapter für Audio und Sprache werden getauscht).
 */

/** Ein Sound-Ereignis, verankert an einer Token-Position im Text. */
export interface Cue {
  /** Index im Token-Array, an dem der Cue ausgelöst werden soll. */
  at: number;
  /** oneshot = einmaliger Effekt, amb = Hintergrundatmosphäre (läuft weiter). */
  type: 'sfx' | 'amb' | 'amb-stop';
  /** Schlüssel in der Sound-Registry. */
  sound: string;
  gain: number;
  /**
   * Wieviele Tokens VOR `at` bereits gefeuert werden darf. Gleicht die
   * Latenz der Spracherkennung aus (~0,3-1 s), damit der Donner nicht
   * eine Sekunde nach "und es donnerte" kommt.
   */
  lead: number;
}

/** Ein Textabschnitt für die Anzeige, mit Rückbezug auf die Token-Indizes. */
export interface DisplayWord {
  /** Wort inklusive anhängender Satzzeichen, wie es angezeigt wird. */
  text: string;
  /** Index im Token-Array, oder -1 für reine Satzzeichen ohne Token. */
  token: number;
  /** true, wenn an diesem Wort ein Cue hängt (wird fett dargestellt). */
  cue: boolean;
}

export interface Paragraph {
  words: DisplayWord[];
}

export interface Story {
  id: string;
  title: string;
  subtitle?: string;
  source: string;
  ageMin: number;
  ageMax: number;
  minutes: number;
  categories: string[];
  /** Stimmung der Hintergrundmusik, siehe MOODS in music.ts. */
  music: string;
  /** Symbol für die Bibliothek. */
  icon: string;
  /** Normalisierte Tokens - die Grundlage für das Alignment. */
  tokens: string[];
  /** Vorberechnete Phonetik-Codes, damit zur Laufzeit nichts gerechnet wird. */
  codes: string[];
  cues: Cue[];
  paragraphs: Paragraph[];
}

export interface StoryMeta {
  id: string;
  title: string;
  subtitle?: string;
  source: string;
  ageMin: number;
  ageMax: number;
  minutes: number;
  categories: string[];
  music: string;
  icon: string;
}
