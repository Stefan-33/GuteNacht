import { Ctx, OneShot, chain, envGain, filter, lfo, noise, osc, rand } from '../synth';

/**
 * Alles ohne Stimme: Aufschläge, Wetter, Wasser, Maschinen.
 *
 * Grundprinzip: Rauschen durch Filter. Was ein Geräusch ausmacht, ist
 * fast immer die Hüllkurve und die Filterbewegung, nicht der Klang selbst -
 * derselbe Rauschgenerator wird zu Regen, Feuer oder einem Motor, je
 * nachdem wie man ihn formt.
 */

/* ---------------- Bausteine ---------------------------------------- */

/** Dumpfer Aufschlag: Rauschstoß plus tiefer Sinus als Körper. */
function thump(ctx: Ctx, dest: AudioNode, t: number, pitch: number, level: number, len = 0.16): void {
  const n = noise(ctx, len, 0.6);
  const lp = filter(ctx, 'lowpass', 260, 1);
  const g = envGain(ctx, t, [[0, 0], [0.008, level], [len, 0]]);
  chain(n, lp, g, dest);
  n.start(t);

  const o = osc(ctx, 'sine', t, [[0, pitch], [len * 0.7, pitch * 0.6]]);
  const og = envGain(ctx, t, [[0, 0], [0.006, level * 0.85], [len * 0.8, 0]]);
  chain(o, og, dest);
  o.start(t);
  o.stop(t + len);
}

/** Kurzer heller Klick - Uhrwerk, Knabbern, Zweig. */
function click(ctx: Ctx, dest: AudioNode, t: number, freq: number, level: number, len = 0.03): void {
  const n = noise(ctx, len);
  const bp = filter(ctx, 'bandpass', freq, 6);
  const g = envGain(ctx, t, [[0, 0], [0.002, level], [len, 0]]);
  chain(n, bp, g, dest);
  n.start(t);
}

/** Luftstoß: Rauschen, das an- und wieder abschwillt. */
function whoosh(ctx: Ctx, dest: AudioNode, t: number, len: number, from: number, to: number, level: number): void {
  const n = noise(ctx, len + 0.1, 0.35);
  const bp = filter(ctx, 'bandpass', from, 0.9);
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = envGain(ctx, t, [[0, 0], [len * 0.3, level], [len * 0.6, level * 0.8], [len, 0]]);
  chain(n, bp, g, dest);
  n.start(t);
}

/** Einzelne Wasserblase: winziger Sinus, dessen Tonhöhe blitzschnell steigt. */
function bubble(ctx: Ctx, dest: AudioNode, t: number, base: number, level: number): void {
  const len = 0.07;
  const o = osc(ctx, 'sine', t, [[0, base], [len, base * 2.4]]);
  const g = envGain(ctx, t, [[0, 0], [0.004, level], [len, 0]]);
  chain(o, g, dest);
  o.start(t);
  o.stop(t + len + 0.01);
}

/* ---------------- Haus und Dinge ----------------------------------- */

export const schritte: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 4; i++) thump(ctx, dest, t + i * 0.36, 85, 0.6);
  return 1.5;
};

export const poltern: OneShot = (ctx, dest, t) => {
  const n = noise(ctx, 1.0, 0.5);
  const lp = filter(ctx, 'lowpass', 420, 1);
  const g = envGain(ctx, t, [[0, 0], [0.02, 0.6], [0.5, 0.3], [1.0, 0]]);
  chain(n, lp, g, dest);
  n.start(t);
  for (let i = 0; i < 5; i++) thump(ctx, dest, t + rand(0.05, 0.85), rand(90, 170), rand(0.3, 0.6), 0.2);
  return 1.2;
};

/** Klopfen an der Tür: drei Schläge auf einen resonierenden Holzkörper. */
export const klopfen: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 3; i++) {
    const at = t + i * 0.28;
    thump(ctx, dest, at, 150, 0.55, 0.12);
    const body = osc(ctx, 'triangle', at, [[0, 220], [0.18, 190]]);
    const bg = envGain(ctx, at, [[0, 0], [0.005, 0.35], [0.18, 0]]);
    chain(body, bg, dest);
    body.start(at);
    body.stop(at + 0.2);
  }
  return 0.95;
};

