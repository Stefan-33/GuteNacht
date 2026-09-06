import { codeSimilarity, cologne } from './phonetics';
import { isStopword } from './tokenize';

/**
 * Der Aligner beantwortet genau eine Frage: WO im bekannten Text ist der
 * Vorleser gerade?
 *
 * Bewusst KEIN freies Transkript-Matching. Wir kennen den Text, also
 * vergleichen wir nur gegen ein schmales Fenster ab der aktuellen
 * Position. Das ist um Größenordnungen robuster als "suche das Wort
 * 'Wolf' irgendwo im Transkript" und verzeiht Nuscheln, dazwischen-
 * quatschende Kinder und übersprungene Sätze.
 *
 * Verfahren: Abstimmung. Jedes gehörte Wort stimmt für die Endposition ab,
 * die sich ergäbe, wenn es auf ein bestimmtes Textwort passt. Der Peak
 * gewinnt. Dadurch kippt die Positionsbestimmung nicht, wenn der Erkenner
 * ein Wort verschluckt oder eins dazu erfindet - das verschiebt nur eine
 * einzelne Stimme, nicht das Ergebnis.
 *
 * Zwei Lehren aus der Simulation (test/simulate.ts), die hier fest verbaut sind:
 *
 * 1. Eine gleichbleibende Position ist KEIN Fehlschlag. Die Spracherkennung
 *    liefert wachsende Zwischenergebnisse, da steht die Position naturgemäß
 *    oft still. Wer das als Fehlschlag zählt, treibt den Aligner grundlos in
 *    die globale Suche.
 * 2. Ein normierter Prozentwert allein reicht nicht als Kriterium. Ein
 *    einzelnes gehörtes Wort ergibt 100 % Übereinstimmung und ist trotzdem
 *    wertlos. Es zählt die absolute Beweismenge - und bei weiten Sprüngen
 *    zusätzlich der Abstand zum zweitbesten Kandidaten.
 */

export interface AlignerOptions {
  /** Suchfenster in Tokens ab aktueller Position. */
  window: number;
  /** Maximales Fenster, wenn nichts mehr passt. */
  maxWindow: number;
  /** Wieviele der zuletzt gehörten Wörter zur Abstimmung antreten. */
  tailLength: number;
  /** Mindest-Übereinstimmung (0-1) für einen normalen Schritt nach vorn. */
  minScore: number;
  /** Mindest-Beweismenge für einen normalen Schritt (Summe aus Gewicht x Ähnlichkeit). */
  minEvidence: number;
  /** Nach wievielen echten Fehlschlägen global gesucht wird. */
  lostAfter: number;
}

const DEFAULTS: AlignerOptions = {
  window: 28,
  maxWindow: 90,
  tailLength: 7,
  minScore: 0.42,
  minEvidence: 1,
  lostAfter: 8,
};

/** Anforderungen an einen Sprung, der weit weg oder rückwärts geht. */
const RISKY = {
  minScore: 0.7,
  /** Mindestens zwei bis drei übereinstimmende Inhaltswörter. */
  minEvidence: 2.4,
  /** Wieviel besser der Treffer als der zweitbeste Kandidat sein muss. */
  minMargin: 1.4,
};

export interface AlignResult {
  /** Neue Leseposition (Index des nächsten noch nicht gelesenen Tokens). */
  position: number;
  /** true, wenn sich die Position durch diesen Aufruf verändert hat. */
  moved: boolean;
  /** true, wenn rückwärts gesprungen wurde (Vorleser liest noch mal). */
  jumpedBack: boolean;
  /** Güte des besten Treffers, für die Anzeige. */
  confidence: number;
}

/** Wie stark ein Wort bei der Abstimmung zählt. */
function weightOf(token: string): number {
  if (isStopword(token)) return 0.3;
  if (token.length <= 3) return 0.55;
  if (token.length <= 5) return 0.85;
  return 1;
}

/** Ähnlichkeit zweier Wörter: exakt > Wortstamm > phonetisch. */
function similarity(a: string, aCode: string, b: string, bCode: string): number {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    return 0.9; // Flexion: "lief" / "liefen", "Esel" / "Esels"
  }
  return codeSimilarity(aCode, bCode) * 0.95;
}

export class Aligner {
  private readonly tokens: string[];
  private readonly codes: string[];
  private readonly opts: AlignerOptions;

  /** Aktuelle Leseposition. */
  position = 0;
  /** Echte Fehlschläge in Folge - steuert Fenstervergrößerung und globale Suche. */
  private misses = 0;
  private lastConfidence = 0;

  constructor(tokens: string[], codes: string[], opts: Partial<AlignerOptions> = {}) {
    this.tokens = tokens;
    this.codes = codes.length === tokens.length ? codes : tokens.map(cologne);
    this.opts = { ...DEFAULTS, ...opts };
  }

  get confidence(): number {
    return this.lastConfidence;
  }

