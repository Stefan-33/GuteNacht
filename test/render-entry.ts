import { SFX, trimOf } from '../src/engine/sounds';
import { impulseResponse } from '../src/engine/voice';
import type { Ctx } from '../src/engine/synth';

/**
 * Wird im Browser ausgeführt. Rendert einen Klang offline in einen Puffer
 * und gibt ihn als WAV in Base64 zurück.
 *
 * Wichtig: hier läuft exakt derselbe Code wie in der App - dieselbe
 * Signalkette inklusive Nachhall. Ein separater Nachbau in Node würde
 * driften und genau das verbergen, was ich prüfen will.
 */
function encodeWav(samples: Float32Array, rate: number): string {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let binary = '';
  const raw = new Uint8Array(bytes);
  for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]);
  return btoa(binary);
}

async function render(name: string, seconds: number): Promise<string> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const bus = ctx.createGain();
  bus.connect(master);

  // Derselbe Pegelabgleich wie in der App - sonst hört man hier etwas
  // anderes als später beim Vorlesen.
  const trimmed = ctx.createGain();
  trimmed.gain.value = trimOf(name);
  trimmed.connect(bus);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx as unknown as Ctx);
  reverb.connect(master);
  const send = ctx.createGain();
  send.gain.value = 0.22;
  bus.connect(send).connect(reverb);

  SFX[name](ctx as unknown as Ctx, trimmed, 0.02);

  const buffer = await ctx.startRendering();
  return encodeWav(buffer.getChannelData(0), rate);
}

(window as unknown as Record<string, unknown>).renderSound = render;
(window as unknown as Record<string, unknown>).soundNames = Object.keys(SFX);
