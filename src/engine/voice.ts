import { Ctx, filter, noise } from './synth';

/**
 * Formant-Synthese für Tierstimmen.
 *
 * Die erste Fassung dieser App hat Tiere als "Sägezahn plus Bandpass"
 * gebaut. Das klingt nach Synthesizer, weil es einer ist. Tierlaute
 * entstehen wie menschliche Sprache: eine Anregung im Kehlkopf, geformt
 * von mehreren Resonanzen im Rachenraum. Vier Dinge machen den
 * Unterschied zwischen "Instrument" und "Lebewesen":
 *
 * 1. MEHRERE FORMANTEN, die sich BEWEGEN. Ein "I-A" ist nichts anderes
 *    als zwei Formanten, die von einer Position zur nächsten wandern.
 * 2. JITTER. Kein Tier hält eine Tonhöhe exakt. Schon zwei Prozent
 *    unregelmäßige Schwankung nehmen den Maschinenklang heraus.
 * 3. SUBHARMONISCHE. Esel, Ziegen und Krähen erzeugen im Kehlkopf
 *    Schwingungen unterhalb des Grundtons - das ist die Rauheit, die
 *    einen Eselschrei ausmacht.
 * 4. SÄTTIGUNG. Laute Rufe sind nichtlinear verzerrt. Ein sauberer
 *    Sinus klingt niemals nach Anstrengung.
 */

/** Frequenzverlauf: [Sekunden ab Start, Hertz]. */
export type Contour = [number, number][];

export interface FormantSpec {
  /** Wanderung der Mittenfrequenz. */
  f: Contour;
  /** Güte - höher heißt schmaler und ausgeprägter. */
  q: number;
  gain: number;
}

export interface VoiceSpec {
  duration: number;
  /** Grundton-Verlauf. */
  f0: Contour;
  /** Zwei bis vier Formanten. Der erste trägt den Vokalcharakter. */
  formants: FormantSpec[];
  /** Lautstärkeverlauf [Sekunden, 0-1]. */
  amp: [number, number][];
  /** Tonhöhen-Schwankung in Hertz. 5-30 je nach Tier. */
  jitter?: number;
  /** Rauschanteil (Atem, Zischen) 0-1. */
  breath?: number;
  /** Subharmonische für Rauheit 0-1. */
  sub?: number;
  /** Sättigung 0-1. */
  drive?: number;
  /** Eckfrequenz der Quelle - dämpft das Sägezahn-Gesurre. */
  tilt?: number;
  /**
   * Lautstärke-Tremolo als [Hertz, Tiefe]. Für Schafe und Ziegen der
   * entscheidende Parameter: das charakteristische Meckern ist nichts
   * anderes als ein schnelles Zittern der Lautstärke, ungefähr zwölfmal
   * pro Sekunde. Ohne Tremolo klingt ein Schaf wie eine Hupe.
   */
  tremolo?: [number, number];
}

function setContour(param: AudioParam, t: number, points: Contour, exponential = true): void {
  param.setValueAtTime(Math.max(1, points[0][1]), t + points[0][0]);
  for (let i = 1; i < points.length; i++) {
    const v = Math.max(1, points[i][1]);
    if (exponential) param.exponentialRampToValueAtTime(v, t + points[i][0]);
    else param.linearRampToValueAtTime(v, t + points[i][0]);
  }
}

/** Weiche Sättigung. Ohne die klingt jeder laute Ruf nach Laborbedingungen. */
function saturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  // Über einen ArrayBuffer, weil WaveShaper.curve kein Float32Array über
  // einem SharedArrayBuffer akzeptiert.
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 1 + amount * 14;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

/**
 * Baut eine Tierstimme und spielt sie ab. Liefert die Dauer zurück.
 */
