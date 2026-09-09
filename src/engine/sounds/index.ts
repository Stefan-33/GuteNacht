import type { Ctx, OneShot } from '../synth';
import * as v from './voices';
import * as n from './noises';

export { AMB } from './ambience';

/** Alle vier Stadtmusikanten gleichzeitig - der große Auftritt. */
const tierKrach: OneShot = (ctx: Ctx, dest: AudioNode, t: number) => {
  // Sieben Stimmen übereinander erreichten gemessen Vollausschlag und
  // knackten hörbar. Also erst auf einen eigenen Bus, dann gedämpft weiter.
  const bus = ctx.createGain();
  bus.gain.value = 0.42;
  bus.connect(dest);
  v.esel(ctx, bus, t);
  v.hundBellen(ctx, bus, t + 0.15);
  v.hundBellen(ctx, bus, t + 1.0);
  v.katzeMiau(ctx, bus, t + 0.4);
  v.katzeMiau(ctx, bus, t + 1.45);
  v.hahnKikeriki(ctx, bus, t + 0.65);
  v.hahnKikeriki(ctx, bus, t + 1.75);
  setTimeout(() => bus.disconnect(), 6000);
  return 3.1;
};

/**
 * Die Klangbibliothek.
 *
 * Sollen echte Aufnahmen an die Stelle eines synthetischen Klangs treten:
 * Datei als public/sfx/<name>.mp3 ablegen, `npm run content` laufen lassen.
 * Die Audio-Engine bevorzugt dann automatisch die Aufnahme. Die Geschichten
 * referenzieren nur den Namen und müssen nie angefasst werden.
 */
export const SFX: Record<string, OneShot> = {
  // Bauernhof
  esel: v.esel,
  hund_bellen: v.hundBellen,
  hund_jaulen: v.hundJaulen,
  katze_miau: v.katzeMiau,
  hahn_kikeriki: v.hahnKikeriki,
  schwein_grunz: v.schweinGrunz,
  kuh_muh: v.kuhMuh,
  schaf_maeh: v.schafMaeh,
  tier_krach: tierKrach,

  // Wild und Fantasie
  maus_piep: v.mausPiep,
  loewe_bruell: v.loeweBruell,
  drache_brumm: v.dracheBrumm,
  eule_ruf: v.euleRuf,
  moewe: v.moewe,
  wal_ruf: v.walRuf,

  // Menschliche Laute
  gaehnen: v.gaehnen,
  hau_ruck: v.hauRuck,
  schluckauf: v.schluckauf,
  schnarchen: n.schnarchen,

  // Haus und Dinge
  schritte: n.schritte,
  poltern: n.poltern,
  klopfen: n.klopfen,
  plumps: n.plumps,
  tuer_knarr: n.tuerKnarr,
  fenster_klirr: n.fensterKlirr,
  uhr_ticken: n.uhrTicken,
  knabbern: n.knabbern,
  rollen: n.rollen,

  // Küche und Feuer
  blubbern: n.blubbern,
  brutzeln: n.brutzeln,
  feuer_knistern: n.feuerKnistern,

  // Wetter, Wasser, Himmel
  donner: n.donner,
  wind_boe: n.windBoe,
  pusten: n.pusten,
  wasser_platsch: n.wasserPlatsch,
  sternenfall: n.sternenfall,
  glitzern: n.glitzern,

  // Maschinen
  bagger_motor: n.baggerMotor,
  rakete_start: n.raketeStart,
  drache_feuer: n.dracheFeuer,
};

/*
 * Pegelabgleich.
 *
 * Diese Zahlen sind NICHT nach Gefühl gesetzt, sondern von
 * test/render-sounds.mjs ausgerechnet: Das Skript rendert jeden Klang in
 * echtem Chromium offline, misst die Spitzenaussteuerung und leitet daraus
 * den Faktor auf einen gemeinsamen Zielpegel ab.
 *
 * Der Grund ist praktisch: Ohne Abgleich stand der Esel bei 0,89 und die
 * Katze bei 0,50 - neben dem Esel war die Katze schlicht nicht da.
 *
 * Wer eine Klangvorschrift ändert, lässt das Skript neu laufen und
 * übernimmt die Tabelle, die es ausgibt.
 */
export const TRIM: Record<string, number> = {
  esel: 0.53,
  hund_bellen: 1.01,
  hund_jaulen: 0.96,
  katze_miau: 1.31,
  hahn_kikeriki: 0.47,
  schwein_grunz: 0.63,
  kuh_muh: 0.94,
  schaf_maeh: 1.02,
  tier_krach: 0.85,
  maus_piep: 1.05,
  loewe_bruell: 0.54,
  drache_brumm: 0.51,
  eule_ruf: 1.57,
  moewe: 1.01,
  wal_ruf: 1.15,
  gaehnen: 1.82,
  hau_ruck: 0.62,
  schluckauf: 1.62,
  schnarchen: 1.63,
  schritte: 1.41,
  poltern: 1.16,
  klopfen: 1.21,
  plumps: 1.27,
  tuer_knarr: 0.97,
  fenster_klirr: 2.95,
  uhr_ticken: 8.19,
  knabbern: 8.56,
  rollen: 2.51,
  blubbern: 1.31,
  brutzeln: 2.91,
  feuer_knistern: 2.65,
  donner: 1.00,
  wind_boe: 3.80,
  pusten: 2.16,
  wasser_platsch: 1.71,
  sternenfall: 1.66,
  glitzern: 1.45,
  bagger_motor: 0.84,
  rakete_start: 1.01,
  drache_feuer: 1.14,
};

/** Faktor für einen Klang, oder 1, wenn keiner hinterlegt ist. */
export function trimOf(name: string): number {
  return TRIM[name] ?? 1;
}
