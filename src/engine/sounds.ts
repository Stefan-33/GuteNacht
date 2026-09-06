import { Ambient, Ctx, OneShot, chain, envGain, filter, lfo, noise, osc, rand } from './synth';

/**
 * Die Klangbibliothek. Jeder Eintrag baut seinen Audio-Graphen selbst auf
 * und räumt ihn selbst wieder ab.
 *
 * Sollen später echte Aufnahmen rein: einfach hier den Eintrag durch einen
 * Sample-Player ersetzen. Die Geschichten referenzieren nur den Namen.
 */

/* ------------------------------------------------------------------ */
/* Tiere                                                               */
/* ------------------------------------------------------------------ */

/** Eselschrei "I-A" - erst der helle, nasale Aufschrei, dann das Absacken. */
function bray(ctx: Ctx, dest: AudioNode, t: number, len: number): void {
  const o = osc(ctx, 'sawtooth', t, [
    [0, 185], [0.25 * len, 330], [0.32 * len, 315], [0.95 * len, 105],
  ]);
  const form = filter(ctx, 'bandpass', 1700, 4);
  form.frequency.setValueAtTime(1750, t);
  form.frequency.exponentialRampToValueAtTime(620, t + len * 0.6);
  const g = envGain(ctx, t, [
    [0, 0], [0.04, 0.85], [0.28 * len, 0.75], [0.34 * len, 0.9],
    [0.85 * len, 0.45], [len, 0],
  ]);
  chain(o, form, g, dest);
  lfo(ctx, o.frequency, 16, 14, t, t + len);
  o.start(t);
  o.stop(t + len);
}

const esel: OneShot = (ctx, dest, t) => {
  bray(ctx, dest, t, 0.95);
  bray(ctx, dest, t + 1.05, 0.8);
  return 1.95;
};

/** Hundegebell - zwei kurze, abfallende Bursts mit Rausch-Anteil. */
function woof(ctx: Ctx, dest: AudioNode, t: number, pitch: number): void {
  const o = osc(ctx, 'sawtooth', t, [[0, pitch], [0.13, pitch * 0.3]]);
  const f = filter(ctx, 'bandpass', 850, 2);
  const g = envGain(ctx, t, [[0, 0], [0.012, 1], [0.06, 0.6], [0.15, 0]]);
  chain(o, f, g, dest);
  o.start(t);
  o.stop(t + 0.16);

  const n = noise(ctx, 0.1);
  const nf = filter(ctx, 'bandpass', 1500, 1.5);
  const ng = envGain(ctx, t, [[0, 0], [0.01, 0.35], [0.09, 0]]);
  chain(n, nf, ng, dest);
  n.start(t);
};

const hundBellen: OneShot = (ctx, dest, t) => {
  woof(ctx, dest, t, 430);
  woof(ctx, dest, t + 0.26, 390);
  return 0.5;
};

/** Hundegeheul - langer, weicher Glissando-Bogen. */
const hundJaulen: OneShot = (ctx, dest, t) => {
  const len = 1.7;
  const o = osc(ctx, 'sawtooth', t, [
    [0, 230], [0.45, 415], [1.0, 400], [len, 265],
  ]);
  const f = filter(ctx, 'lowpass', 1150, 3);
  const g = envGain(ctx, t, [[0, 0], [0.18, 0.55], [1.2, 0.5], [len, 0]]);
  chain(o, f, g, dest);
  lfo(ctx, o.frequency, 5.5, 7, t, t + len);
  o.start(t);
  o.stop(t + len);
  return len;
};

/** Katzenmiau - Tonhöhe und Formant wandern gemeinsam nach oben und zurück. */
const katzeMiau: OneShot = (ctx, dest, t) => {
  const len = 0.85;
  const o = osc(ctx, 'sawtooth', t, [
    [0, 470], [0.16, 790], [0.45, 700], [len, 360],
  ]);
  const f = filter(ctx, 'bandpass', 950, 5);
  f.frequency.setValueAtTime(950, t);
  f.frequency.exponentialRampToValueAtTime(1950, t + 0.2);
  f.frequency.exponentialRampToValueAtTime(780, t + len);
  const g = envGain(ctx, t, [[0, 0], [0.07, 0.7], [0.5, 0.6], [len, 0]]);
  chain(o, f, g, dest);
  lfo(ctx, o.frequency, 11, 9, t, t + len);
  o.start(t);
  o.stop(t + len);
  return len;
};

