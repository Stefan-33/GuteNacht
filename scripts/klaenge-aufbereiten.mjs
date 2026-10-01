/**
 * Bereitet erzeugte Klangdateien für die App auf: Stille wegschneiden,
 * Pegel abgleichen, neu als MP3 schreiben.
 *
 * Warum überhaupt: Der erste erzeugte Esel hatte 170 ms Stille am Anfang.
 * Der Ton kam also messbar später als Katze und Hahn - bei einem Klang, der
 * aufs Wort passen soll, ist das der Unterschied zwischen "sitzt" und
 * "kommt hinterher". Von Hand hört man das bei vierzig Dateien nie.
 *
 * Kulissen werden NICHT geschnitten. Sie laufen in der Schleife, und ein
 * Schnitt macht aus der nahtlosen Naht einen hörbaren Absatz alle dreißig
 * Sekunden.
 *
 * Aufruf: node scripts/klaenge-aufbereiten.mjs <roh-ordner> <ziel-ordner>
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROH = process.argv[2] ?? 'roh';
const ZIEL = process.argv[3] ?? 'public/sfx';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAME = 'node_modules/@breezystack/lamejs/dist/lamejs.iife.js';

/* Zielpegel. Effekte dürfen vorlaut sein, Kulissen nicht - sie laufen
 * dauerhaft mit und sollen unter der Stimme bleiben. */
const PEGEL_EFFEKT = 0.89;
const PEGEL_KULISSE = 0.70;
/* Ab diesem Anteil der Spitze gilt ein Abtastwert als hörbar. */
const SCHWELLE = 0.015;
/*
 * Grenze für den Pegelabgleich.
 *
 * Drei der vier Kulissen kamen mit einer Spitze von 0,01 und darunter aus der
 * Erzeugung - praktisch stumm, weil der Prompt "barely audible" verlangte. Ein
 * blinder Abgleich auf den Zielpegel hätte das Rauschen um den Faktor siebzig
 * bis hundertfünfundsiebzig verstärkt und als Kulisse ausgeliefert.
 *
 * Das Zwanzigfache deckt ab, was von Natur aus leise ist - ein weicher Plumps
 * ins Gras kam mit 0,04 und ist damit in Ordnung. Was mehr braucht, ist nicht
 * leise aufgenommen, sondern leer, und wird gemeldet statt geschönt.
 */
const MAX_VERSTAERKUNG = 20;

const begriffe = JSON.parse(readFileSync('scripts/klang-begriffe.json', 'utf8')).klaenge;
const AUDIO = /\.(mp3|ogg|opus|m4a|wav|webm)$/i;

