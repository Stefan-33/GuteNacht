/**
 * Rendert alle Klänge in echtem Chromium offline zu WAV und misst sie nach.
 *
 * Der Grund für diesen Umweg: Ich kann das Ergebnis nicht anhören. Also
 * messe ich stattdessen, was messbar ist - Grundton, Dauer, Aussteuerung,
 * spektraler Schwerpunkt - und vergleiche mit den Werten echter Tierstimmen
 * aus der Bioakustik. Das ersetzt kein Ohr, fängt aber die groben Fehler ab:
 * ein Hahn zwei Oktaven zu tief, ein übersteuerter Esel, ein Klang, der
 * eigentlich nur Rauschen ist.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'sounds-preview';
const BUNDLE = process.argv[3] ?? '/tmp/render/bundle.js';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Wie lange jeder Klang gerendert wird (inkl. Nachhall-Fahne). */
const LENGTHS = {
  esel: 3.0, hund_bellen: 1.4, hund_jaulen: 2.8, katze_miau: 1.8,
  hahn_kikeriki: 2.2, tier_krach: 4.6, fenster_klirr: 1.8, tuer_knarr: 2.6,
  schritte: 2.6, poltern: 2.4, schnarchen: 3.8, glitzern: 2.2,
};

/** Erwartungswerte aus der Literatur - Grundtonlage in Hertz. */
const EXPECTED = {
  esel: [80, 400, 'Eselschrei: tiefes Absacken, raue Subharmonische'],
  hund_bellen: [150, 600, 'Bellen mittelgroßer Hund'],
  hund_jaulen: [230, 450, 'Geheul, tonal'],
  katze_miau: [370, 800, 'Miau'],
  hahn_kikeriki: [400, 900, 'Hahnenschrei'],
};

/* ---- Messwerkzeug ------------------------------------------------- */

function readWav(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const rate = view.getUint32(24, true);
  const n = view.getUint32(40, true) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(44 + i * 2, true) / 32768;
  return { rate, samples: out };
}

/** Iterative Radix-2-FFT, nur für den spektralen Schwerpunkt. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

/** Lautester Abschnitt - dort wird gemessen, nicht in der Stille davor. */
function loudestFrame(samples, size) {
  let best = 0, bestEnergy = -1;
  for (let i = 0; i + size < samples.length; i += size >> 2) {
    let e = 0;
    for (let k = 0; k < size; k++) e += samples[i + k] * samples[i + k];
    if (e > bestEnergy) { bestEnergy = e; best = i; }
  }
  return best;
}

/** Grundton über Autokorrelation. */
function pitch(samples, rate, from) {
  const size = 2048;
  const frame = samples.slice(from, from + size);
  const minLag = Math.floor(rate / 1200);
  const maxLag = Math.floor(rate / 60);
  let bestLag = 0, best = 0;
  for (let lag = minLag; lag < maxLag && lag < size / 2; lag++) {
    let sum = 0, norm = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += frame[i] * frame[i + lag];
      norm += frame[i + lag] * frame[i + lag];
    }
    const score = norm > 0 ? sum / Math.sqrt(norm) : 0;
    if (score > best) { best = score; bestLag = lag; }
  }
  return bestLag > 0 ? rate / bestLag : 0;
}

/**
 * Tonhöhenverlauf über die ganze Aufnahme. Ein einzelner Messpunkt sagt bei
 * einem Klang, dessen Tonhöhe wandert, fast nichts - und die Autokorrelation
 * rastet bei stark gefilterten Signalen gern auf einer Resonanz statt auf dem
 * Grundton ein. Der Verlauf zeigt, ob die Bewegung stimmt.
 */
function pitchContour(samples, rate) {
  const size = 2048;
  const values = [];
  let maxEnergy = 0;
  const frames = [];
  for (let i = 0; i + size < samples.length; i += size) {
    let e = 0;
    for (let k = 0; k < size; k++) e += samples[i + k] * samples[i + k];
    frames.push({ i, e });
    if (e > maxEnergy) maxEnergy = e;
  }
  for (const f of frames) {
    if (f.e < maxEnergy * 0.15) continue; // Stille und Ausklang überspringen
    const p = pitch(samples, rate, f.i);
    if (p > 0) values.push(p);
  }
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

/** Spektraler Schwerpunkt in Hertz - grob "wie hell klingt es". */
function centroid(samples, rate, from) {
  const size = 2048;
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    re[i] = (samples[from + i] ?? 0) * w;
  }
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < size / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    num += (k * rate / size) * mag;
    den += mag;
  }
  return den > 0 ? num / den : 0;
}