  /** Manuell springen - z. B. wenn der Vorleser im Text auf ein Wort tippt. */
  jumpTo(position: number): void {
    this.position = Math.max(0, Math.min(position, this.tokens.length));
    this.misses = 0;
  }

  reset(): void {
    this.position = 0;
    this.misses = 0;
    this.lastConfidence = 0;
  }

  /**
   * Füttert die zuletzt gehörten Wörter ein und aktualisiert die Position.
   * Darf beliebig oft mit überlappenden Hypothesen aufgerufen werden.
   */
  feed(heard: string[]): AlignResult {
    const stay = (confidence: number): AlignResult => ({
      position: this.position,
      moved: false,
      jumpedBack: false,
      confidence,
    });

    const tail = heard.slice(-this.opts.tailLength);
    if (tail.length === 0) return stay(0);

    // Erst nach mehreren echten Fehlschlägen wird global gesucht - der
    // Vorleser hat dann vermutlich geblättert oder eine Seite übersprungen.
    const lost = this.misses >= this.opts.lostAfter;
    const grow = Math.min(
      this.opts.window * (1 + Math.min(this.misses, 3)),
      this.opts.maxWindow,
    );
    const from = lost ? 0 : this.position;
    const to = lost ? this.tokens.length : Math.min(this.position + grow, this.tokens.length);

    const heardCodes = tail.map(cologne);
    const votes = new Map<number, number>();
    let totalWeight = 0;

    for (let k = 0; k < tail.length; k++) {
      // k = 0 ist das zuletzt gehörte Wort, k wächst rückwärts durch den Tail.
      const idx = tail.length - 1 - k;
      const word = tail[idx];
      const code = heardCodes[idx];
      const w = weightOf(word);
      totalWeight += w;

      for (let j = from; j < to; j++) {
        const s = similarity(word, code, this.tokens[j], this.codes[j]);
        if (s < 0.6) continue;
        // Passt dieses Wort auf Textposition j, dann endet das Gehörte bei j+1+k.
        const q = j + 1 + k;
        if (q > this.tokens.length) continue;
        votes.set(q, (votes.get(q) ?? 0) + w * s);
      }
    }

    let bestQ = -1;
    let bestScore = 0;
    for (const [q, score] of votes) {
      if (score > bestScore) {
        bestScore = score;
        bestQ = q;
      }
    }

    if (bestQ < 0) {
      this.misses++;
      this.lastConfidence = 0;
      return stay(0);
    }

    // Zweitbester Kandidat, der nicht direkt neben dem Sieger liegt.
    // Ein knappes Rennen bedeutet: der Text ist an dieser Stelle mehrdeutig.
    let rival = 0;
    for (const [q, score] of votes) {
      if (Math.abs(q - bestQ) > 3 && score > rival) rival = score;
    }

    const confidence = totalWeight > 0 ? bestScore / totalWeight : 0;
    this.lastConfidence = confidence;

    const backward = bestQ < this.position;
    const far = bestQ > this.position + this.opts.window + tail.length;
    const risky = backward || far || lost;

    /*
     * Beweislast waechst mit der Sprungweite. Der Gedanke dahinter: wenn der
     * Erkenner sieben Woerter gemeldet hat, kann der Vorleser nicht vierzig
     * Woerter weiter sein. Alles, was ueber die Laenge des Gehoerten
     * hinausgeht, ist unerklaerter Vorsprung - und den muss der Treffer sich
     * mit zusaetzlichen uebereinstimmenden Woertern verdienen.
     *
     * Ohne diese Regel reicht ein einziges zufaellig passendes Wort am
     * Fensterrand fuer einen Sprung um dreissig Woerter, und die Geraeusche
     * der halben Geschichte feuern auf einen Schlag.
     */
    const stretch = Math.max(0, bestQ - this.position - tail.length);
    const needScore = risky ? RISKY.minScore : this.opts.minScore;
    const needEvidence = risky
      ? RISKY.minEvidence
      : this.opts.minEvidence + stretch * 0.12;
    const needMargin = risky ? RISKY.minMargin : stretch > 4 ? 1.25 : 0;

    const accepted =
      bestQ !== this.position &&
      confidence >= needScore &&
      bestScore >= needEvidence &&
      (needMargin === 0 || rival === 0 || bestScore >= rival * needMargin);

    if (accepted) {
      const jumpedBack = backward;
      this.position = bestQ;
      this.misses = 0;
      return { position: bestQ, moved: true, jumpedBack, confidence };
    }

    // Kein Schritt - aber verloren sind wir nur, wenn auch die aktuelle
    // Position nicht mehr plausibel bestätigt wird.
    const stillOnTrack =
      Math.abs(bestQ - this.position) <= this.opts.window &&
      confidence >= this.opts.minScore &&
      bestScore >= this.opts.minEvidence;
    if (stillOnTrack) this.misses = 0;
    else this.misses++;

    return stay(confidence);
  }
}
