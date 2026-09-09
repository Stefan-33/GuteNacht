import { Aligner } from './aligner';
import type { AudioEngine } from './audio';
import type { Story } from './types';

export interface SessionUpdate {
  position: number;
  confidence: number;
  /** Name des zuletzt ausgelösten Effekts - für das Aufblitzen im Text. */
  firedSound: string | null;
  jumpedBack: boolean;
}

/**
 * Verbindet Aligner und Audio: Position rein, Klang raus.
 *
 * Effekte (sfx) feuern einmalig beim Überschreiten und werden wieder
 * scharfgestellt, wenn die Position zurückspringt - liest jemand eine
 * Seite noch mal vor, soll der Esel wieder schreien.
 *
 * Atmosphären (amb) werden dagegen nicht "gefeuert", sondern aus der
 * Position abgeleitet: Welche Kulisse müsste an dieser Stelle laufen?
 * Damit stimmt der Hintergrund auch nach einem Sprung mitten in den Wald.
 */
export class ReadingSession {
  private readonly aligner: Aligner;
  private readonly firedSfx = new Set<number>();
  private lastPosition = 0;
  private activeAmbients = new Map<string, number>();

  onUpdate: ((u: SessionUpdate) => void) | null = null;

  constructor(
    private readonly story: Story,
    private readonly audio: AudioEngine,
  ) {
    this.aligner = new Aligner(story.tokens, story.codes);
  }

  get position(): number {
    return this.aligner.position;
  }

  get total(): number {
    return this.story.tokens.length;
  }

  get progress(): number {
    return this.total === 0 ? 0 : this.aligner.position / this.total;
  }

  /** Neue Spracherkennungs-Hypothese verarbeiten. */
  feed(heard: string[]): void {
    const result = this.aligner.feed(heard);
    if (!result.moved) return;
    this.apply(result.position, result.jumpedBack, result.confidence);
  }

  /** Manuell an eine Stelle springen (Tippen auf ein Wort). */
  jumpTo(position: number): void {
    const back = position < this.aligner.position;
    this.aligner.jumpTo(position);
    this.apply(position, back, 1);
  }

  private apply(position: number, jumpedBack: boolean, confidence: number): void {
    /*
     * Klänge hinter der neuen Position nur bei einem GROSSEN Rücksprung
     * wieder scharfstellen.
     *
     * Gedacht war das für den Fall, dass jemand einen Absatz noch einmal
     * vorliest - dann soll der Esel wieder schreien. In der Messung kam
     * aber etwas anderes heraus: Kleine Rücksprünge sind fast immer
     * Korrekturen der Spracherkennung, keine Wiederholungen. Wer sie als
     * Wiederholung behandelt, lässt denselben Klang zweimal feuern - in
     * einer Geschichte bis zu elfmal. Das hört man sofort, und es ist
     * schlimmer als ein Klang, der beim echten Nochmal-Lesen ausbleibt.
     */
    const REREAD = 30;
    if (jumpedBack && this.aligner.position + REREAD <= this.lastPosition) {
      for (const i of [...this.firedSfx]) {
        const cue = this.story.cues[i];
        if (cue.at - cue.lead > position) this.firedSfx.delete(i);
      }
    }
    this.lastPosition = position;

    let firedSound: string | null = null;
    for (let i = 0; i < this.story.cues.length; i++) {
      const cue = this.story.cues[i];
      if (cue.type !== 'sfx') continue;
      if (cue.at - cue.lead > position) break; // cues sind sortiert
      if (this.firedSfx.has(i)) continue;
      this.firedSfx.add(i);
      this.audio.playSfx(cue.sound, cue.gain);
      firedSound = cue.sound;
    }

    this.syncAmbients(position);
    this.onUpdate?.({ position, confidence, firedSound, jumpedBack });
  }

  /** Kulisse aus der Position ableiten und den Unterschied nachfahren. */
  private syncAmbients(position: number): void {
    const desired = new Map<string, number>();
    for (const cue of this.story.cues) {
      if (cue.at - cue.lead > position) break;
      if (cue.type === 'amb') desired.set(cue.sound, cue.gain);
      else if (cue.type === 'amb-stop') desired.delete(cue.sound);
    }

    for (const name of this.activeAmbients.keys()) {
      if (!desired.has(name)) this.audio.stopAmbient(name);
    }
    for (const [name, gain] of desired) {
      if (!this.activeAmbients.has(name)) this.audio.startAmbient(name, gain);
    }
    this.activeAmbients = desired;
  }

  /** Beim Verlassen des Lese-Screens: alles zurück auf Anfang. */
  stop(): void {
    this.audio.stopAllAmbient();
    this.activeAmbients.clear();
  }

  reset(): void {
    this.aligner.reset();
    this.firedSfx.clear();
    this.stop();
    this.onUpdate?.({ position: 0, confidence: 0, firedSound: null, jumpedBack: true });
  }
}