/* ---- Rendern ------------------------------------------------------ */

mkdirSync(OUT, { recursive: true });
const bundle = readFileSync(BUNDLE, 'utf8');

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><title>render</title>');
await page.addScriptTag({ content: bundle });

const names = await page.evaluate(() => window.soundNames);
const rows = [];

for (const name of names) {
  const seconds = LENGTHS[name] ?? 2.5;
  const b64 = await page.evaluate(
    ([n, s]) => window.renderSound(n, s),
    [name, seconds],
  );
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(join(OUT, `${name}.wav`), buf);

  const { rate, samples } = readWav(buf);
  let peak = 0, sumSq = 0;
  for (const v of samples) { const a = Math.abs(v); if (a > peak) peak = a; sumSq += v * v; }
  const rms = Math.sqrt(sumSq / samples.length);
  const at = loudestFrame(samples, 2048);
  rows.push({
    name,
    peak,
    rms,
    f0: pitch(samples, rate, at),
    contour: pitchContour(samples, rate),
    centroid: centroid(samples, rate, at),
    kb: buf.length / 1024,
  });
}

await browser.close();

/* ---- Bericht ------------------------------------------------------ */

console.log('Klang             Spitze    RMS    Grundton   Schwerpunkt   Größe');
console.log('─'.repeat(72));
let problems = 0;
for (const r of rows) {
  const flags = [];
  if (r.peak > 0.99) { flags.push('ÜBERSTEUERT'); problems++; }
  else if (r.peak < 0.05) { flags.push('ZU LEISE'); problems++; }
  const exp = EXPECTED[r.name];
  // Bewertet wird der Verlauf, nicht ein Einzelwert: der Klang muss sich
  // im erwarteten Bereich BEWEGEN, nicht dort festkleben.
  if (exp && r.contour) {
    const { min, max } = r.contour;
    if (max < exp[0] || min > exp[1]) {
      flags.push(`Tonlage ${Math.round(min)}-${Math.round(max)} Hz verfehlt ${exp[0]}-${exp[1]} Hz`);
      problems++;
    }
  }
  console.log(
    `${r.name.padEnd(16)} ${r.peak.toFixed(2).padStart(6)} ${r.rms.toFixed(3).padStart(7)} ` +
    `${Math.round(r.f0).toString().padStart(7)} Hz ${Math.round(r.centroid).toString().padStart(9)} Hz ` +
    `${r.kb.toFixed(0).padStart(6)} KB` + (flags.length ? `   ← ${flags.join(', ')}` : ''),
  );
  if (r.contour && EXPECTED[r.name]) {
    console.log(`${' '.repeat(17)}Tonhöhenverlauf ${Math.round(r.contour.min)} … ${Math.round(r.contour.median)} … ${Math.round(r.contour.max)} Hz   (${EXPECTED[r.name][2]})`);
  }
}
console.log('─'.repeat(72));
console.log(problems === 0
  ? '✓ Keine Auffälligkeiten in den Messwerten.'
  : `✗ ${problems} Auffälligkeit(en).`);

/*
 * Pegelabgleich. Alle Effekte sollen ungefähr gleich laut sein, sonst geht
 * die Katze neben dem Esel unter. Ausgerechnet statt nach Gefühl geraten.
 */
const TARGET = 0.75;
console.log('\nVorschlag für die TRIM-Tabelle in sounds.ts:\n');
console.log('export const TRIM: Record<string, number> = {');
for (const r of rows) {
  const trim = Math.min(9, Math.max(0.1, TARGET / Math.max(0.01, r.peak)));
  console.log(`  ${r.name}: ${trim.toFixed(2)},`);
}
console.log('};');