mkdirSync(ZIEL, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><title>klang</title>');
await page.addScriptTag({ content: readFileSync(LAME, 'utf8') });

const dateien = readdirSync(ROH).filter((f) => AUDIO.test(f)).sort();
const bericht = [];

for (const datei of dateien) {
  const name = basename(datei, extname(datei));
  const eintrag = begriffe[name];
  if (!eintrag) {
    console.error(`✗ ${name}: steht nicht in klang-begriffe.json - übersprungen`);
    process.exitCode = 1;
    continue;
  }
  const kulisse = eintrag.gruppe === 'kulisse';
  const b64 = readFileSync(join(ROH, datei)).toString('base64');

  const r = await page.evaluate(async ([b64, kulisse, ziel, schwelle, maxVerstaerkung]) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    /* Zum Dekodieren reicht ein Kontext beliebiger Länge - decodeAudioData
     * liefert den Puffer in seiner eigenen Abtastrate zurück. */
    const ctx = new OfflineAudioContext(1, 1024, 44100);
    const buf = await ctx.decodeAudioData(bin.buffer);
    const rate = buf.sampleRate;
    const kanaele = [];
    for (let c = 0; c < buf.numberOfChannels; c++) kanaele.push(buf.getChannelData(c));

    let spitzeVorher = 0;
    for (const d of kanaele) for (const s of d) spitzeVorher = Math.max(spitzeVorher, Math.abs(s));
    if (spitzeVorher === 0) return { leer: true };

    // Schnittpunkte über alle Kanäle gemeinsam, sonst laufen sie auseinander.
    let start = 0;
    let ende = kanaele[0].length;
    if (!kulisse) {
      const grenze = spitzeVorher * schwelle;
      const laut = (i) => kanaele.some((d) => Math.abs(d[i]) >= grenze);
      while (start < ende && !laut(start)) start++;
      while (ende > start && !laut(ende - 1)) ende--;
      // Einen Hauch Vorlauf lassen, damit der Einsatz nicht abgehackt wirkt.
      start = Math.max(0, start - Math.round(rate * 0.005));
      ende = Math.min(kanaele[0].length, ende + Math.round(rate * 0.02));
    }

    const laenge = ende - start;
    const faktor = Math.min(ziel / spitzeVorher, maxVerstaerkung);
    const einblenden = Math.round(rate * (kulisse ? 0 : 0.004));
    const ausblenden = Math.round(rate * (kulisse ? 0 : 0.03));

    const raus = kanaele.map((d) => {
      const out = new Int16Array(laenge);
      for (let i = 0; i < laenge; i++) {
        let v = d[start + i] * faktor;
        if (i < einblenden) v *= i / einblenden;
        const rest = laenge - i;
        if (rest < ausblenden) v *= rest / ausblenden;
        out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      }
      return out;
    });

    const Mp3 = window.lamejs.Mp3Encoder;
    const enc = new Mp3(raus.length, rate, 128);
    const stuecke = [];
    const BLOCK = 1152;
    for (let i = 0; i < laenge; i += BLOCK) {
      const l = raus[0].subarray(i, i + BLOCK);
      const r = raus[1] ? raus[1].subarray(i, i + BLOCK) : undefined;
      const b = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
      if (b.length) stuecke.push(b);
    }
    const schluss = enc.flush();
    if (schluss.length) stuecke.push(schluss);

    let gesamt = 0;
    for (const s of stuecke) gesamt += s.length;
    const alles = new Uint8Array(gesamt);
    let p = 0;
    for (const s of stuecke) { alles.set(s, p); p += s.length; }
    let bin64 = '';
    for (const b of alles) bin64 += String.fromCharCode(b);

    return {
      spitzeNachher: Math.min(spitzeVorher * faktor, 1),
      mp3: btoa(bin64),
      vorherSek: buf.duration,
      nachherSek: laenge / rate,
      geschnittenMs: (start / rate) * 1000,
      spitzeVorher,
      kanaele: raus.length,
    };
  }, [b64, kulisse, kulisse ? PEGEL_KULISSE : PEGEL_EFFEKT, SCHWELLE, MAX_VERSTAERKUNG]);

  if (r.leer) {
    console.error(`✗ ${name}: durchgehend still - verworfen`);
    process.exitCode = 1;
    continue;
  }

  writeFileSync(join(ZIEL, `${name}.mp3`), Buffer.from(r.mp3, 'base64'));
  bericht.push({ name, kulisse, ...r });
}

await browser.close();

console.log('Klang              Rolle     vorher  nachher  abgeschnitten  Spitze vorher');
console.log('─'.repeat(78));
for (const b of bericht.sort((a, z) => a.name.localeCompare(z.name))) {
  console.log(
    `${b.name.padEnd(18)} ${(b.kulisse ? 'Kulisse' : 'Effekt').padEnd(9)} ` +
    `${b.vorherSek.toFixed(2).padStart(6)}s ${b.nachherSek.toFixed(2).padStart(7)}s ` +
    `${b.geschnittenMs.toFixed(0).padStart(13)} ms ${b.spitzeVorher.toFixed(2).padStart(14)}`,
  );
}
console.log('─'.repeat(78));
const spaet = bericht.filter((b) => b.geschnittenMs > 50);
/* Gemeldet wird, was NACH dem gekappten Abgleich zu leise bleibt - nicht
 * schon, dass die Kappung griff. Ein Plumps mit Spitze 0,04 landet bei 0,80
 * und ist in Ordnung; eine Kulisse mit 0,01 landet bei 0,20 und ist leer. */
const leise = bericht.filter((b) => b.spitzeNachher < 0.25);
const kurz = bericht.filter((b) => !b.kulisse && b.nachherSek < 0.4);
console.log(`${bericht.length} Datei(en) aufbereitet.`);
console.log(spaet.length
  ? `${spaet.length} hätte(n) zu spät eingesetzt: ${spaet.map((b) => `${b.name} (${b.geschnittenMs.toFixed(0)} ms)`).join(', ')}`
  : 'Keine hatte nennenswerte Stille am Anfang.');
if (leise.length) {
  console.error(`✗ Bleibt auch nach ${MAX_VERSTAERKUNG}-fachem Abgleich zu leise - neu erzeugen: ${leise.map((b) => `${b.name} (${b.spitzeNachher.toFixed(2)})`).join(', ')}`);
  process.exitCode = 1;
}
if (kurz.length) {
  console.error(`✗ Nach dem Schnitt fast nichts übrig - neu erzeugen: ${kurz.map((b) => `${b.name} (${b.nachherSek.toFixed(2)}s)`).join(', ')}`);
  process.exitCode = 1;
}