export const plumps: OneShot = (ctx, dest, t) => {
  thump(ctx, dest, t, 120, 0.8, 0.3);
  return 0.4;
};

/**
 * Knarrende Tür. Güte 8, nicht 22: die erste Fassung filterte so schmal,
 * dass vom Signal nichts übrig blieb - gemessene Spitze 0,06, also unhörbar.
 */
export const tuerKnarr: OneShot = (ctx, dest, t) => {
  const len = 1.5;
  const n = noise(ctx, len, 0.2);
  const bp = filter(ctx, 'bandpass', 380, 8);
  bp.frequency.setValueAtTime(360, t);
  bp.frequency.exponentialRampToValueAtTime(880, t + len * 0.8);
  const squeak = filter(ctx, 'bandpass', 1400, 14);
  squeak.frequency.setValueAtTime(1300, t);
  squeak.frequency.exponentialRampToValueAtTime(2100, t + len * 0.8);
  const sq = ctx.createGain();
  sq.gain.value = 0.5;
  const g = envGain(ctx, t, [[0, 0], [0.1, 3.2], [1.0, 2.9], [len, 0]]);
  chain(n, bp, g, dest);
  chain(n, squeak, sq, g);
  lfo(ctx, g.gain, 7, 1.1, t, t + len);
  n.start(t);
  return len;
};

/** Klirrendes Glas. Bandpass statt Hochpass - vorher lag der Schwerpunkt
 *  bei 11,5 kHz und war im dunklen Kinderzimmer schlicht schrill. */
export const fensterKlirr: OneShot = (ctx, dest, t) => {
  const n = noise(ctx, 0.5);
  const hp = filter(ctx, 'bandpass', 3200, 0.8);
  const g = envGain(ctx, t, [[0, 0], [0.005, 0.45], [0.12, 0.14], [0.5, 0]]);
  chain(n, hp, g, dest);
  n.start(t);
  for (let i = 0; i < 6; i++) {
    const at = t + rand(0.02, 0.4);
    const f = rand(1800, 4600);
    const o = osc(ctx, 'sine', at, [[0, f], [0.12, f * 0.85]]);
    const og = envGain(ctx, at, [[0, 0], [0.004, rand(0.08, 0.2)], [0.14, 0]]);
    chain(o, og, dest);
    o.start(at);
    o.stop(at + 0.15);
  }
  return 0.6;
};

/** Standuhr. Zwei unterschiedliche Klicks, damit es tickt statt piept. */
export const uhrTicken: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 6; i++) {
    click(ctx, dest, t + i * 0.5, i % 2 === 0 ? 2600 : 2000, 0.5, 0.025);
  }
  return 3.1;
};

/** Knabbern. Viele winzige Klicks in unregelmäßigem Abstand. */
export const knabbern: OneShot = (ctx, dest, t) => {
  let at = t;
  for (let i = 0; i < 22; i++) {
    click(ctx, dest, at, rand(1800, 3400), rand(0.25, 0.5), 0.018);
    at += rand(0.04, 0.09);
  }
  return at - t + 0.1;
};

/** Rollen. Rauschen mit rhythmischer Amplitude - ein Gegenstand kullert. */
export const rollen: OneShot = (ctx, dest, t) => {
  const len = 1.6;
  const n = noise(ctx, len, 0.55);
  const bp = filter(ctx, 'bandpass', 300, 1.4);
  bp.frequency.setValueAtTime(260, t);
  bp.frequency.linearRampToValueAtTime(420, t + len);
  const g = envGain(ctx, t, [[0, 0], [0.12, 0.65], [1.1, 0.5], [len, 0]]);
  chain(n, bp, g, dest);
  lfo(ctx, g.gain, 7.5, 0.28, t, t + len);
  n.start(t);
  return len;
};

/* ---------------- Küche und Feuer ---------------------------------- */

