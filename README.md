# Sternstunde

Vorlese-App für Kinder von drei bis sechs. **Du** liest laut vor, die App hört
mit und legt im richtigen Moment Geräusche und Musik darunter. Die App liest
nicht selbst vor – das ist der ganze Punkt.

Gebaut für die eigene Familie, gelesen auf einem Android-Handy, ohne Backend.

## Was drin ist

- **13 Geschichten**, je drei bis vier Minuten: sieben klassische Märchen
  (gemeinfrei, gekürzt und entschärft), eine Äsop-Fabel, fünf frei erfundene
- **39 Klänge und 13 Kulissen**, vollständig im Browser erzeugt
- **Hintergrundmusik**, die sich nie wiederholt, in sechs Stimmungen
- Bibliothek mit Filtern, Zufallsknopf und Farben nach Klangwelt

## Loslegen

```bash
npm install
npm run dev      # baut den Content und startet Vite
npm run build    # Produktions-Build nach dist/
```

Zum Testen auf dem Handy braucht es **HTTPS** – ohne das rückt kein Browser
das Mikrofon heraus.

## Wie es funktioniert

### Alignment

Der Kern ist `src/engine/aligner.ts`. Er beantwortet eine einzige Frage: *Wo im
bekannten Text ist der Vorleser gerade?*

Kein freies Transkript-Matching – wir kennen den Text ja. Verglichen wird nur
gegen ein schmales Fenster ab der aktuellen Position, phonetisch (Kölner
Phonetik) statt buchstabengetreu. Jedes gehörte Wort stimmt für die Position ab,
die sich ergäbe, wenn es auf ein bestimmtes Textwort passt; der Peak gewinnt.

Vier Regeln haben sich in der Messung als entscheidend erwiesen – jede davon
ist aus einem echten Fehlverhalten entstanden:

1. **Stillstand ist kein Fehlschlag.** Die Spracherkennung liefert wachsende
   Zwischenergebnisse, da bewegt sich die Position naturgemäß oft nicht.
2. **Beweislast wächst mit der Sprungweite.** Wer sieben Wörter gehört hat,
   kann nicht vierzig weiter sein.
3. **Vorwissen über den Leseablauf schlägt Mehrdeutigkeit.** Wörtliche
   Wiederholung ist in Geschichten für Dreijährige das Bauprinzip, nicht der
   Randfall – „Sie zogen und zogen" steht viermal gleichlautend im Text. Ohne
   diese Regel raste der Aligner bis zu 125 Wörter voraus.
4. **Rücksprünge stellen Klänge erst ab dreißig Wörtern wieder scharf.** Kleine
   Rücksprünge sind Korrekturen, keine Wiederholungen; sonst feuert derselbe
   Klang zweimal.

Gemessen: **1,7 Wörter mittlerer Positionsfehler** über alle 13 Geschichten,
stabil bis etwa zehn Prozent verschluckte und zwanzig Prozent verhörte Wörter.

### Klang

Zwei Wege, die App nimmt automatisch den besseren: Liegt unter `public/sfx/`
eine Datei mit passendem Namen, wird sie abgespielt. Sonst synthetisiert
`src/engine/sounds/` den Klang zur Laufzeit.

Ehrlich zur Reichweite der Synthese:

- **Brauchbar:** Wind, Regen, Feuer, Schritte, Türen, Maschinen. Das ist im
  Kern gefiltertes Rauschen.
- **Schwach:** alle Tierstimmen. Ein Kehlkopf ist kein Filter. Sie laufen über
  Formant-Synthese (`src/engine/voice.ts`) und klingen nach Trickfilm, nicht
  nach Tier. Hier lohnen echte Aufnahmen – siehe
  [`public/sfx/README.md`](public/sfx/README.md).

### Musik