export function voice(ctx: Ctx, dest: AudioNode, t: number, spec: VoiceSpec): number {
  const dur = spec.duration;
  const stopAt = t + dur + 0.05;

  /* --- Anregung: Kehlkopf ------------------------------------------- */

  const source = ctx.createGain();
  source.gain.value = 1;

  const glottis = ctx.createOscillator();
  glottis.type = 'sawtooth';
  setContour(glottis.frequency, t, spec.f0);

  // Jitter über gefiltertes Rauschen direkt auf die Frequenz. Ein
  // Sinus-LFO wäre hier falsch: der schwankt regelmäßig, ein Kehlkopf nicht.
  if (spec.jitter) {
    const jn = noise(ctx, dur + 0.2);
    const jlp = filter(ctx, 'lowpass', 18, 0.8);
    const jg = ctx.createGain();
    jg.gain.value = spec.jitter;
    jn.connect(jlp).connect(jg).connect(glottis.frequency);
    jn.start(t);
    jn.stop(stopAt);
  }

  const glottisGain = ctx.createGain();
  glottisGain.gain.value = 1;
  glottis.connect(glottisGain).connect(source);
  glottis.start(t);
  glottis.stop(stopAt);

  // Subharmonische: eine Oktave tiefer, leicht verstimmt. Das erzeugt die
  // Rauheit, an der man einen Esel überhaupt erst erkennt.
  if (spec.sub) {
    const sub = ctx.createOscillator();
    sub.type = 'sawtooth';
    setContour(sub.frequency, t, spec.f0.map(([time, f]) => [time, f * 0.5]));
    const sg = ctx.createGain();
    sg.gain.value = spec.sub;
    sub.connect(sg).connect(source);
    sub.start(t);
    sub.stop(stopAt);
  }

  // Atemgeräusch - jedes Tier bewegt beim Rufen auch Luft.
  if (spec.breath) {
    const bn = noise(ctx, dur + 0.2);
    const bf = filter(ctx, 'bandpass', 1600, 0.7);
    const bg = ctx.createGain();
    bg.gain.value = spec.breath;
    bn.connect(bf).connect(bg).connect(source);
    bn.start(t);
    bn.stop(stopAt);
  }

  // Spektrale Neigung: nimmt dem Sägezahn das Surren, bevor er in die
  // Formanten läuft.
  const tilt = filter(ctx, 'lowpass', spec.tilt ?? 3800, 0.7);
  source.connect(tilt);

  /* --- Rachenraum: parallele Formanten ------------------------------ */

  const throat = ctx.createGain();
  throat.gain.value = 1 / Math.max(1, spec.formants.length * 0.6);

  for (const f of spec.formants) {
    const bp = filter(ctx, 'bandpass', f.f[0][1], f.q);
    setContour(bp.frequency, t, f.f);
    const g = ctx.createGain();
    g.gain.value = f.gain;
    tilt.connect(bp);
    bp.connect(g).connect(throat);
  }

  /* --- Sättigung und Hüllkurve -------------------------------------- */

  const shaper = ctx.createWaveShaper();
  shaper.curve = saturationCurve(spec.drive ?? 0.25);
  shaper.oversample = '2x';

  const env = ctx.createGain();
  env.gain.setValueAtTime(spec.amp[0][1], t + spec.amp[0][0]);
  for (let i = 1; i < spec.amp.length; i++) {
    env.gain.linearRampToValueAtTime(spec.amp[i][1], t + spec.amp[i][0]);
  }

  if (spec.tremolo) {
    const [rate, depth] = spec.tremolo;
    const trem = ctx.createOscillator();
    trem.type = 'sine';
    trem.frequency.value = rate;
    const tg = ctx.createGain();
    tg.gain.value = depth;
    trem.connect(tg).connect(env.gain);
    trem.start(t);
    trem.stop(stopAt);
  }

  throat.connect(shaper).connect(env).connect(dest);
  return dur;
}

/**
 * Künstlicher Raum. Alles bislang Synthetisierte klang staubtrocken -
 * als stünde der Esel im schalltoten Raum statt auf einem Hof. Ein
 * bisschen Nachhall bindet die Klänge zusammen und lässt sie erst
 * aufgenommen wirken.
 */
export function impulseResponse(ctx: Ctx, seconds = 1.3, decay = 3.4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const fade = Math.pow(1 - i / len, decay);
      // Die ersten Millisekunden ausdünnen, sonst klingt es nach Blechdose.
      const early = i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1;
      data[i] = (Math.random() * 2 - 1) * fade * early;
    }
  }
  return buf;
}
