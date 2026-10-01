/**
 * Bereitet Titelbilder für die Bibliothek auf: auf Kartengröße verkleinern,
 * als WebP schreiben, Größe berichten.
 *
 * Warum: Die Erzeugung liefert 1024er PNG mit gut einem Megabyte. Einundzwanzig
 * davon sind über zwanzig Megabyte - das lädt auf einem Handy im Schlafzimmer
 * nicht, und die Karten zeigen die Bilder ohnehin nur ein paar Zentimeter groß.
 *
 * Aufruf: node scripts/bilder-aufbereiten.mjs <roh-ordner> [kante]
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROH = process.argv[2] ?? 'roh-bilder';
const KANTE = Number(process.argv[3] ?? 512);
const ZIEL = 'public/bilder';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GUETE = 0.82;

const BILD = /\.(png|jpe?g|webp)$/i;

mkdirSync(ZIEL, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><title>bilder</title>');

const dateien = readdirSync(ROH).filter((f) => BILD.test(f)).sort();
const bericht = [];

for (const datei of dateien) {
  const name = basename(datei, extname(datei));
  const b64 = readFileSync(join(ROH, datei)).toString('base64');
  const art = extname(datei).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

  const r = await page.evaluate(async ([b64, art, kante, guete]) => {
    const bild = new Image();
    await new Promise((fertig, schief) => {
      bild.onload = fertig;
      bild.onerror = () => schief(new Error('nicht lesbar'));
      bild.src = `data:${art};base64,${b64}`;
    });
    /*
     * Papierrand wegschneiden.
     *
     * Die Erzeugung malt manchen Bildern einen hellen Rand ans Blatt, anderen
     * nicht. Auf den dunklen Karten der Bibliothek fällt das sofort auf: ein
     * Bild mit weißem Rahmen neben einem randlosen sieht aus wie ein Versehen.
     * Also von jeder Kante nach innen gehen, solange die Zeile fast einfarbig
     * und deutlich heller ist als das Bild im Mittel.
     */
    const mess = document.createElement('canvas');
    mess.width = bild.width;
    mess.height = bild.height;
    const mg = mess.getContext('2d', { willReadFrequently: true });
    mg.drawImage(bild, 0, 0);
    const dat = mg.getImageData(0, 0, bild.width, bild.height).data;
    const hell = (i) => (dat[i] + dat[i + 1] + dat[i + 2]) / 3;

    let mittel = 0;
    for (let i = 0; i < dat.length; i += 4) mittel += hell(i);
    mittel /= dat.length / 4;

    /*
     * Eine Zeile gilt als Rand, wenn fast alle ihre Punkte Papier sind: hell
     * und farbarm. Nicht "die ganze Zeile ist einfarbig" - der gemalte Rand
     * ist ausgefranst, und eine einzige Pinselspitze, die weiter hineinragt,
     * würde den Schnitt sonst viel zu früh stoppen.
     */
    const istPapier = (i) => {
      const r = dat[i], g2 = dat[i + 1], b2 = dat[i + 2];
      const max = Math.max(r, g2, b2);
      const min = Math.min(r, g2, b2);
      return (r + g2 + b2) / 3 > mittel + 25 && max - min < 34;
    };
    const randzeile = (punkte) => {
      let papier = 0;
      for (const i of punkte) if (istPapier(i)) papier++;
      return papier / punkte.length > 0.9;
    };
    const zeile = (y) => Array.from({ length: bild.width }, (_, x) => (y * bild.width + x) * 4);
    const spalte = (x) => Array.from({ length: bild.height }, (_, y) => (y * bild.width + x) * 4);

    const grenze = Math.floor(Math.min(bild.width, bild.height) * 0.18);
    let oben = 0, unten = 0, links = 0, rechts = 0;
    while (oben < grenze && randzeile(zeile(oben))) oben++;
    while (unten < grenze && randzeile(zeile(bild.height - 1 - unten))) unten++;
    while (links < grenze && randzeile(spalte(links))) links++;
    while (rechts < grenze && randzeile(spalte(bild.width - 1 - rechts))) rechts++;

    /*
     * Noch einmal um dieselbe Breite nach innen. Der gemalte Bereich hat
     * runde Ecken: nach dem reinen Randschnitt steht in den vier Ecken
     * weiter Papier, und genau das sieht auf der dunklen Karte aus wie ein
     * schiefes Passepartout. Die Zugabe ist so breit wie der Rand selbst -
     * die Eckenrundung hat erfahrungsgemäß dieselbe Größenordnung.
     */
    const zugabe = Math.max(oben, unten, links, rechts) > 4
      ? Math.max(oben, unten, links, rechts)
      : 0;
    oben += zugabe; unten += zugabe; links += zugabe; rechts += zugabe;

    const innenB = bild.width - links - rechts;
    const innenH = bild.height - oben - unten;

    /* Quadratisch zuschneiden - die Karten sind quadratisch, und Verzerren
     * fällt bei Gesichtern sofort auf. */
    const seite = Math.min(innenB, innenH);
    const x = links + (innenB - seite) / 2;
    const y = oben + (innenH - seite) / 2;
    const c = document.createElement('canvas');
    c.width = kante;
    c.height = kante;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(bild, x, y, seite, seite, 0, 0, kante, kante);
    const url = c.toDataURL('image/webp', guete);
    return {
      webp: url.split(',')[1],
      breite: bild.width,
      hoehe: bild.height,
      rand: Math.max(oben, unten, links, rechts),
    };
  }, [b64, art, KANTE, GUETE]);

  const buf = Buffer.from(r.webp, 'base64');
  writeFileSync(join(ZIEL, `${name}.webp`), buf);
  bericht.push({ name, vorher: readFileSync(join(ROH, datei)).length, nachher: buf.length, breite: r.breite, hoehe: r.hoehe, rand: r.rand });
}

await browser.close();

console.log('Bild                                 Quelle      Rand    vorher   nachher');
console.log('─'.repeat(76));
let summe = 0;
for (const b of bericht) {
  summe += b.nachher;
  console.log(
    `${b.name.padEnd(36)} ${`${b.breite}x${b.hoehe}`.padEnd(10)} ` +
    `${String(b.rand).padStart(4)} px ${(b.vorher / 1024).toFixed(0).padStart(6)} KB ${(b.nachher / 1024).toFixed(0).padStart(6)} KB`,
  );
}
console.log('─'.repeat(76));
const gerahmt = bericht.filter((b) => b.rand > 4);
console.log(`${bericht.length} Bild(er), zusammen ${(summe / 1024).toFixed(0)} KB bei ${KANTE} Pixeln Kante.`);
console.log(gerahmt.length
  ? `${gerahmt.length} hatte(n) einen hellen Papierrand, abgeschnitten: ${gerahmt.map((b) => `${b.name} (${b.rand} px)`).join(', ')}`
  : 'Keines hatte einen Papierrand.');