`src/engine/music.ts` erzeugt fortlaufend neue Phrasen, statt eine Datei zu
wiederholen. Zwei Regeln schließen zusammen jede Dissonanz aus: Die Akkorde
sind alle leitereigen, und die Melodietöne stammen aus der Pentatonik, die auf
jeden dieser Akkorde passt. Deshalb darf der Zufall frei wählen.

Sechs Stimmungen – `ruhig`, `wald`, `nacht`, `meer`, `weltraum`, `hell` –, je
Geschichte im Frontmatter gesetzt. Sie unterscheiden sich in Tonlage,
Helligkeit und Ausklang, **nicht** in der Betriebsamkeit: Eine Vorlese-App am
Abend darf nirgends antreiben.

Das ist die Umkehrung des Tierstimmen-Problems: Eine weiche Klangfläche und ein
Glockenton sind genau das, was ein Oszillator mit Hüllkurve von Natur aus macht.

Die Musik läuft sehr leise und geht zurück, sobald gesprochen wird – die Stimme
steht vorn, und weniger Musik über den Lautsprecher heißt weniger Musik zurück
im Mikrofon. Im Lesekopf lässt sie sich zusätzlich auf leise oder aus stellen.

## Geschichten schreiben

Markdown in `content/`, Marker inline:

```markdown
---
id: die-riesenruebe
title: Die Riesenrübe
ageMin: 3
ageMax: 5
minutes: 3
music: ruhig
icon: 🥕
source: Russisches Volksmärchen (gemeinfrei)
---

Da freute sich die Katze und rief:{{sfx:katze_miau}} „Miau!"
```

- `{{sfx:name}}` – einmaliger Effekt, optional `|gain=0.8|lead=3`
- `{{amb:name}}` / `{{amb-stop:name}}` – Kulisse an und aus

**Setz den Marker hinter die gut erkennbare Einleitung, nicht auf das
Lautmalerei-Wort selbst.** „Miau" versteht kein Erkenner zuverlässig, „rief"
dagegen schon. Dann klingt die Katze genau dann, wenn du sie nachmachst.

`npm run content` kompiliert nach `public/stories/`.

## Prüfstände

Beide sind entstanden, weil sich das Wichtige hier nicht durch Hinschauen
prüfen lässt – und beide haben echte Fehler gefunden.

```bash
SP=/tmp
# Folgt die App dem Vorlesen? Simuliert fehlerhafte Spracherkennung.
npx esbuild test/simulate.ts --bundle --format=esm --platform=node --outfile=$SP/sim.mjs && node $SP/sim.mjs

# Klingen die Klänge plausibel? Rendert sie in echtem Chromium und misst nach.
npx esbuild test/render-entry.ts --bundle --format=iife --outfile=$SP/bundle.js && node test/render-sounds.mjs preview $SP/bundle.js
```

Der Klang-Prüfstand vergleicht Tonhöhenverlauf und Aussteuerung mit
bioakustischen Messwerten. Er hat unter anderem aufgedeckt, dass ein Türknarren
mit Spitze 0,06 faktisch stumm war – gehört hätte man es nie, weil es nie zu
hören war.

## Bekannte Baustellen

- **Spracherkennung ist noch nicht offline.** Die Web Speech API schickt das
  Audio an Google, und Chrome auf Android beendet die Sitzung eigenmächtig
  (`webSpeech.ts` startet sie deshalb laufend neu). Ersetzt wird das durch
  Vosk-WASM hinter demselben Adapter-Interface – das würde zusätzlich erlauben,
  die Echounterdrückung selbst zu setzen.
- Kinderprofile, Offline-Downloads, Aufnahme als Hörbuch und Ausmalbilder
  stehen noch aus.

## Rechtliches

Die klassischen Geschichten stammen aus gemeinfreien Quellen (Brüder Grimm,
Andersen, Äsop, Volksmärchen) und sind gekürzt und für kleine Kinder
entschärft. Die übrigen sind frei erfunden. Kein Text und kein Klang stammt aus
einer fremden App.
