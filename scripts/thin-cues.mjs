/**
 * Dünnt die Klang-Marker aus.
 *
 * Die erste Fassung setzte alle achtzehn Sekunden ein Geräusch - gedacht
 * als Aufmerksamkeitshilfe für Dreijährige, tatsächlich Dauerbeschallung.
 * Readmio macht das nicht: Dort trägt die Musik, und der Ton setzt Akzente.
 *
 * Ziel: etwa ein Klang je Szene, also alle 35 bis 45 Sekunden.
 *
 * Entschieden wird nach Unverwechselbarkeit, nicht nach Reihenfolge. Ein
 * Eselschrei ist der Grund, warum man an dieser Stelle zuhört; Schritte
 * sind Füllmaterial. Im Zweifel fliegt das Füllmaterial.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Je höher, desto eher bleibt der Klang drin. */
const RANG = {
  // Tierstimmen - fast immer der Grund für die Szene
  esel: 10, hund_bellen: 10, hund_jaulen: 10, katze_miau: 10, hahn_kikeriki: 10,
  schwein_grunz: 10, kuh_muh: 10, schaf_maeh: 10, maus_piep: 10, loewe_bruell: 10,
  eule_ruf: 9, moewe: 9, wal_ruf: 10, drache_brumm: 10, frosch_quak: 10,
  wolf_knurren: 10, tier_krach: 10, gespenst_huu: 10,
  // Geschichtseigene Höhepunkte
  rakete_start: 9, bagger_motor: 9, drache_feuer: 9, donner: 9, blubbern: 8,
  schluckauf: 9, brutzeln: 8, uhr_ticken: 8, wal_ruf_x: 8, sternenfall: 8,
  // Handlung
  tuer_knarr: 6, klopfen: 6, pusten: 6, rollen: 6, knabbern: 6, hau_ruck: 6,
  wasser_platsch: 6, feuer_knistern: 6, fenster_klirr: 6, wind_boe: 5,
  lachen: 5, schnarchen: 5, gaehnen: 4,
  // Füllmaterial
  poltern: 3, plumps: 3, schritte: 2, glitzern: 2,
};

const MAX_PRO_GESCHICHTE = 7;

/*
 * Klänge, deren Wirkung am Schluss liegt. Bei Gleichstand gewinnt hier das
 * SPÄTERE Vorkommen, nicht das frühere.
 *
 * Ohne diese Regel verlor "Der süße Brei" sein Zauberwort: Das Funkeln beim
 * Erhalt des Topfes blieb stehen, das Funkeln bei "Töpfchen, steh!" flog
 * raus. Der Höhepunkt der Geschichte war stumm, der Auftakt nicht.
 */
const SPAET = new Set(['glitzern', 'sternenfall', 'tier_krach']);
const MARKER = /\{\{sfx:([a-z_]+)((?:\|[a-z]+=[-0-9.]+)*)\}\}/g;

const dir = 'content';
let vorher = 0, nachher = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const [, front, body] = text.split(/^---$/m);

  // Alle Marker mit Position einsammeln
  const treffer = [];
  let m;
  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(body)) !== null) {
    treffer.push({ name: m[1], start: m.index, ende: m.index + m[0].length, text: m[0] });
  }
  vorher += treffer.length;

  // In welchem Absatz steckt der Marker?
  const absatzGrenzen = [];
  const re = /\n\s*\n/g;
  let g;
  while ((g = re.exec(body)) !== null) absatzGrenzen.push(g.index);
  const absatzVon = (pos) => absatzGrenzen.filter((b) => b < pos).length;
  for (const t of treffer) t.absatz = absatzVon(t.start);

  const gesamtAbsaetze = absatzGrenzen.length + 1;
  // Eine Szene ist grob jeder dritte Absatz.
  const szeneVon = (a) => Math.floor(a / 3);

  const behalten = new Set();
  const proSzene = new Map();
  const zaehler = new Map();

  // Nach Rang sortiert durchgehen, Gleichstand nach Position
  const sortiert = [...treffer].sort((a, b) => {
    const rang = (RANG[b.name] ?? 5) - (RANG[a.name] ?? 5);
    if (rang !== 0) return rang;
    // Schlussakzente von hinten, alles andere von vorn
    return SPAET.has(a.name) ? b.start - a.start : a.start - b.start;
  });

  for (const t of sortiert) {
    if (behalten.size >= MAX_PRO_GESCHICHTE) break;
    const szene = szeneVon(t.absatz);
    if (proSzene.has(szene)) continue;              // eine pro Szene
    const n = zaehler.get(t.name) ?? 0;
    if (n >= 2) continue;                            // derselbe Klang höchstens zweimal
    if (n >= 1 && (RANG[t.name] ?? 5) < 8) continue; // Füllmaterial nur einmal
    behalten.add(t);
    proSzene.set(szene, t);
    zaehler.set(t.name, n + 1);
  }

  // Rückwärts entfernen, damit die Positionen gültig bleiben
  let neu = body;
  for (const t of [...treffer].sort((a, b) => b.start - a.start)) {
    if (!behalten.has(t)) neu = neu.slice(0, t.start) + neu.slice(t.ende);
  }
  nachher += behalten.size;

  writeFileSync(path, `---${front}---${neu}`, 'utf8');
  const titel = (front.match(/^title:\s*(.+)$/m)?.[1] ?? file).trim();
  const minuten = Number(front.match(/^minutes:\s*(.+)$/m)?.[1] ?? 3);
  console.log(
    `${titel.slice(0, 33).padEnd(34)} ${String(treffer.length).padStart(3)} → ${String(behalten.size).padStart(2)}` +
    `   alle ${String(Math.round(minuten * 60 / Math.max(1, behalten.size))).padStart(3)}s` +
    `   (${gesamtAbsaetze} Absätze)`,
  );
}
console.log('─'.repeat(78));
console.log(`Insgesamt ${vorher} → ${nachher} Klänge`);