/** Blubbernder Brei. Blasen in dichter Folge über einem leisen Zischen. */
export const blubbern: OneShot = (ctx, dest, t) => {
  const len = 2.2;
  const n = noise(ctx, len, 0.5);
  const lp = filter(ctx, 'lowpass', 700, 1);
  const g = envGain(ctx, t, [[0, 0], [0.15, 0.18], [1.8, 0.14], [len, 0]]);
  chain(n, lp, g, dest);
  n.start(t);

  let at = t + 0.05;
  while (at < t + len - 0.15) {
    bubble(ctx, dest, at, rand(180, 520), rand(0.25, 0.6));
    at += rand(0.05, 0.16);
  }
  return len;
};

/** Brutzeln in der Pfanne: hohes, dichtes Zischeln mit einzelnen Spritzern. */
export const brutzeln: OneShot = (ctx, dest, t) => {
  const len = 2.0;
  const n = noise(ctx, len);
  const bp = filter(ctx, 'bandpass', 3800, 0.8);
  const g = envGain(ctx, t, [[0, 0], [0.25, 0.3], [1.6, 0.25], [len, 0]]);
  chain(n, bp, g, dest);
  n.start(t);
  for (let i = 0; i < 14; i++) click(ctx, dest, t + rand(0.1, len - 0.2), rand(2500, 6000), rand(0.1, 0.3), 0.02);
  return len;
};

/** Kaminfeuer: tiefes Rauschen mit unregelmäßigem Knacken. */
export const feuerKnistern: OneShot = (ctx, dest, t) => {
  const len = 3.0;
  const n = noise(ctx, len, 0.55);
  const lp = filter(ctx, 'lowpass', 900, 0.8);
  const g = envGain(ctx, t, [[0, 0], [0.4, 0.28], [2.4, 0.24], [len, 0]]);
  chain(n, lp, g, dest);
  n.start(t);
  for (let i = 0; i < 20; i++) click(ctx, dest, t + rand(0.1, len - 0.2), rand(900, 3200), rand(0.15, 0.45), 0.025);
  return len;
};

/* ---------------- Wetter und Wasser -------------------------------- */

/** Donner. Erst der Knall, dann das lange tiefe Grollen. */
export const donner: OneShot = (ctx, dest, t) => {
  const len = 3.4;
  const n = noise(ctx, len, 0.8);
  const lp = filter(ctx, 'lowpass', 260, 1.2);
  lp.frequency.setValueAtTime(420, t);
  lp.frequency.exponentialRampToValueAtTime(110, t + len);
  const g = envGain(ctx, t, [[0, 0], [0.05, 0.75], [0.4, 0.45], [1.6, 0.35], [len, 0]]);
  chain(n, lp, g, dest);
  lfo(ctx, g.gain, 1.7, 0.12, t, t + len);
  n.start(t);
  thump(ctx, dest, t, 55, 0.6, 0.5);
  return len;
};

/** Windböe. */
export const windBoe: OneShot = (ctx, dest, t) => {
  whoosh(ctx, dest, t, 2.2, 300, 700, 0.4);
  return 2.3;
};

/** Pusten. Kürzer und gerichteter als eine Böe - jemand bläst gezielt. */
export const pusten: OneShot = (ctx, dest, t) => {
  whoosh(ctx, dest, t, 1.3, 500, 1400, 0.55);
  return 1.4;
};

/** Wasserspritzer: Aufschlag plus ein paar Tropfen hinterher. */
export const wasserPlatsch: OneShot = (ctx, dest, t) => {
  const n = noise(ctx, 0.5, 0.3);
  const bp = filter(ctx, 'bandpass', 1400, 0.9);
  bp.frequency.setValueAtTime(1800, t);
  bp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
  const g = envGain(ctx, t, [[0, 0], [0.01, 0.7], [0.2, 0.2], [0.5, 0]]);
  chain(n, bp, g, dest);
  n.start(t);
  for (let i = 0; i < 5; i++) bubble(ctx, dest, t + rand(0.08, 0.7), rand(500, 1400), rand(0.2, 0.45));
  return 0.9;
};

/** Sternschnuppe: absteigendes Funkeln. */
export const sternenfall: OneShot = (ctx, dest, t) => {
  const len = 1.1;
  const o = osc(ctx, 'sine', t, [[0, 2600], [len, 700]]);
  const g = envGain(ctx, t, [[0, 0], [0.05, 0.3], [0.7, 0.18], [len, 0]]);
  chain(o, g, dest);
  o.start(t);
  o.stop(t + len);
  for (let i = 0; i < 8; i++) {
    const at = t + (i / 8) * len;
    click(ctx, dest, at, 3600 - i * 300, 0.16, 0.03);
  }
  return len + 0.2;
};

