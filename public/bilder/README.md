# Titelbilder

Ein Bild je Geschichte, benannt nach ihrer `id` (siehe `content/*.md`), als
`.webp` in 512 Pixeln. Wo keines liegt, zeigt die Bibliothek weiter das Emoji
aus dem Frontmatter – die App bricht nicht, sie bleibt nur bei dem, was sie hat.

## Wie ein neues Bild hierher kommt

1. Erzeugen nach `scripts/bild-motive.json`: dort stehen der gemeinsame Stil,
   das Modell und je Geschichte Szene und Farbrichtung. Der volle Prompt ist
   `szene + farben + stil`.
2. Die 1024er PNG in einen Rohordner legen, Dateiname = `id`.
3. `node scripts/bilder-aufbereiten.mjs <roh-ordner> 512`
4. `npm run content` – schreibt `index.json`, aus dem die Bibliothek liest.

## Warum nicht einfach das PNG ablegen

Ein erzeugtes Bild ist rund 2,4 MB. Einundzwanzig davon sind über fünfzig
Megabyte, und die Karte zeigt das Bild sechzig Pixel groß. Nach dem Verkleinern
sind es 45 bis 70 KB – der ganze Satz bleibt unter anderthalb Megabyte.

Das Aufbereiten schneidet außerdem gemalte Papierränder weg. Das Modell gibt
manchen Bildern einen hellen Rahmen mit runden Ecken und anderen nicht; neben
einem randlosen Bild sieht das aus wie ein Versehen. Erkannt wird er daran,
dass über neunzig Prozent einer Randzeile hell und farbarm sind – nicht daran,
dass die ganze Zeile einfarbig ist, denn der gemalte Rand ist ausgefranst.
