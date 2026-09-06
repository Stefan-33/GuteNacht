/**
 * Textnormalisierung. Vorlagetext und Spracherkennungs-Hypothese müssen
 * durch exakt dieselbe Mühle laufen, sonst vergleicht man Äpfel mit Birnen.
 */

/** Zahlwörter, weil Erkenner "7" und "sieben" beliebig ausspucken. */
const NUMBERS: Record<string, string> = {
  '0': 'null', '1': 'eins', '2': 'zwei', '3': 'drei', '4': 'vier',
  '5': 'fuenf', '6': 'sechs', '7': 'sieben', '8': 'acht', '9': 'neun',
  '10': 'zehn', '11': 'elf', '12': 'zwoelf', '13': 'dreizehn',
  '20': 'zwanzig', '100': 'hundert', '1000': 'tausend',
};

/**
 * Funktionswörter. Die zählen beim Alignment weniger, weil sie überall
 * vorkommen und deshalb Zufallstreffer produzieren - "der" matcht immer
 * irgendwo. Inhaltswörter tragen die Positionsbestimmung.
 */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
  'einer', 'eines', 'und', 'oder', 'aber', 'doch', 'denn', 'auch', 'noch',
  'nur', 'schon', 'sehr', 'so', 'wie', 'was', 'wer', 'wo', 'da', 'dann',
  'als', 'wenn', 'weil', 'dass', 'ist', 'war', 'sind', 'waren', 'hat',
  'hatte', 'sich', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'ihm',
  'ihn', 'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'mit', 'nach', 'von',
  'vom', 'zu', 'zum', 'zur', 'fuer', 'ueber', 'unter', 'vor', 'um', 'sein',
  'seine', 'ihre', 'nicht', 'kein', 'keine', 'man', 'zwar', 'ja', 'nein',
]);

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

/** Ein einzelnes Wort auf seine Vergleichsform bringen. */
export function normalizeWord(raw: string): string {
  const w = raw
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
  if (!w) return '';
  return NUMBERS[w] ?? w;
}

/**
 * Zerlegt beliebigen Text in normalisierte Tokens.
 * Bindestriche trennen (I-A -> i, a), Satzzeichen fallen weg.
 */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s ]+/)
    .flatMap((chunk) => chunk.split(/[-–—/]/))
    .map(normalizeWord)
    .filter((t) => t.length > 0);
}