export const glitzern: OneShot = (ctx, dest, t) => {
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

export const schnarchen: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 2; i++) {
    const at = t + i * 1.5;
    const n = noise(ctx, 1.2, 0.75);
    const bp = filter(ctx, 'bandpass', 260, 6);
    const g = envGain(ctx, at, [[0, 0], [0.35, 2.6], [0.7, 2.3], [1.2, 0]]);
    chain(n, bp, g, dest);
    lfo(ctx, g.gain, 24, 0.8, at, at + 1.2);
    n.start(at);
  }
  return 2.7;
};

/* ---------------- Maschinen ---------------------------------------- */

/**
 * Baggermotor. Ein Diesel ist im Kern ein tiefer Sägezahn, dessen
 * Lautstärke im Takt der Zylinder pulsiert - hier etwa zwölfmal pro
 * Sekunde. Dazu Rauschen für den Auspuff.
 */
export const baggerMotor: OneShot = (ctx, dest, t) => {
  const len = 2.6;
  const o = osc(ctx, 'sawtooth', t, [[0, 62], [0.5, 78], [1.9, 74], [len, 55]]);
  const lp = filter(ctx, 'lowpass', 420, 3);
  const g = envGain(ctx, t, [[0, 0], [0.25, 0.5], [2.0, 0.45], [len, 0]]);
  chain(o, lp, g, dest);
  lfo(ctx, g.gain, 12, 0.22, t, t + len);
  o.start(t);
  o.stop(t + len);

  const n = noise(ctx, len, 0.4);
  const nf = filter(ctx, 'bandpass', 900, 1);
  const ng = envGain(ctx, t, [[0, 0], [0.25, 0.14], [2.0, 0.12], [len, 0]]);
  chain(n, nf, ng, dest);
  lfo(ctx, ng.gain, 12, 0.07, t, t + len);
  n.start(t);
  return len;
};

/** Raketenstart: alles wird lauter, tiefer und breiter zugleich. */
export const raketeStart: OneShot = (ctx, dest, t) => {
  const len = 3.2;
  const n = noise(ctx, len, 0.6);
  const lp = filter(ctx, 'lowpass', 300, 2);
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + 1.4);
  lp.frequency.exponentialRampToValueAtTime(600, t + len);
  // Gemessen: Vollausschlag. Rauschen und Grollen summierten sich zu weit
  // über eins, was hörbar knackte.
  const g = envGain(ctx, t, [[0, 0], [0.6, 0.22], [1.5, 0.42], [2.4, 0.28], [len, 0]]);
  chain(n, lp, g, dest);
  n.start(t);

  const rumble = osc(ctx, 'sawtooth', t, [[0, 38], [1.4, 66], [len, 30]]);
  const rf = filter(ctx, 'lowpass', 200, 4);
  const rg = envGain(ctx, t, [[0, 0], [0.5, 0.3], [1.6, 0.36], [len, 0]]);
  chain(rumble, rf, rg, dest);
  rumble.start(t);
  rumble.stop(t + len);
  return len;
};

/** Drachenfeuer: ein Luftstoß mit tiefem Körper darunter. */
export const dracheFeuer: OneShot = (ctx, dest, t) => {
  const len = 1.1;
  const n = noise(ctx, len, 0.25);
  const bp = filter(ctx, 'bandpass', 900, 0.7);
  bp.frequency.setValueAtTime(1600, t);
  bp.frequency.exponentialRampToValueAtTime(420, t + len);
  const g = envGain(ctx, t, [[0, 0], [0.06, 0.75], [0.5, 0.4], [len, 0]]);
  chain(n, bp, g, dest);
  n.start(t);

  const body = osc(ctx, 'sawtooth', t, [[0, 110], [len, 55]]);
  const bf = filter(ctx, 'lowpass', 320, 2);
  const bg = envGain(ctx, t, [[0, 0], [0.05, 0.4], [len, 0]]);
  chain(body, bf, bg, dest);
  body.start(t);
  body.stop(t + len);
  return len;
};
