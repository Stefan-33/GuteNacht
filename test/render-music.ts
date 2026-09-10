import { Mp3Encoder } from '@breezystack/lamejs';
import { Music } from '../src/engine/music';
import { impulseResponse } from '../src/engine/voice';
import type { Ctx } from '../src/engine/synth';

/**
 * Rendert eine Hörprobe der erzeugten Musik. Läuft im Browser, offline und
 * schneller als in Echtzeit - drei Minuten Musik in ein paar Sekunden.
 */
/**
 * MP3 statt WAV: Drei Minuten unkomprimiert sind fünfzehn Megabyte, und
 * die will niemand aufs Handy laden. Der Encoder läuft im Browser mit,
 * weil das ffmpeg dieser Umgebung ein abgespeckter Playwright-Build ohne
 * Encoder ist.
 */
function encodeMp3(samples: Float32Array, rate: number): string {
  const encoder = new Mp3Encoder(1, rate, 96);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }

  const chunks: Uint8Array[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const block = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (block.length > 0) chunks.push(new Uint8Array(block));
  }
  const last = encoder.flush();
  if (last.length > 0) chunks.push(new Uint8Array(last));

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }

  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < out.length; i += CHUNK) {
    binary += String.fromCharCode(...out.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function encodeWav(left: Float32Array, rate: number): string {
  const bytes = new ArrayBuffer(44 + left.length * 2);
  const view = new DataView(bytes);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + left.length * 2, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, left.length * 2, true);
  for (let i = 0; i < left.length; i++) {
    const v = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let binary = '';
  const raw = new Uint8Array(bytes);
  const CHUNK = 0x8000;
  for (let i = 0; i < raw.length; i += CHUNK) {
    binary += String.fromCharCode(...raw.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function render(seconds: number, gain: number, mood: string): Promise<string> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Etwas Raum, sonst klingt die Fläche flach.
  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx as unknown as Ctx, 2.6, 2.6);
  reverb.connect(master);
  const send = ctx.createGain();
  send.gain.value = 0.5;
  send.connect(reverb);

  // EIN Musiklauf, der gleichzeitig trocken und in den Hall geht.
  // Zwei getrennte Instanzen wären zwei verschiedene Stücke übereinander.
  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(send);
  const music = new Music(ctx as unknown as Ctx, bus, { gain, mood });

  music.scheduleUntil(seconds);
  const buffer = await ctx.startRendering();
  const samples = buffer.getChannelData(0);

  // Aussteuerung anheben: Die Musik wird in der App sehr leise laufen,
  // aber zum Beurteilen soll sie hörbar sein.
  let peak = 0;
  for (const v of samples) { const a = Math.abs(v); if (a > peak) peak = a; }
  if (peak > 0) {
    const boost = 0.7 / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= boost;
  }

  return encodeMp3(samples, rate);
}

(window as unknown as Record<string, unknown>).renderMusic = render;
