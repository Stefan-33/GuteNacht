/**
 * Kölner Phonetik.
 *
 * Warum nicht Soundex: Soundex ist für Englisch gebaut und wirft im
 * Deutschen zu viel weg. Die Kölner Phonetik bildet "Wolf" und "Golf"
 * NICHT auf denselben Code ab (357 vs. 453), aber sehr wohl "Meier",
 * "Mayer", "Maier" - und genau solche Verwechslungen liefert eine
 * Spracherkennung, wenn jemand leise vorliest.
 *
 * Zusätzlich wird der Code über die Levenshtein-Distanz verglichen und
 * nicht auf Gleichheit geprüft (siehe aligner.ts), damit auch ein
 * teilweise verstandenes Wort noch zählt.
 */

const VOWELS = new Set(['A', 'E', 'I', 'J', 'O', 'U', 'Y']);

function normalize(word: string): string {
  return word
    .toUpperCase()
    .replace(/Ä/g, 'A')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U')
    .replace(/ß/g, 'SS')
    .replace(/[^A-Z]/g, '');
}

/** Liefert den Kölner-Phonetik-Code, z. B. "WOLF" -> "357". */
export function cologne(word: string): string {
  const w = normalize(word);
  if (!w) return '';

  const codes: number[] = [];

  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const next = w[i + 1] ?? '';
    const prev = w[i - 1] ?? '';
    let code: number | null = null;

    if (VOWELS.has(c)) {
      code = 0;
    } else if (c === 'H') {
      code = null; // H bekommt nie einen Code
    } else if (c === 'B') {
      code = 1;
    } else if (c === 'P') {
      code = next === 'H' ? 3 : 1;
    } else if (c === 'D' || c === 'T') {
      code = 'CSZ'.includes(next) ? 8 : 2;
    } else if (c === 'F' || c === 'V' || c === 'W') {
      code = 3;
    } else if (c === 'G' || c === 'K' || c === 'Q') {
      code = 4;
    } else if (c === 'C') {
      if (i === 0) {
        code = 'AHKLOQRUX'.includes(next) ? 4 : 8;
      } else {
        code = 'SZ'.includes(prev) ? 8 : 'AHKOQUX'.includes(next) ? 4 : 8;
      }
    } else if (c === 'X') {
      // X nach C/K/Q ist nur noch "S", sonst "KS"
      if ('CKQ'.includes(prev)) {
        code = 8;
      } else {
        codes.push(4);
        code = 8;
      }
    } else if (c === 'L') {
      code = 5;
    } else if (c === 'M' || c === 'N') {
      code = 6;
    } else if (c === 'R') {
      code = 7;
    } else if (c === 'S' || c === 'Z') {
      code = 8;
    }

    if (code !== null) codes.push(code);
  }

  // Doppelte Codes zusammenziehen, danach alle Nullen außer der ersten streichen.
  const dedup: number[] = [];
  for (const c of codes) {
    if (dedup.length === 0 || dedup[dedup.length - 1] !== c) dedup.push(c);
  }
  const result = dedup.filter((c, i) => c !== 0 || i === 0);
  return result.join('');
}

/** Levenshtein-Distanz, klein gehalten - die Strings sind selten länger als 6 Zeichen. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

/**
 * Ähnlichkeit zweier Phonetik-Codes zwischen 0 und 1.
 * Kurze Codes sind anfälliger für Zufallstreffer, deshalb der Malus unten.
 */
export function codeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  const max = Math.max(a.length, b.length);
  const sim = 1 - dist / max;
  return max <= 2 ? sim * 0.6 : sim;
}
