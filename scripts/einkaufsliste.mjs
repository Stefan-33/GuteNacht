/**
 * Schreibt public/sfx/EINKAUFSLISTE.md aus den gebauten Geschichten.
 *
 * Grund für dieses Skript: Die Liste war von Hand gepflegt und stand nach
 * dem ersten Ausdünnen auf 52 Klängen, von denen zwölf keine Geschichte mehr
 * brauchte - eine Einkaufsliste, die zu Fehlkäufen führt. Welche Klänge
 * vorkommen und wo, weiß nur der Inhalt. Also fragt die Liste ihn.
 *
 * Von Hand gepflegt wird nur noch scripts/klang-begriffe.json: Suchbegriff
 * und Beschreibung je Klang.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STORIES = 'public/stories';
const OUT = 'public/sfx/EINKAUFSLISTE.md';

const GRUPPEN = [
  ['tiere', 'Tiere und Stimmen', 'Hier lohnt es sich am meisten: Ohne diese bleiben die schönsten Momente stumm.'],
  ['laute', 'Menschliche Laute', 'Die sprichst du in dreißig Sekunden selbst ins Handy - schneller als jede Suche.'],
  ['geraeusche', 'Geräusche', 'Kurz halten, 0,5 bis 3 Sekunden, Stille am Anfang wegschneiden.'],
  ['kulisse', 'Kulissen', 'Laufen dauerhaft leise im Hintergrund. 20 bis 60 Sekunden, nahtlos in der Schleife - wenn man den Ansatzpunkt hört, hört man ihn alle zwanzig Sekunden.'],
];

const begriffe = JSON.parse(await readFile('scripts/klang-begriffe.json', 'utf8')).klaenge;

/* Was liegt schon im Ordner? Entscheidet nur den Einleitungstext. */
let vorhanden = new Set();
try {
  const manifest = JSON.parse(await readFile('public/sfx/index.json', 'utf8'));
  vorhanden = new Set(manifest.map((e) => e.name));
} catch { /* noch kein Manifest - dann ist nichts da. */ }

/* Zusammengesetzte Klänge: muss mit audio.ts übereinstimmen. */
const ZUSAMMENGESETZT = {
  tier_krach: ['esel', 'hund_bellen', 'katze_miau', 'hahn_kikeriki'],
};

const files = (await readdir(STORIES)).filter((f) => f.endsWith('.json') && f !== 'index.json');
const vorkommen = new Map(); // name -> Set<Titel>

for (const file of files) {
  const story = JSON.parse(await readFile(join(STORIES, file), 'utf8'));
  for (const item of story.blocks.flat()) {
    if (!item.c || item.c.type === 'amb-stop') continue;
    const namen = ZUSAMMENGESETZT[item.c.sound] ?? [item.c.sound];
    for (const n of namen) {
      if (!vorkommen.has(n)) vorkommen.set(n, new Set());
      vorkommen.get(n).add(story.title);
    }
  }
}

const fehlt = [...vorkommen.keys()].filter((n) => !begriffe[n]);
if (fehlt.length) {
  console.error(`✗ Kein Suchbegriff hinterlegt für: ${fehlt.join(', ')}`);
  console.error('  Ergänze scripts/klang-begriffe.json.');
  process.exitCode = 1;
}
const ueberzaehlig = Object.keys(begriffe).filter((n) => !vorkommen.has(n));
if (ueberzaehlig.length) {
  console.warn(`! Keine Geschichte braucht noch: ${ueberzaehlig.join(', ')}`);
}

/** „Rotkäppchen, Sterntaler" oder, ab vier, „7 Geschichten". */
function wo(titel) {
  const list = [...titel].sort((a, b) => a.localeCompare(b, 'de'));
  return list.length > 3 ? `${list.length} Geschichten` : list.join(', ');
}

const zeilen = [];
zeilen.push('# Einkaufsliste für echte Klänge');
zeilen.push('');
zeilen.push('<!-- Erzeugt von scripts/einkaufsliste.mjs - nicht von Hand ändern.');
zeilen.push('     Suchbegriffe pflegst du in scripts/klang-begriffe.json. -->');
zeilen.push('');
const fehlen = [...vorkommen.keys()].filter((n) => !vorhanden.has(n));
zeilen.push(`${vorkommen.size} Klänge für ${files.length} Geschichten.`);
zeilen.push('');
if (fehlen.length === 0) {
  zeilen.push('**Alle liegen im Ordner.** Diese Liste sagt, was wo vorkommt - falls du');
  zeilen.push('einen Klang austauschen willst, legst du eine Datei mit demselben Namen');
  zeilen.push('darüber (`.mp3`, `.ogg`, `.m4a` oder `.wav`). Der Suchbegriff hilft beim');
  zeilen.push('Suchen in einem Klangarchiv.');
} else {
  zeilen.push(`Es fehlen noch ${fehlen.length}: ${fehlen.join(', ')}.`);
  zeilen.push('');
  zeilen.push('**Die Synthese ist abgeschaltet.** Wo keine Datei liegt, bleibt es still -');
  zeilen.push('die Geschichte läuft trotzdem, nur mit Musik. Jede Datei wirkt sofort für');
  zeilen.push('sich, die Liste muss nicht komplett werden.');
}
zeilen.push('');
zeilen.push('Quelle für Ersatz: [pixabay.com/sound-effects](https://pixabay.com/sound-effects/) -');
zeilen.push('kein Konto, keine Namensnennung, direkter Download.');

for (const [key, titel, hinweis] of GRUPPEN) {
  const namen = [...vorkommen.keys()]
    .filter((n) => begriffe[n]?.gruppe === key)
    .sort((a, b) => vorkommen.get(b).size - vorkommen.get(a).size || a.localeCompare(b));
  if (!namen.length) continue;
  zeilen.push('');
  zeilen.push(`## ${titel} (${namen.length})`);
  zeilen.push('');
  zeilen.push(hinweis);
  zeilen.push('');
  zeilen.push('| Datei | Suchbegriff | Länge | Kommt vor in |');
  zeilen.push('|---|---|---|---|');
  for (const n of namen) {
    const b = begriffe[n];
    const da = vorhanden.has(n) ? '' : ' **fehlt**';
    zeilen.push(`| \`${n}.mp3\`${da} | ${b.suche} | ${b.sek} s | ${wo(vorkommen.get(n))} |`);
  }
}

zeilen.push('');
zeilen.push('## Was du nicht brauchst');
zeilen.push('');
for (const [name, teile] of Object.entries(ZUSAMMENGESETZT)) {
  zeilen.push(`\`${name}.mp3\` - liegen ${teile.map((t) => `\`${t}\``).join(', ')} vor,`);
  zeilen.push('stapelt die App das daraus. Eine eigene Aufnahme ersetzt die Stapelung.');
}
zeilen.push('');
zeilen.push('## Hochladen');
zeilen.push('');
zeilen.push('[github.com/Stefan-33/GuteNacht](https://github.com/Stefan-33/GuteNacht) ->');
zeilen.push('Ordner `public/sfx` -> **Add file -> Upload files** -> reinziehen ->');
zeilen.push('**Commit changes**. Netlify baut in etwa fünfzehn Sekunden neu.');
zeilen.push('');

await writeFile(OUT, zeilen.join('\n'), 'utf8');
console.log(`✓ ${OUT}: ${vorkommen.size} Klänge, ${files.length} Geschichten.`);
