/**
 * Simuliert einen Vorleser mit realistisch fehlerhafter Spracherkennung
 * und prüft, ob die Cues an der richtigen Stelle feuern.
 *
 * Ohne so einen Test weiß man erst am schlafenden Kind, ob die Engine
 * taugt - und das ist ein teurer Testlauf.
 */
import { readFileSync } from 'node:fs';
import { compileStory, type RawStory } from '../src/engine/story';
import { ReadingSession } from '../src/engine/session';
import type { AudioEngine } from '../src/engine/audio';

const raw = JSON.parse(readFileSync('public/stories/bremer-stadtmusikanten.json', 'utf8')) as RawStory;
const story = compileStory(raw);

/* ---- Störgeräusche im Kanal ------------------------------------- */

let seed = Number(process.env.SEED ?? 42);
function rnd(): number {
  // Deterministisch, damit ein Fehlschlag reproduzierbar ist.
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

const GARBLE = Number(process.env.GARBLE ?? 0.2);

const CONFUSIONS: Record<string, string> = {
  b: 'p', p: 'b', d: 't', t: 'd', g: 'k', k: 'g',
  f: 'v', v: 'f', s: 'z', z: 's', m: 'n', n: 'm',
};

/** Verhört sich wie ein echter Erkenner: Laute verwechseln, Endungen fressen. */
function garble(word: string): string {
  const r = rnd() * (0.2 / GARBLE);
  if (r < 0.12 && word.length > 3) {
    const i = Math.floor(rnd() * word.length);
    const c = word[i];
    return word.slice(0, i) + (CONFUSIONS[c] ?? c) + word.slice(i + 1);
  }
  if (r < 0.2 && word.length > 5) return word.slice(0, -1);
  return word;
}

/* ---- Audio-Attrappe, die nur mitschreibt ------------------------ */

interface Fired { sound: string; atTruth: number }
const fired: Fired[] = [];
const ambients: string[] = [];
let truth = 0;

const fakeAudio = {
  playSfx: (sound: string) => fired.push({ sound, atTruth: truth }),
  startAmbient: (sound: string) => ambients.push(`+${sound}`),
  stopAmbient: (sound: string) => ambients.push(`-${sound}`),
  stopAllAmbient: () => {},
} as unknown as AudioEngine;

const session = new ReadingSession(story, fakeAudio);

/* ---- Der simulierte Vorlesevorgang ------------------------------ */

const DROP_RATE = Number(process.env.DROP ?? 0.08);   // Wörter, die der Erkenner komplett verschluckt
const UTTERANCE = 9;      // Wörter pro Erkennungs-Äußerung

let heardBuffer: string[] = [];

for (truth = 0; truth < story.tokens.length; truth++) {
  const word = story.tokens[truth];

  if (rnd() > DROP_RATE) {
    heardBuffer.push(garble(word));
    // Web Speech liefert wachsende Zwischenergebnisse - genau so füttern wir.
    session.feed(heardBuffer);
  }

  if (heardBuffer.length >= UTTERANCE) heardBuffer = [];
}

/* ---- Auswertung -------------------------------------------------- */

const sfxCues = story.cues.filter((c) => c.type === 'sfx');
const errors: number[] = [];
let missing = 0;
let outOfOrder = 0;
let lastTruth = -1;

const QUIET = process.env.QUIET === '1';
const log = (...a: unknown[]) => { if (!QUIET) console.log(...a); };
log(`Geschichte: ${story.title}`);
log(`${story.tokens.length} Tokens, ${sfxCues.length} Effekte, ${story.cues.length - sfxCues.length} Atmosphären-Wechsel\n`);

for (const cue of sfxCues) {
  const hit = fired.find((f) => f.sound === cue.sound && f.atTruth >= lastTruth);
  if (!hit) {
    log(`  ✗ ${cue.sound.padEnd(16)} nie ausgelöst (Soll: Token ${cue.at})`);
    missing++;
    continue;
  }
  const err = hit.atTruth - (cue.at - cue.lead);
  errors.push(err);
  if (hit.atTruth < lastTruth) outOfOrder++;
  lastTruth = hit.atTruth;
  const flag = Math.abs(err) <= 4 ? '✓' : Math.abs(err) <= 8 ? '~' : '✗';
  log(`  ${flag} ${cue.sound.padEnd(16)} Soll ${String(cue.at - cue.lead).padStart(4)}  Ist ${String(hit.atTruth).padStart(4)}  Abweichung ${err > 0 ? '+' : ''}${err} Wörter`);
}

const abs = errors.map(Math.abs);
const mean = abs.reduce((a, b) => a + b, 0) / (abs.length || 1);
const worst = Math.max(...abs, 0);
const drift = story.tokens.length - session.position;

log(`\nEndposition:        ${session.position} / ${story.tokens.length}  (Rückstand ${drift} Wörter)`);
log(`Mittlere Abweichung: ${mean.toFixed(1)} Wörter`);
log(`Schlechtester Fall:  ${worst} Wörter`);
log(`Nicht ausgelöst:     ${missing}`);
log(`Falsche Reihenfolge: ${outOfOrder}`);
log(`Atmosphären-Ablauf:  ${ambients.join(' ')}`);

// Ein Wort Abweichung sind bei ruhigem Vorlesen ungefähr 0,45 Sekunden.
const ok = missing === 0 && outOfOrder === 0 && mean <= 3 && worst <= 8 && drift <= 12;
if (QUIET) {
  console.log(`drop=${(DROP_RATE * 100).toFixed(0)}% verhoert=${(GARBLE * 100).toFixed(0)}% seed=${process.env.SEED ?? 42}  ->  Abweichung ${mean.toFixed(1)} (max ${worst}), fehlend ${missing}, verdreht ${outOfOrder}  ${ok ? 'OK' : 'FAIL'}`);
} else {
  console.log(`\n${ok ? '✓ BESTANDEN' : '✗ DURCHGEFALLEN'}`);
}
process.exit(ok ? 0 : 1);
