# GuteNacht

Vorlese-App nach dem Vorbild von [Readmio](https://www.readmio.com/): Du liest
laut vor, die App hört mit und legt im richtigen Moment Geräusche darunter.
Die App liest *nicht* selbst vor – das ist der ganze Punkt.

Gebaut für einen Dreijährigen, gelesen auf einem Android-Handy, ohne Backend.

## Stand

Phase 1 steht: Engine, Sound, Lese-Screen, eine vollständige Geschichte.

## Loslegen

```bash
npm install
npm run dev      # baut den Content und startet Vite
npm run build    # Produktions-Build nach dist/
```

Zum Testen auf dem Handy braucht es **HTTPS** – ohne das rückt kein Browser
das Mikrofon heraus. Am einfachsten über einen Netlify-Deploy; `netlify.toml`
liegt bei.

## Wie es funktioniert

### Alignment

Der Kern ist `src/engine/aligner.ts`. Er beantwortet eine einzige Frage: *Wo im
bekannten Text ist der Vorleser gerade?*

Kein freies Transkript-Matching – wir kennen den Text ja. Verglichen wird nur
gegen ein schmales Fenster ab der aktuellen Position, phonetisch (Kölner
Phonetik) statt buchstabengetreu. Jedes gehörte Wort stimmt für die Position ab,
die sich ergäbe, wenn es auf ein bestimmtes Textwort passt; der Peak gewinnt.

Zwei Regeln haben sich in der Simulation als entscheidend erwiesen:

- **Stillstand ist kein Fehlschlag.** Die Spracherkennung liefert wachsende
  Zwischenergebnisse, da bewegt sich die Position naturgemäß oft nicht.
- **Beweislast wächst mit der Sprungweite.** Wenn der Erkenner sieben Wörter
  gemeldet hat, kann der Vorleser nicht vierzig Wörter weiter sein. Ohne diese
  Regel reicht ein zufällig passendes Wort am Fensterrand, um die Geräusche der
  halben Geschichte auf einen Schlag auszulösen.

### Latenzausgleich

Erkenner melden ein Wort erst 0,3–1 Sekunde später. Deshalb hat jeder Cue ein
`lead`: er darf ein paar Wörter früher feuern. Standard sind zwei Wörter.

### Geräusche

Alle Klänge werden zur Laufzeit synthetisiert (`src/engine/sounds.ts`) – null
Bytes an Assets. Sollen später echte Aufnahmen rein, wird nur der Registry-
Eintrag getauscht; die Geschichten referenzieren bloß den Namen.

## Geschichten schreiben

Markdown in `content/`, Marker inline:

```markdown
---
id: bremer-stadtmusikanten
title: Die Bremer Stadtmusikanten
ageMin: 3
ageMax: 6
minutes: 4
source: Nach den Brüdern Grimm (gemeinfrei)
---

Und weil er sich so freute, schrie er ganz laut:{{sfx:esel}} „I-A! I-A!"
```

- `{{sfx:name}}` – einmaliger Effekt, optional `|gain=0.8|lead=3`
- `{{amb:name}}` / `{{amb-stop:name}}` – Kulisse an und aus

**Setz den Marker hinter die gut erkennbare Einleitung, nicht auf das
Lautmalerei-Wort selbst.** „I-A" versteht kein Erkenner zuverlässig; „schrie er
ganz laut" dagegen schon. Dann klingt der Esel genau dann, wenn du ihn nachmachst.

`npm run content` kompiliert nach `public/stories/`.

## Testen

```bash
npx esbuild test/simulate.ts --bundle --format=esm --platform=node \
  --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
```

Simuliert einen Vorleser mit fehlerhafter Spracherkennung und prüft, ob die Cues
an der richtigen Stelle feuern. Über `DROP`, `GARBLE`, `SEED` und `QUIET`
steuerbar.

Gemessene Grenze: stabil bis ~15 % verschluckte und ~30 % verhörte Wörter
(mittlere Abweichung 1–2 Wörter). Darüber franst es aus. Chrome auf Android
liegt bei ruhigem Vorlesen typisch bei 5–15 %.

## Bekannte Baustellen

- **Spracherkennung ist noch nicht offline.** Die Web Speech API schickt das
  Audio an Google und Chrome auf Android beendet die Sitzung eigenmächtig
  (`webSpeech.ts` startet sie deshalb laufend neu). Ersetzt wird das durch
  Vosk-WASM hinter demselben Adapter-Interface.
- Bibliothek, Kinderprofile, Offline-Downloads, Aufnahme/Hörbuch, Ausmalbilder
  und Statistik stehen noch aus.

## Rechtliches

Die Geschichten stammen aus gemeinfreien Quellen (Brüder Grimm, Andersen, Äsop)
und sind gekürzt und für kleine Kinder entschärft. Kein Text und kein Klang
stammt aus Readmio – nachgebaut ist die Idee, nicht der Inhalt.