/** Hahnenschrei - vier Stufen: ki-ke-ri-kiii. */
const hahnKikeriki: OneShot = (ctx, dest, t) => {
  const len = 1.15;
  const o = osc(ctx, 'sawtooth', t, [
    [0, 720], [0.1, 720], [0.13, 900], [0.25, 900],
    [0.28, 1280], [0.52, 1210], [0.58, 700], [len, 480],
  ]);
  const f = filter(ctx, 'bandpass', 1500, 3);
  const g = envGain(ctx, t, [
    [0, 0], [0.02, 0.7], [0.1, 0.5], [0.13, 0.75], [0.25, 0.5],
    [0.29, 0.85], [0.55, 0.7], [0.6, 0.6], [len, 0],
  ]);
  chain(o, f, g, dest);
  lfo(ctx, o.frequency, 22, 18, t, t + len);
  o.start(t);
  o.stop(t + len);

  const n = noise(ctx, len);
  const nf = filter(ctx, 'bandpass', 2600, 2);
  const ng = envGain(ctx, t, [[0, 0], [0.03, 0.18], [0.6, 0.1], [len, 0]]);
  chain(n, nf, ng, dest);
  n.start(t);
  return len;
};

/** Alle vier gleichzeitig - der große Auftritt der Stadtmusikanten. */
const tierKrach: OneShot = (ctx, dest, t) => {
  esel(ctx, dest, t);
  hundBellen(ctx, dest, t + 0.15);
  hundBellen(ctx, dest, t + 0.9);
  katzeMiau(ctx, dest, t + 0.35);
  katzeMiau(ctx, dest, t + 1.3);
  hahnKikeriki(ctx, dest, t + 0.6);
  hahnKikeriki(ctx, dest, t + 1.6);
  return 2.9;
};

/* ------------------------------------------------------------------ */
/* Geräusche                                                           */
/* ------------------------------------------------------------------ */

/** Klirrendes Glas - Rauschstoß plus ein paar hohe Splitter. */
const fensterKlirr: OneShot = (ctx, dest, t) => {
  const n = noise(ctx, 0.5);
  const hp = filter(ctx, 'highpass', 2600, 1);
  const g = envGain(ctx, t, [[0, 0], [0.005, 0.8], [0.12, 0.25], [0.5, 0]]);
  chain(n, hp, g, dest);
  n.start(t);

  for (let i = 0; i < 6; i++) {
    const at = t + rand(0.02, 0.4);
    const f = rand(2200, 6800);
    const o = osc(ctx, 'sine', at, [[0, f], [0.12, f * 0.85]]);
    const og = envGain(ctx, at, [[0, 0], [0.004, rand(0.15, 0.4)], [0.14, 0]]);
    chain(o, og, dest);
    o.start(at);
    o.stop(at + 0.15);
  }
  return 0.6;
};

/** Knarrende Tür - schmalbandiges Rauschen, das sich langsam hochschiebt. */
const tuerKnarr: OneShot = (ctx, dest, t) => {
  const len = 1.5;
  const n = noise(ctx, len, 0.2);
  const bp = filter(ctx, 'bandpass', 380, 22);
  bp.frequency.setValueAtTime(360, t);
  bp.frequency.exponentialRampToValueAtTime(880, t + len * 0.8);
  const g = envGain(ctx, t, [[0, 0], [0.1, 0.5], [1.0, 0.45], [len, 0]]);
  chain(n, bp, g, dest);
  lfo(ctx, g.gain, 7, 0.18, t, t + len);
  n.start(t);
  return len;
};

/** Schritte - vier dumpfe Tritte. */
const schritte: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 4; i++) {
    const at = t + i * 0.36;
    const n = noise(ctx, 0.15, 0.6);
    const lp = filter(ctx, 'lowpass', 240, 1);
    const g = envGain(ctx, at, [[0, 0], [0.008, 0.6], [0.13, 0]]);
    chain(n, lp, g, dest);
    n.start(at);

    const o = osc(ctx, 'sine', at, [[0, 85], [0.1, 55]]);
    const og = envGain(ctx, at, [[0, 0], [0.006, 0.5], [0.11, 0]]);
    chain(o, og, dest);
    o.start(at);
    o.stop(at + 0.12);
  }
  return 1.5;
};

/** Poltern und Krachen - wenn die Räuber die Treppe hinunterstürzen. */
const poltern: OneShot = (ctx, dest, t) => {
  const n = noise(ctx, 1.0, 0.5);
  const lp = filter(ctx, 'lowpass', 420, 1);
  const g = envGain(ctx, t, [[0, 0], [0.02, 0.6], [0.5, 0.3], [1.0, 0]]);
  chain(n, lp, g, dest);
  n.start(t);

  for (let i = 0; i < 5; i++) {
    const at = t + rand(0.05, 0.85);
    const o = osc(ctx, 'triangle', at, [[0, rand(90, 170)], [0.16, 45]]);
    const og = envGain(ctx, at, [[0, 0], [0.006, rand(0.3, 0.6)], [0.18, 0]]);
    chain(o, og, dest);
    o.start(at);
    o.stop(at + 0.2);
  }
  return 1.2;
};

/** Schnarchen - zwei Atemzüge. */
const schnarchen: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 2; i++) {
    const at = t + i * 1.5;
    const n = noise(ctx, 1.2, 0.75);
    const bp = filter(ctx, 'bandpass', 260, 6);
    const g = envGain(ctx, at, [[0, 0], [0.35, 0.5], [0.7, 0.45], [1.2, 0]]);
    chain(n, bp, g, dest);
    lfo(ctx, g.gain, 24, 0.14, at, at + 1.2);
    n.start(at);
  }
  return 2.7;
};

