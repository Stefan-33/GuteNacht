import { Ctx, filter, lfo } from './synth';

/**
 * Erzeugte Hintergrundmusik.
 *
 * Aufgabe laut Stefan: ruhig, fantasievoll, zum Runterkommen - und nicht
 * immer dieselbe Melodie. Eine gekaufte Musikdatei von drei Minuten läuft
 * bei einer Fünf-Minuten-Geschichte zwangsläufig einmal von vorn. Erzeugte
 * Musik nicht: Sie baut fortlaufend neue Phrasen und wiederholt sich nie
 * exakt.
 *
 * WARUM DAS HIER FUNKTIONIERT, TIERSTIMMEN ABER NICHT
 *
 * Ein Eselschrei ist ein Kehlkopf - da kommt Synthese nicht hin. Eine
 * weiche Klangfläche, eine Glocke, ein Harfenton sind dagegen im Kern
 * genau das, was ein Oszillator mit Hüllkurve von Natur aus macht. Hier
 * spielt die Synthese ihre Stärke aus statt ihre Schwäche.
 *
 * WARUM ES NIE FALSCH KLINGEN KANN
 *
 * Zwei Regeln, die zusammen jede Dissonanz ausschließen:
 *
 * 1. Die Akkorde sind alle leitereigen in C-Dur/a-Moll.
 * 2. Die Melodietöne stammen ausschließlich aus der a-Moll-Pentatonik -
 *    und die passt auf JEDEN dieser Akkorde. Deshalb darf der Zufall die
 *    Töne frei wählen, ohne dass je etwas schief klingt.
 *
 * Der Akkordwechsel läuft als Zufallsschritt, nicht als feste Schleife -
 * damit wiederholt sich auch die Harmonik nicht in hörbaren Runden.
 *
 * ZEITPLANUNG
 *
 * Die Musik plant ihre Ereignisse im Voraus (`scheduleUntil`), statt sie
 * über Zeitgeber abzufeuern. Das ist die übliche Web-Audio-Bauweise und
 * hat hier einen zweiten Nutzen: Dieselbe Klasse lässt sich damit offline
 * schneller als in Echtzeit rendern - sonst könnte ich keine Hörprobe
 * erzeugen, ohne drei Minuten zu warten.
 */

/** MIDI-Note zu Frequenz. */
function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Leitereigene Akkorde in a-Moll. Vier Töne, warm, ohne Spannung. */
const CHORDS: number[][] = [
  [45, 52, 60, 64], // Am7
  [41, 48, 57, 64], // Fmaj7
  [48, 55, 64, 67], // Cmaj7
  [43, 50, 59, 64], // G6
];

/** a-Moll-Pentatonik über zwei Oktaven - passt auf alle Akkorde oben. */
const MELODY = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91];

export interface MusicOptions {
  /** Grundlautstärke. Bewusst sehr niedrig - die Musik trägt, sie führt nicht. */
  gain?: number;
  /** Sekunden je Akkord. */
  chordLength?: number;
}

export class Music {
  private readonly out: GainNode;
  private readonly pad: GainNode;
  private readonly bells: GainNode;

  private chordEnd = 0;
  private chord = 0;
  private nextBell = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly chordLength: number;

  constructor(private readonly ctx: Ctx, dest: AudioNode, opts: MusicOptions = {}) {
    this.chordLength = opts.chordLength ?? 26;

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);

    // Getrennte Wege, damit die Fläche unter den Glocken bleiben kann.
    this.pad = ctx.createGain();
    this.pad.gain.value = 0.55;
    this.pad.connect(this.out);

    this.bells = ctx.createGain();
    this.bells.gain.value = 0.9;
    this.bells.connect(this.out);

    const target = opts.gain ?? 0.1;
    this.out.gain.setValueAtTime(0, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(target, ctx.currentTime + 6);
  }

  /**
   * Eine Akkordfläche. Vier Töne, leicht verstimmt gegeneinander, hinter
   * einem wandernden Tiefpass. Das Verstimmen ist der ganze Trick: Zwei
   * exakt gleiche Oszillatoren klingen tot, zwei minimal verschiedene
   * schweben.
   */
  private padVoice(notes: number[], at: number, length: number): void {
    const fade = 7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.16, at + fade);
    g.gain.setValueAtTime(0.16, at + length - fade);
    g.gain.linearRampToValueAtTime(0, at + length);

