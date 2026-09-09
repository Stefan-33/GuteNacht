import { Ambient, Ctx, chain, envGain, filter, lfo, noise, osc, rand } from '../synth';

/**
 * Kulissen. Jede Geschichte bekommt ihre eigene, sonst wird die Bibliothek
 * akustisch langweilig, auch wenn die Texte wechseln.
 *
 * Aufbau überall gleich: eine Grundschicht aus gefiltertem Rauschen plus
 * einzelne Ereignisse in unregelmäßigem Abstand. Der unregelmäßige Abstand
 * ist wichtig - ein Vogel, der alle vier Sekunden exakt gleich zwitschert,
 * fällt nach einer Minute unangenehm auf.
 */

/** Grundschicht: dunkles Rauschen mit langsam wanderndem Tiefpass. */
function bed(ctx: Ctx, dest: AudioNode, cutoff: number, level: number, color = 0.86): () => void {
  const n = noise(ctx, 4, color);
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

/** Wiederkehrendes Zufallsereignis in unregelmäßigem Abstand. */
function every(minMs: number, maxMs: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    fn();
    timer = setTimeout(tick, rand(minMs, maxMs));
  };
  timer = setTimeout(tick, rand(minMs, maxMs));
  return () => clearTimeout(timer);
}

/* ---------------- Einzelereignisse --------------------------------- */

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

/** Tropfen in einer Höhle - kurzer Sinus mit steigender Tonhöhe und Hall-Fahne. */
function drip(ctx: Ctx, dest: AudioNode): void {
  const t = ctx.currentTime + 0.02;
  const base = rand(700, 1500);
  const o = osc(ctx, 'sine', t, [[0, base], [0.09, base * 1.9]]);
  const g = envGain(ctx, t, [[0, 0], [0.005, 0.16], [0.1, 0]]);
  chain(o, g, dest);
  o.start(t);
  o.stop(t + 0.12);
}

/** Metallisches Klopfen einer Baustelle in der Ferne. */
function clank(ctx: Ctx, dest: AudioNode): void {
  const t = ctx.currentTime + 0.02;
  const f = rand(600, 1400);
  const o = osc(ctx, 'triangle', t, [[0, f], [0.25, f * 0.9]]);
  const g = envGain(ctx, t, [[0, 0], [0.004, 0.09], [0.28, 0]]);
  chain(o, g, dest);
  o.start(t);
  o.stop(t + 0.3);
}

/** Ferne Autos - ein leiser Rauschbogen, der vorbeizieht. */
function passingCar(ctx: Ctx, dest: AudioNode): void {
  const t = ctx.currentTime + 0.02;
  const len = rand(2.2, 3.5);
  const n = noise(ctx, len, 0.7);
  const bp = filter(ctx, 'bandpass', 400, 0.8);
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.linearRampToValueAtTime(600, t + len * 0.5);
  bp.frequency.linearRampToValueAtTime(220, t + len);
  const g = envGain(ctx, t, [[0, 0], [len * 0.5, 0.06], [len, 0]]);
  chain(n, bp, g, dest);
  n.start(t);
}

/** Ein Ton aus dem Nichts - für den Weltraum und den Sternenhimmel. */
function shimmer(ctx: Ctx, dest: AudioNode, low: number, high: number): void {
  const t = ctx.currentTime + 0.02;
  const len = rand(2.5, 5);
  const f = rand(low, high);
  const o = osc(ctx, 'sine', t, [[0, f], [len, f * rand(0.96, 1.04)]]);
  const g = envGain(ctx, t, [[0, 0], [len * 0.4, 0.05], [len, 0]]);
  chain(o, g, dest);
  o.start(t);
  o.stop(t + len + 0.1);
}

/* ---------------- Kulissen ----------------------------------------- */

const bauernhof: Ambient = (ctx, dest) => {
  const stop = [bed(ctx, dest, 480, 0.16), every(3500, 9000, () => chirp(ctx, dest))];
  return () => stop.forEach((s) => s());
};

const waldTag: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 620, 0.15),
    every(2200, 6000, () => chirp(ctx, dest)),
  ];
  return () => stop.forEach((s) => s());
};

