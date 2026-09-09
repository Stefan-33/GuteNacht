import { Ambient, Ctx, OneShot, chain, envGain, filter, lfo, noise, osc, rand } from './synth';
import { voice } from './voice';

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

/*
 * Die Zahlenwerte hier sind nicht geraten, sondern an die Messwerte
 * echter Tierstimmen angelehnt: Grundtonlage, Formantpositionen und
 * Dauer stammen aus der Bioakustik-Literatur. Der Rest ist Handwerk.
 */

/**
 * Eselschrei. Zwei Silben: das helle, steigende "I" und das absackende,
 * raue "A". Die Rauheit ist der Kern - ein Esel klingt deshalb wie ein
 * Esel, weil sein Kehlkopf Subharmonische erzeugt. Ohne `sub` klingt das
 * Ganze wie eine Trompete.
 */
function bray(ctx: Ctx, dest: AudioNode, t: number, scale: number): number {
  const d = 1.05 * scale;
  return voice(ctx, dest, t, {
    duration: d,
    f0: [
      [0, 200], [0.06 * scale, 300], [0.30 * scale, 345],
      [0.36 * scale, 330], [0.45 * scale, 240], [d, 95],
    ],
    formants: [
      { f: [[0, 540], [0.32 * scale, 620], [0.5 * scale, 560], [d, 430]], q: 7, gain: 1 },
      { f: [[0, 1750], [0.30 * scale, 2050], [0.5 * scale, 1500], [d, 1080]], q: 9, gain: 0.55 },
      { f: [[0, 2800], [d, 2450]], q: 10, gain: 0.2 },
    ],
    amp: [
      [0, 0], [0.035, 0.9], [0.30 * scale, 0.85], [0.38 * scale, 1],
      [0.85 * scale, 0.6], [d, 0],
    ],
    jitter: 18,
    breath: 0.12,
    sub: 0.5,
    drive: 0.55,
    // Gemessen: mit 3200 lag der spektrale Schwerpunkt bei 1759 Hz - für
    // einen Esel viel zu hell. Ein Esel ist ein Brustkorb, kein Vogel.
    tilt: 2600,
  });
}

const esel: OneShot = (ctx, dest, t) => {
  bray(ctx, dest, t, 1);
  bray(ctx, dest, t + 1.2, 0.82);
  return 2.15;
};

/** Einzelnes Bellen. Kurz, harter Einsatz, Tonhöhe fällt sofort ab. */
function woof(ctx: Ctx, dest: AudioNode, t: number, pitch: number): void {
  voice(ctx, dest, t, {
    duration: 0.17,
    f0: [[0, pitch], [0.05, pitch * 0.8], [0.17, pitch * 0.32]],
    formants: [
      { f: [[0, 520], [0.17, 420]], q: 5, gain: 1 },
      { f: [[0, 1250], [0.17, 1050]], q: 6, gain: 0.8 },
      { f: [[0, 2400], [0.17, 2200]], q: 7, gain: 0.45 },
    ],
    amp: [[0, 0], [0.008, 1], [0.05, 0.55], [0.17, 0]],
    jitter: 12,
    breath: 0.3,
    sub: 0.25,
    drive: 0.6,
    tilt: 4200,
  });
}

const hundBellen: OneShot = (ctx, dest, t) => {
  woof(ctx, dest, t, 470);
  woof(ctx, dest, t + 0.28, 430);
  return 0.55;
};

/** Geheul. Im Gegensatz zum Bellen tonal - also kaum Jitter, kaum Rauheit. */
const hundJaulen: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 1.8,
  f0: [[0, 240], [0.35, 400], [1.1, 415], [1.8, 270]],
  formants: [
    { f: [[0, 450], [1.8, 420]], q: 8, gain: 1 },
    { f: [[0, 1150], [0.6, 1250], [1.8, 1050]], q: 9, gain: 0.6 },
    { f: [[0, 2500], [1.8, 2400]], q: 9, gain: 0.25 },
  ],
  amp: [[0, 0], [0.2, 0.65], [1.3, 0.6], [1.8, 0]],
  jitter: 5,
  breath: 0.08,
  sub: 0.12,
  drive: 0.2,
  tilt: 3000,
});

/**
 * Miau. Der Charakter steckt in der Formantwanderung: von "e" nach "a"
 * und zurück nach "u". Genau diese Bewegung macht aus einem Ton ein Miau.
 */
const katzeMiau: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 0.85,
  f0: [[0, 480], [0.15, 760], [0.45, 700], [0.85, 380]],
  formants: [
    { f: [[0, 850], [0.18, 1100], [0.85, 750]], q: 8, gain: 1 },
    { f: [[0, 1900], [0.2, 2250], [0.85, 1700]], q: 9, gain: 0.7 },
    { f: [[0, 3200], [0.85, 3000]], q: 8, gain: 0.3 },
  ],
  amp: [[0, 0], [0.06, 0.75], [0.5, 0.65], [0.85, 0]],
  jitter: 9,
  breath: 0.18,
  sub: 0.15,
  drive: 0.3,
  tilt: 4000,
});

