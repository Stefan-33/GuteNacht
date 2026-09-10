import { AMB, SFX, trimOf } from './sounds';
import { Music } from './music';
import { impulseResponse } from './voice';

interface SampleEntry {
  name: string;
  file: string;
}

/**
 * Synthetische Klänge sind abgeschaltet.
 *
 * Sie waren als Notnagel gedacht, damit die App ohne eine einzige
 * Audiodatei läuft. Für Geräusche - Wind, Schritte, Feuer - hat das
 * getragen; im Kern ist das gefiltertes Rauschen, und das kann Web Audio.
 * Für Tierstimmen nicht: Ein Kehlkopf lässt sich mit Filtern nicht
 * nachbauen. Drei Überarbeitungen mit Formant-Synthese und
 * bioakustischer Kalibrierung haben daran nichts geändert, man hört
 * weiter einen Synthesizer.
 *
 * Ergebnis: Lieber Stille als ein schlechter Klang. Wo keine Aufnahme
 * liegt, passiert nichts. Der Synthesizer bleibt im Code - falls für
 * einen einzelnen Klang nie eine Aufnahme kommt, lässt sich das hier
 * gezielt wieder einschalten.
 */
const SYNTHESE = false;

/**
 * Audio-Fassade: zwei Busse (Atmosphäre und Effekte), ein Master.
 *
 * Vorrang hat immer eine echte Aufnahme. Liegt unter public/sfx/ eine Datei
 * mit passendem Namen, wird sie abgespielt; sonst springt der Synthesizer
 * ein. Damit lässt sich die Klangwelt Stück für Stück ersetzen, ohne eine
 * einzige Geschichte anzufassen - die referenzieren nur den Namen.
 *
 * Ducking: sobald ein Effekt spielt, geht die Atmosphäre kurz zurück.
 * Ohne das matscht ein Waldrauschen jeden Eselschrei zu.
 *
 * Fallstrick Android/Chrome: der AudioContext startet suspendiert und darf
 * erst nach einer echten Nutzergeste laufen. Deshalb `unlock()`, das aus
 * dem Klick auf "Vorlesen starten" heraus aufgerufen wird.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private running = new Map<string, () => void>();
  private samples = new Map<string, AudioBuffer>();
  private music: Music | null = null;
  /** Namen, für die eine Aufnahme fehlt - für die Anzeige in der Bibliothek. */
  private readonly missing = new Set<string>();
  private musicGain = 0.085;
  private duckUntil = 0;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Welche Klänge kommen aus echten Aufnahmen? Nur für die Anzeige. */
  get sampleNames(): string[] {
    return [...this.samples.keys()];
  }

  /** Welche Klänge wurden angefordert, lagen aber nicht als Aufnahme vor? */
  get missingNames(): string[] {
    return [...this.missing].sort();
  }

  /** Muss aus einem Klick-Handler heraus aufgerufen werden. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.ambBus = this.ctx.createGain();
      this.ambBus.gain.value = 1;
      this.ambBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);

      /*
       * Nachhall-Weg. Beide Busse laufen zusätzlich über einen künstlichen
       * Raum. Ohne das klingt jeder synthetische Klang wie im schalltoten
       * Raum aufgenommen - technisch sauber und vollkommen leblos. Etwas
       * Hall bindet Effekte und Kulisse zu einer Szene zusammen.
       */
      const reverb = this.ctx.createConvolver();
      reverb.buffer = impulseResponse(this.ctx);
      reverb.connect(this.master);

      const sfxSend = this.ctx.createGain();
      sfxSend.gain.value = 0.22;
      this.sfxBus.connect(sfxSend).connect(reverb);

      const ambSend = this.ctx.createGain();
      ambSend.gain.value = 0.12;
      this.ambBus.connect(ambSend).connect(reverb);

      await this.loadSamples();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /**
   * Lädt die echten Aufnahmen, die in public/sfx/ liegen.
   * Fehlt das Manifest oder eine Datei, bleibt es beim Synthesizer -
   * ein Fehler hier darf niemals das Vorlesen verhindern.
   */
  private async loadSamples(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;

    let list: SampleEntry[];
    try {
      const res = await fetch('/sfx/index.json');
      if (!res.ok) return;
      list = await res.json();
    } catch {
      return;
    }

    await Promise.all(
      list.map(async ({ name, file }) => {
        try {
          const res = await fetch(`/sfx/${file}`);
          if (!res.ok) return;
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          this.samples.set(name, buffer);
        } catch {
          console.warn(`[audio] ${file} ließ sich nicht laden - nehme den synthetischen Klang.`);
        }
      }),
    );
  }

  /**
   * Hintergrundmusik starten, passend zur Stimmung der Geschichte.
   *
   * Die Lautstärke ist bewusst sehr niedrig. Zwei Gründe: Die Musik soll
   * tragen und nicht führen - und je weniger davon über den Lautsprecher
   * läuft, desto weniger landet wieder im Mikrofon und stört die
   * Spracherkennung.
   */
  startMusic(mood: string): void {
    if (!this.ctx || !this.master || this.music) return;
    this.music = new Music(this.ctx, this.master, { mood, gain: this.musicGain });
    this.music.start();
  }

  /**
   * Musiklautstärke setzen, 0 bis 1.
   *
   * Gibt es, weil sich erst beim echten Vorlesen zeigt, ob die Musik der
   * Spracherkennung in die Quere kommt. Statt darauf zu warten, dass es
   * jemand meldet, kann es am Gerät sofort geregelt werden.
   */
  setMusicVolume(level: number): void {
    this.musicGain = Math.max(0, Math.min(0.2, level));
    this.music?.duck(false, this.musicGain);
  }

  /** Musik zurücknehmen, solange gesprochen wird. */
  duckMusic(active: boolean): void {
    this.music?.duck(active, this.musicGain);
  }

  stopMusic(): void {
    this.music?.stop();
    this.music = null;
  }

  setVolume(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  /** Atmosphäre zurücknehmen, solange ein Effekt läuft. */
  private duck(seconds: number): void {
    if (!this.ctx || !this.ambBus) return;
    const now = this.ctx.currentTime;
    const until = now + seconds + 0.4;
    if (until <= this.duckUntil) return;
    this.duckUntil = until;
    const g = this.ambBus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.35, now + 0.12);
    g.linearRampToValueAtTime(1, until);
  }

  playSfx(name: string, gain = 1): void {
    if (!this.ctx || !this.sfxBus) return;

    /*
     * Der Tierkrach ist aus den vier Stadtmusikanten zusammengesetzt. Wenn
     * für die echte Aufnahmen vorliegen, muss er DIESE stapeln - sonst
     * klingen Esel, Hund, Katze und Hahn einzeln echt, im großen Auftritt
     * aber plötzlich wieder synthetisch. Das wäre der peinlichste Moment
     * der ganzen Geschichte, ausgerechnet an ihrem Höhepunkt.
     */
    if (name === 'tier_krach' && !this.samples.has('tier_krach')) {
      const parts: [string, number][] = [
        ['esel', 0], ['hund_bellen', 0.15], ['katze_miau', 0.4],
        ['hahn_kikeriki', 0.65], ['hund_bellen', 1.0],
        ['katze_miau', 1.45], ['hahn_kikeriki', 1.75],
      ];
      const anyReal = parts.some(([p]) => this.samples.has(p));
      if (anyReal || !SYNTHESE) {
        for (const [part, delay] of parts) {
          setTimeout(() => this.playSfx(part, gain * 0.45), delay * 1000);
        }
        return;
      }
    }

    const sample = this.samples.get(name);
    if (sample) {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      g.connect(this.sfxBus);
      const src = this.ctx.createBufferSource();
      src.buffer = sample;
      src.connect(g);
      src.start(this.ctx.currentTime + 0.02);
      src.onended = () => g.disconnect();
      this.duck(sample.duration);
      return;
    }

    if (!SYNTHESE) {
      // Keine Aufnahme vorhanden - dann bleibt es still.
      this.missing.add(name);
      return;
    }

    const recipe = SFX[name];
    if (!recipe) {
      console.warn(`[audio] Unbekannter Effekt: ${name}`);
      return;
    }
    const g = this.ctx.createGain();
    // Der Pegelabgleich gilt nur für synthetische Klänge - echte Aufnahmen
    // bringen ihre eigene Aussteuerung mit.
    g.gain.value = gain * trimOf(name);
    g.connect(this.sfxBus);
    const dur = recipe(this.ctx, g, this.ctx.currentTime + 0.02);
    this.duck(dur);
    setTimeout(() => g.disconnect(), (dur + 1) * 1000);
  }

  startAmbient(name: string, gain = 0.5): void {
    if (!this.ctx || !this.ambBus) return;
    if (this.running.has(name)) return;

    const ctx = this.ctx;
    const sample = this.samples.get(name);

    if (sample) {
      // Aufnahmen als Kulisse laufen in der Schleife, ein- und ausgeblendet -
      // ein harter Schnitt mitten im Waldrauschen fällt sofort auf.
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 1.5);
      g.connect(this.ambBus);
      const src = ctx.createBufferSource();
      src.buffer = sample;
      src.loop = true;
      src.connect(g);
      src.start();
      this.running.set(name, () => {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 0.8);
        setTimeout(() => {
          try { src.stop(); } catch { /* schon gestoppt */ }
          g.disconnect();
        }, 1000);
      });
      return;
    }

    if (!SYNTHESE) {
      this.missing.add(name);
      return;
    }

    const recipe = AMB[name];
    if (!recipe) {
      console.warn(`[audio] Unbekannte Atmosphäre: ${name}`);
      return;
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(this.ambBus);
    const stop = recipe(ctx, g);
    this.running.set(name, () => {
      stop();
      setTimeout(() => g.disconnect(), 1500);
    });
  }

  stopAmbient(name: string): void {
    const stop = this.running.get(name);
    if (stop) {
      stop();
      this.running.delete(name);
    }
  }

  stopAllAmbient(): void {
    for (const name of [...this.running.keys()]) this.stopAmbient(name);
  }

  /** Beim Verlassen des Lese-Screens. */
  dispose(): void {
    this.stopMusic();
    this.stopAllAmbient();
    if (this.ctx) {
      const ctx = this.ctx;
      setTimeout(() => { void ctx.close(); }, 1500);
      this.ctx = null;
      this.master = null;
      this.ambBus = null;
      this.sfxBus = null;
      this.samples.clear();
    }
  }
}
