/**
 * Kleiner Synthesizer-Baukasten auf Basis der Web Audio API.
 *
 * Warum synthetisch statt Samples: In dieser Umgebung komme ich an keine
 * Sound-Bibliotheken heran (Egress geblockt), und für einen Dreijährigen
 * sind cartoonhafte Geräusche ohnehin eher ein Feature als ein Mangel.
 * Echte Aufnahmen können später in dieselbe Registry gehängt werden,
 * die Cue-Namen in den Geschichten bleiben unverändert.
 */

export type Ctx = AudioContext;

/** Eine Einmal-Aufnahme: baut ihren Graphen, spielt ihn, räumt selbst auf. Liefert die Dauer. */
export type OneShot = (ctx: Ctx, dest: AudioNode, t: number) => number;

/** Eine Atmosphäre: läuft bis zum Aufruf der zurückgegebenen Stop-Funktion. */
export type Ambient = (ctx: Ctx, dest: AudioNode) => () => void;

const noiseCache = new Map<string, AudioBuffer>();

/** Rauschpuffer. `color` 0 = weiß, höher = dunkler (grob braunes Rauschen). */
export function noiseBuffer(ctx: Ctx, seconds: number, color = 0): AudioBuffer {
  const key = `${seconds}:${color}`;
  const cached = noiseCache.get(key);
  if (cached) return cached;

  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (color <= 0) {
      data[i] = white;
    } else {
      // Einpoliger Tiefpass im Zeitbereich - macht aus Weiß ein dumpfes Rauschen.
      last = (last * color + white * (1 - color));
      data[i] = last * (1 + color * 2);
    }
  }
  noiseCache.set(key, buf);
  return buf;
}

export function noise(ctx: Ctx, seconds: number, color = 0): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, seconds, color);
  return src;
}

/** Oszillator mit Frequenzverlauf: Punkte als [Sekunden ab t, Hertz]. */
export function osc(ctx: Ctx, type: OscillatorType, t: number, points: [number, number][]): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) {
    // exponentiell klingt bei Tonhöhen natürlicher als linear
    o.frequency.exponentialRampToValueAtTime(Math.max(1, points[i][1]), t + points[i][0]);
  }
  return o;
}

/** Lautstärkehüllkurve: Punkte als [Sekunden ab t, Verstärkung]. */
export function envGain(ctx: Ctx, t: number, points: [number, number][]): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) {
    g.gain.linearRampToValueAtTime(points[i][1], t + points[i][0]);
  }
  return g;
}

export function filter(ctx: Ctx, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Langsame Modulation, z. B. Vibrato oder ein wandernder Filter. */
export function lfo(ctx: Ctx, target: AudioParam, rate: number, depth: number, t: number, stopAt: number): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(target);
  o.start(t);
  o.stop(stopAt);
}

export function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