    const lp = filter(this.ctx, 'lowpass', 620, 1.4);
    lfo(this.ctx, lp.frequency, 0.045, 260, at, at + length);
    g.connect(this.pad);
    lp.connect(g);

    for (const note of notes) {
      for (const detune of [-4, 4]) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq(note);
        o.detune.value = detune;
        o.connect(lp);
        o.start(at);
        o.stop(at + length + 0.1);
      }
    }

    // Sehr tiefer Grundton darunter - gibt Wärme, ohne aufzufallen.
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq(notes[0] - 12);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0, at);
    sg.gain.linearRampToValueAtTime(0.1, at + fade);
    sg.gain.setValueAtTime(0.1, at + length - fade);
    sg.gain.linearRampToValueAtTime(0, at + length);
    sub.connect(sg).connect(this.pad);
    sub.start(at);
    sub.stop(at + length + 0.1);
  }

  /**
   * Ein einzelner Glockenton. Grundton plus Oktave plus Duodezime, jeweils
   * mit eigener Abklingzeit - die höheren Teiltöne verschwinden zuerst,
   * genau wie bei einer echten Glocke.
   */
  private bell(note: number, at: number, level: number): void {
    const partials: [number, number, number][] = [
      [1, 1, 4.5],    // Grundton, langes Ausklingen
      [2, 0.35, 2.6], // Oktave
      [3, 0.14, 1.6], // Duodezime
    ];
    for (const [ratio, amp, decay] of partials) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq(note) * ratio;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(level * amp, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      o.connect(g).connect(this.bells);
      o.start(at);
      o.stop(at + decay + 0.1);
    }
  }

  /**
   * Plant alle Ereignisse bis zum angegebenen Zeitpunkt. Mehrfach
   * aufrufbar; es wird nur ergänzt, was noch fehlt.
   */
  scheduleUntil(until: number): void {
    if (this.chordEnd === 0) {
      this.chordEnd = this.ctx.currentTime;
      this.nextBell = this.ctx.currentTime + 3;
    }

    while (this.chordEnd < until) {
      // Zufallsschritt statt fester Schleife - aber nie zweimal derselbe
      // Akkord hintereinander, das klänge nach Stillstand.
      let next = Math.floor(Math.random() * CHORDS.length);
      if (next === this.chord) next = (next + 1) % CHORDS.length;
      this.chord = next;
      this.padVoice(CHORDS[this.chord], this.chordEnd, this.chordLength + 7);
      this.chordEnd += this.chordLength;
    }

    while (this.nextBell < until) {
      const note = MELODY[Math.floor(Math.random() * MELODY.length)];
      this.bell(note, this.nextBell, 0.12 + Math.random() * 0.1);

      // Gelegentlich ein zweiter Ton dicht dahinter - das ergibt kleine
      // Gesten statt gleichmäßigem Tropfen.
      if (Math.random() < 0.35) {
        const second = MELODY[Math.floor(Math.random() * MELODY.length)];
        this.bell(second, this.nextBell + 0.4 + Math.random() * 0.5, 0.08);
      }

      this.nextBell += 2.5 + Math.random() * 4.5;
    }
  }

  /** Startet die laufende Vorausplanung. */
  start(): void {
    this.scheduleUntil(this.ctx.currentTime + 8);
    this.timer = setInterval(() => {
      this.scheduleUntil(this.ctx.currentTime + 8);
    }, 3000);
  }

  /**
   * Musik zurücknehmen, solange gesprochen wird.
   *
   * Zwei Gründe: Die Stimme soll vorn stehen, und je weniger Musik über
   * den Lautsprecher läuft, desto weniger davon landet wieder im Mikrofon
   * und stört die Spracherkennung.
   */
  duck(active: boolean, base = 0.1): void {
    const now = this.ctx.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(active ? base * 0.45 : base, now + 1.2);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + 3);
  }
}
