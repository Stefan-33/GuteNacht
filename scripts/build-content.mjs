/**
 * Content-Pipeline: Markdown mit Inline-Markern -> JSON für die App.
 *
 * Absicht: Geschichten sollen lesbar geschrieben und gepflegt werden.
 * Niemand tippt von Hand Token-Indizes. Der Autor setzt {{sfx:esel}}
 * dorthin, wo es klingen soll, dieses Skript rechnet den Rest.
 *
 * Bewusst NICHT hier drin: Tokenisierung und Phonetik. Die passieren zur
 * Laufzeit in src/engine/, damit Vorlagetext und Spracherkennung garantiert
 * durch dieselbe Normalisierung laufen. Zwei Implementierungen driften.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = 'content';
const OUT = 'public/stories';
const SFX = 'public/sfx';

const MARKER = /\{\{(sfx|amb|amb-stop):([a-zA-Z0-9_]+)((?:\|[a-z]+=[-0-9.]+)*)\}\}/g;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error('Frontmatter fehlt');
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = m[2].trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

function parseOptions(str) {
  const opts = {};
  for (const part of str.split('|')) {
    const m = part.match(/^([a-z]+)=([-0-9.]+)$/);
    if (m) opts[m[1]] = Number(m[2]);
  }
  return opts;
}

/**
 * Zerlegt einen Absatz in eine Folge aus Wörtern und Cue-Markern.
 * Die Reihenfolge ist alles - daraus ergibt sich später die Token-Position.
 */
function parseParagraph(text) {
  const items = [];
  let last = 0;
  MARKER.lastIndex = 0;

  const pushWords = (chunk) => {
    for (const w of chunk.split(/\s+/)) {
      if (w) items.push({ w });
    }
  };

  let m;
  while ((m = MARKER.exec(text)) !== null) {
    pushWords(text.slice(last, m.index));
    const opts = parseOptions(m[3] ?? '');
    items.push({
      c: {
        type: m[1],
        sound: m[2],
        gain: opts.gain ?? (m[1] === 'amb' ? 0.5 : 0.9),
        // Standard-Vorlauf: zwei Wörter. Gleicht die Erkennungslatenz aus.
        lead: opts.lead ?? (m[1] === 'sfx' ? 2 : 0),
      },
    });
    last = m.index + m[0].length;
  }
  pushWords(text.slice(last));
  return items;
}

function build(raw) {
  const { meta, body } = parseFrontmatter(raw);
  const required = ['id', 'title', 'source', 'ageMin', 'ageMax', 'minutes'];
  for (const key of required) {
    if (!meta[key]) throw new Error(`Frontmatter-Feld fehlt: ${key}`);
  }

  const blocks = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseParagraph)
    .filter((items) => items.length > 0);

  return {
    id: meta.id,
    title: meta.title,
    subtitle: meta.subtitle || undefined,
    source: meta.source,
    ageMin: Number(meta.ageMin),
    ageMax: Number(meta.ageMax),
    minutes: Number(meta.minutes),
    categories: (meta.categories ?? '').split(',').map((c) => c.trim()).filter(Boolean),
    blocks,
  };
}

/*
 * Klang-Dateien einsammeln. Wer eine echte Aufnahme haben will, legt sie
 * einfach als public/sfx/<name>.mp3 ab - der Name entscheidet, welchen
 * synthetischen Klang sie ersetzt. Ohne dieses Verzeichnis laeuft alles
 * weiter wie bisher, nur eben synthetisch.
 *
 * Das Manifest existiert, damit die App nicht blind nach fünfzehn Dateien
 * fragen muss, von denen zwölf nicht da sind.
 */
const AUDIO = /\.(mp3|ogg|opus|m4a|wav|webm)$/i;

async function buildSampleManifest() {
  let entries = [];
  try {
    entries = await readdir(SFX);
  } catch {
    return 0; // Verzeichnis gibt es nicht - vollkommen in Ordnung.
  }
  const samples = entries
    .filter((f) => AUDIO.test(f))
    .map((file) => ({ name: file.replace(AUDIO, ''), file }))
    .sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(join(SFX, 'index.json'), JSON.stringify(samples), 'utf8');
  return samples.length;
}

const files = (await readdir(SRC)).filter((f) => f.endsWith('.md'));
await mkdir(OUT, { recursive: true });

const index = [];
for (const file of files) {
  const raw = await readFile(join(SRC, file), 'utf8');
  let story;
  try {
    story = build(raw);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    process.exitCode = 1;
    continue;
  }

  const words = story.blocks.flat().filter((i) => i.w).length;
  const cues = story.blocks.flat().filter((i) => i.c).length;

  await writeFile(join(OUT, `${story.id}.json`), JSON.stringify(story), 'utf8');
  const { blocks: _blocks, ...meta } = story;
  index.push(meta);
  console.log(`✓ ${story.id}  ${words} Wörter, ${cues} Cues, ~${story.minutes} min`);
}

index.sort((a, b) => a.title.localeCompare(b.title, 'de'));
await writeFile(join(OUT, 'index.json'), JSON.stringify(index), 'utf8');
const sampleCount = await buildSampleManifest();
console.log(`\n${index.length} Geschichte(n) gebaut.`);
console.log(sampleCount > 0
  ? `${sampleCount} echte Klang-Datei(en) gefunden - der Rest bleibt synthetisch.`
  : 'Keine Klang-Dateien in public/sfx/ - alles synthetisch.');