const waldNacht: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 320, 0.2),
    every(9000, 20000, () => hoot(ctx, dest)),
    every(1800, 4500, () => cricket(ctx, dest)),
  ];
  return () => stop.forEach((s) => s());
};

const stube: Ambient = (ctx, dest) => {
  const stop = [bed(ctx, dest, 220, 0.12)];
  return () => stop.forEach((s) => s());
};

/** Savanne: warm, trocken, viele Grillen, kaum Wind. */
const savanne: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 400, 0.13),
    every(900, 2600, () => cricket(ctx, dest)),
    every(7000, 16000, () => chirp(ctx, dest)),
  ];
  return () => stop.forEach((s) => s());
};

/** Baustelle: tiefes Brummen und gelegentliches Metallklopfen. */
const baustelle: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 260, 0.16, 0.9),
    every(1500, 4000, () => clank(ctx, dest)),
  ];
  return () => stop.forEach((s) => s());
};

/** Stadt bei Nacht: sehr leise, ab und zu ein Auto in der Ferne. */
const nachtStadt: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 200, 0.11, 0.9),
    every(6000, 15000, () => passingCar(ctx, dest)),
  ];
  return () => stop.forEach((s) => s());
};

/** Höhle: sehr dumpf, hallig, einzelne Tropfen. */
const hoehle: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 180, 0.14, 0.92),
    every(2500, 7000, () => drip(ctx, dest)),
  ];
  return () => stop.forEach((s) => s());
};

/** Wind in großer Höhe: heller und gleichmäßiger als am Boden. */
const windHoehe: Ambient = (ctx, dest) => {
  const stop = [bed(ctx, dest, 800, 0.2, 0.8)];
  return () => stop.forEach((s) => s());
};

/** Regen: dichtes helles Rauschen plus einzelne Tropfen auf dem Fensterbrett. */
const regen: Ambient = (ctx, dest) => {
  const n = noise(ctx, 4, 0.25);
  n.loop = true;
  const bp = filter(ctx, 'bandpass', 2200, 0.6);
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 1.2);
  chain(n, bp, g, dest);
  lfo(ctx, g.gain, 0.13, 0.07, ctx.currentTime, ctx.currentTime + 3600);
  n.start();

  const stopDrips = every(400, 1400, () => drip(ctx, dest));
  return () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 0.8);
    setTimeout(() => { try { n.stop(); } catch { /* schon gestoppt */ } }, 1000);
    stopDrips();
  };
};

/** Weltraum: kein Wind, keine Tiere - nur ein leises Wabern und ferne Töne. */
const weltraum: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 140, 0.13, 0.94),
    every(2500, 6000, () => shimmer(ctx, dest, 300, 900)),
  ];
  return () => stop.forEach((s) => s());
};

/** Sternenhimmel: wie der Weltraum, aber wärmer und höher - zum Einschlafen. */
const sternenhimmel: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 160, 0.1, 0.93),
    every(1800, 4500, () => shimmer(ctx, dest, 700, 1800)),
  ];
  return () => stop.forEach((s) => s());
};

/** Unter Wasser: alles dumpf, dazu aufsteigende Blasen. */
const unterwasser: Ambient = (ctx, dest) => {
  const stop = [
    bed(ctx, dest, 300, 0.2, 0.9),
    every(700, 2200, () => {
      const t = ctx.currentTime + 0.02;
      const base = rand(200, 600);
      const o = osc(ctx, 'sine', t, [[0, base], [0.07, base * 2.4]]);
      const g = envGain(ctx, t, [[0, 0], [0.004, 0.09], [0.07, 0]]);
      chain(o, g, dest);
      o.start(t);
      o.stop(t + 0.09);
    }),
  ];
  return () => stop.forEach((s) => s());
};

export const AMB: Record<string, Ambient> = {
  bauernhof,
  wald_tag: waldTag,
  wald_nacht: waldNacht,
  stube,
  savanne,
  baustelle,
  nacht_stadt: nachtStadt,
  hoehle,
  wind_hoehe: windHoehe,
  regen,
  weltraum,
  sternenhimmel,
  unterwasser,
};