/**
 * Hahnenschrei, vier Silben. Die dritte ist die längste und lauteste -
 * daran erkennt man ihn. Kräftig gesättigt, ein Hahn schreit am Anschlag.
 */
const hahnKikeriki: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 1.25,
  f0: [
    [0, 620], [0.10, 640], [0.13, 780], [0.26, 800],
    [0.30, 880], [0.55, 860], [0.60, 700], [1.25, 430],
  ],
  formants: [
    { f: [[0, 700], [0.3, 780], [1.25, 620]], q: 6, gain: 1 },
    { f: [[0, 1900], [0.3, 2100], [1.25, 1600]], q: 8, gain: 0.8 },
    { f: [[0, 3100], [1.25, 2800]], q: 9, gain: 0.4 },
  ],
  amp: [
    [0, 0], [0.02, 0.8], [0.10, 0.5], [0.13, 0.85], [0.25, 0.55],
    [0.30, 1], [0.55, 0.8], [0.62, 0.7], [1.25, 0],
  ],
  jitter: 20,
  breath: 0.25,
  sub: 0.35,
  drive: 0.7,
  tilt: 4500,
});

/** Alle vier gleichzeitig - der große Auftritt der Stadtmusikanten. */
const tierKrach: OneShot = (ctx, dest, t) => {
  // Sieben Stimmen übereinander erreichten gemessen Vollausschlag und
  // knackten hörbar. Also erst auf einen eigenen Bus, dann gedämpft weiter.
  const bus = ctx.createGain();
  bus.gain.value = 0.42;
  bus.connect(dest);
  esel(ctx, bus, t);
  hundBellen(ctx, bus, t + 0.15);
  hundBellen(ctx, bus, t + 1.0);
  katzeMiau(ctx, bus, t + 0.4);
  katzeMiau(ctx, bus, t + 1.45);
  hahnKikeriki(ctx, bus, t + 0.65);
  hahnKikeriki(ctx, bus, t + 1.75);
  setTimeout(() => bus.disconnect(), 6000);
  return 3.1;
};

/* ------------------------------------------------------------------ */
/* Geräusche                                                           */
/* ------------------------------------------------------------------ */

/** Klirrendes Glas - Rauschstoß plus ein paar hohe Splitter. */
const fensterKlirr: OneShot = (ctx, dest, t) => {
  /*
   * Gemessen: Schwerpunkt bei 11,5 kHz und Vollausschlag. Das ist schrill
   * und übersteuert - im dunklen Kinderzimmer genau das Falsche. Bandpass
   * statt Hochpass nimmt die Spitze heraus, ohne das Klirren zu verlieren.
   */
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

/** Knarrende Tür - schmalbandiges Rauschen, das sich langsam hochschiebt. */
const tuerKnarr: OneShot = (ctx, dest, t) => {
  const len = 1.5;
  /*
   * Güte 8, nicht 22. Die erste Fassung filterte so schmal, dass vom
   * Signal nichts übrig blieb - gemessene Spitze 0,06, also unhörbar.
   * Ein zweiter, höherer Resonanzpunkt gibt dem Knarren das Quietschende.
   */
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
    const g = envGain(ctx, at, [[0, 0], [0.35, 2.6], [0.7, 2.3], [1.2, 0]]);
    chain(n, bp, g, dest);
    lfo(ctx, g.gain, 24, 0.8, at, at + 1.2);
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
/* Pegelabgleich                                                       */
/* ------------------------------------------------------------------ */

/*
 * Korrekturfaktoren, damit alle Effekte ungefähr gleich laut sind.
 *
 * Diese Zahlen sind NICHT nach Gefühl gesetzt, sondern von
 * test/render-sounds.mjs ausgerechnet: Das Skript rendert jeden Klang in
 * echtem Chromium offline, misst die Spitzenaussteuerung und leitet daraus
 * den Faktor auf einen gemeinsamen Zielpegel ab.
 *
 * Der Grund ist praktisch: In der ersten Fassung stand der Esel bei 0,89
 * und die Katze bei 0,50. Neben dem Esel war die Katze schlicht nicht da.
 *
 * Wer eine Klangvorschrift ändert, lässt das Skript neu laufen und
 * übernimmt die Tabelle, die es ausgibt.
 */
export const TRIM: Record<string, number> = {
  esel: 0.83,
  hund_bellen: 0.83,
  hund_jaulen: 1.57,
  katze_miau: 1.47,
  hahn_kikeriki: 0.80,
  tier_krach: 0.86,
  fenster_klirr: 2.25,
  tuer_knarr: 0.81,
  schritte: 1.33,
  poltern: 0.98,
  schnarchen: 0.87,
  glitzern: 1.17,
};

/** Faktor für einen Klang, oder 1, wenn keiner hinterlegt ist. */
export function trimOf(name: string): number {
  return TRIM[name] ?? 1;
}

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
