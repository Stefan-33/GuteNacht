/** Rendert die Musik-Hörprobe in echtem Chromium und misst sie nach. */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'preview';
const BUNDLE = process.argv[3];
const SECONDS = Number(process.argv[4] ?? 180);
const GAIN = Number(process.argv[5] ?? 0.3);
const MOODS = (process.argv[6] ?? 'ruhig').split(',');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><title>musik</title>');
await page.addScriptTag({ content: readFileSync(BUNDLE, 'utf8') });

for (const mood of MOODS) {
  const b64 = await page.evaluate(([s, g, m]) => window.renderMusic(s, g, m), [SECONDS, GAIN, mood]);
  const buf = Buffer.from(b64, 'base64');
  const file = join(OUT, `Musik-${mood}.mp3`);
  writeFileSync(file, buf);
  console.log(`${mood.padEnd(10)} ${(buf.length / 1024).toFixed(0).padStart(5)} KB  ${buf[0] === 0xff ? '✓' : '✗ keine gültige MP3'}`);
}
await browser.close();
const buf = Buffer.from([0xff]);
const file = OUT;

console.log(`\n${MOODS.length} Stimmung(en) gerendert, je ${(SECONDS / 60).toFixed(1)} Minuten.`);
