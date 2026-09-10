/** Rendert die Musik-Hörprobe in echtem Chromium und misst sie nach. */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'preview';
const BUNDLE = process.argv[3];
const SECONDS = Number(process.argv[4] ?? 180);
const GAIN = Number(process.argv[5] ?? 0.3);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><title>musik</title>');
await page.addScriptTag({ content: readFileSync(BUNDLE, 'utf8') });

const b64 = await page.evaluate(([s, g]) => window.renderMusic(s, g), [SECONDS, GAIN]);
await browser.close();

const buf = Buffer.from(b64, 'base64');
const file = join(OUT, `Hoerprobe-Musik.mp3`);
writeFileSync(file, buf);

console.log(`Datei:  ${file}`);
console.log(`Größe:  ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
console.log(`Dauer:  ${(SECONDS / 60).toFixed(1)} Minuten`);
console.log(buf.length > 1000 && buf[0] === 0xff ? '\n✓ Gültige MP3-Datei.' : '\n✗ Sieht nicht nach MP3 aus.');