/** Sanftes Glitzern - Übergang, Zauber, "und dann war alles gut". */
const glitzern: OneShot = (ctx, dest, t) => {
  const notes = [784, 988, 1175, 1568];
  notes.forEach((f, i) => {
    const at = t + i * 0.11;
    const o = osc(ctx, 'sine', at, [[0, f], [0.5, f]]);
    const g = envGain(ctx, at, [[0, 0], [0.01, 0.28], [0.5, 0]]);
    chain(o, g, dest);
    o.start(at);
    o.stop(at + 0.55);
  });
  return 1.0;
};

/* ------------------------------------------------------------------ */
/* Atmosphären                                                         */
/* ------------------------------------------------------------------ */

/** Grundschicht Wind - dunkles Rauschen mit wanderndem Tiefpass. */
function windLayer(ctx: Ctx, dest: AudioNode, cutoff: number, level: number): () => void {
  const n = noise(ctx, 4, 0.86);
  n.loop = true;
  const lp = filter(ctx, 'lowpass', cutoff, 1.2);
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.5);
  chain(n, lp, g, dest);
  lfo(ctx, lp.frequency, 0.07, cutoff * 0.45, ctx.currentTime, ctx.currentTime + 3600);
  lfo(ctx, g.gain, 0.11, level * 0.35, ctx.currentTime, ctx.currentTime + 3600);
  n.start();
  return () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 0.8);
    setTimeout(() => { try { n.stop(); } catch { /* schon gestoppt */ } }, 1000);
  };
}

/** Wiederkehrendes Zufallsereignis, z. B. ein Vogel alle paar Sekunden. */
function every(minMs: number, maxMs: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    fn();
    timer = setTimeout(tick, rand(minMs, maxMs));
  };
  timer = setTimeout(tick, rand(minMs, maxMs));
  return () => clearTimeout(timer);
}

function chirp(ctx: Ctx, dest: AudioNode): void {
  const t = ctx.currentTime + 0.02;
  const n = Math.floor(rand(2, 5));
  for (let i = 0; i < n; i++) {
    const at = t + i * 0.09;
    const base = rand(2600, 3900);
    const o = osc(ctx, 'sine', at, [[0, base], [0.03, base * 1.35], [0.07, base * 0.9]]);
    const g = envGain(ctx, at, [[0, 0], [0.008, 0.1], [0.075, 0]]);
    chain(o, g, dest);
    o.start(at);
    o.stop(at + 0.09);
  }
}

function hoot(ctx: Ctx, dest: AudioNode): void {
  const t = ctx.currentTime + 0.02;
  for (let i = 0; i < 2; i++) {
    const at = t + i * 0.55;
    const o = osc(ctx, 'sine', at, [[0, 395], [0.1, 370], [0.4, 355]]);
    const g = envGain(ctx, at, [[0, 0], [0.09, 0.13], [0.42, 0]]);
    chain(o, g, dest);
    lfo(ctx, o.frequency, 6, 4, at, at + 0.45);
    o.start(at);
    o.stop(at + 0.45);
  }
}

function cricket(ctx: Ctx, dest: AudioNode): void {
  const t = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const at = t + i * 0.13;
    const n = noise(ctx, 0.04);
    const bp = filter(ctx, 'bandpass', 4700, 30);
    const g = envGain(ctx, at, [[0, 0], [0.004, 0.07], [0.035, 0]]);
    chain(n, bp, g, dest);
    n.start(at);
  }
}

const bauernhof: Ambient = (ctx, dest) => {
  const stopWind = windLayer(ctx, dest, 480, 0.16);
  const stopBirds = every(3500, 9000, () => chirp(ctx, dest));
  return () => { stopWind(); stopBirds(); };
};

const waldNacht: Ambient = (ctx, dest) => {
  const stopWind = windLayer(ctx, dest, 320, 0.2);
  const stopOwl = every(9000, 20000, () => hoot(ctx, dest));
  const stopCrickets = every(1800, 4500, () => cricket(ctx, dest));
  return () => { stopWind(); stopOwl(); stopCrickets(); };
};

const stube: Ambient = (ctx, dest) => {
  const stopWind = windLayer(ctx, dest, 220, 0.12);
  return () => stopWind();
};

/* ------------------------------------------------------------------ */

export const SFX: Record<string, OneShot> = {
  esel,
  hund_bellen: hundBellen,
  hund_jaulen: hundJaulen,
  katze_miau: katzeMiau,
  hahn_kikeriki: hahnKikeriki,
  tier_krach: tierKrach,
  fenster_klirr: fensterKlirr,
  tuer_knarr: tuerKnarr,
  schritte,
  poltern,
  schnarchen,
  glitzern,
};

export const AMB: Record<string, Ambient> = {
  bauernhof,
  wald_nacht: waldNacht,
  stube,
};
