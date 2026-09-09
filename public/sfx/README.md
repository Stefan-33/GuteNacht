# Echte Klänge einsetzen

Leg eine Audiodatei in dieses Verzeichnis, benenne sie nach dem Klang, den sie
ersetzen soll, und führe `npm run content` aus. Fertig. Für alles, wofür keine
Datei da ist, springt weiter der Synthesizer ein – du kannst also einzeln
austauschen und musst nichts am Code oder an den Geschichten anfassen.

Erlaubte Formate: `.mp3`, `.ogg`, `.opus`, `.m4a`, `.wav`, `.webm`

## Wo sich der Aufwand am meisten lohnt

Die Synthese ist nicht überall gleich schwach. Hier die ehrliche Einschätzung,
damit du deine Zeit nicht an der falschen Stelle investierst:

**Lohnt sich am meisten – Tiere.** Ein Tierlaut entsteht in einem Kehlkopf, und
das lässt sich mit Filtern nur annähern.

| Datei | Was es sein soll |
|---|---|
| `esel.mp3` | Eselschrei, „I-A" |
| `hund_bellen.mp3` | zwei, drei Mal bellen |
| `hund_jaulen.mp3` | langgezogenes Jaulen |
| `katze_miau.mp3` | ein einzelnes Miau |
| `hahn_kikeriki.mp3` | Hahnenschrei |
| `schwein_grunz.mp3` | zwei, drei Mal grunzen |
| `kuh_muh.mp3` | ein langes Muh |
| `schaf_maeh.mp3` | Blöken |
| `maus_piep.mp3` | ein paar hohe Piepser |
| `loewe_bruell.mp3` | Löwengebrüll |
| `eule_ruf.mp3` | zwei Eulenrufe |
| `moewe.mp3` | Möwenschreie |
| `wal_ruf.mp3` | Walgesang, lang und tief |
| `drache_brumm.mp3` | tiefes Grollen (erfunden – ein großer Löwe tut es auch) |
| `tier_krach.mp3` | alle vier Stadtmusikanten gleichzeitig |

**Lohnt sich noch – menschliche Laute.** Gleicher Grund.

| Datei | Was es sein soll |
|---|---|
| `gaehnen.mp3` | ein herzhaftes Gähnen |
| `hau_ruck.mp3` | Ächzen beim Ziehen, zweimal |
| `schluckauf.mp3` | zwei Hickser |
| `schnarchen.mp3` | zwei Atemzüge Schnarchen |

**Lohnt sich kaum – Geräusche.** Das ist im Kern gefiltertes Rauschen, und das
kann Web Audio gut. Tausch sie nur aus, wenn dir etwas konkret missfällt.

`schritte` · `poltern` · `klopfen` · `plumps` · `tuer_knarr` · `fenster_klirr` ·
`uhr_ticken` · `knabbern` · `rollen` · `blubbern` · `brutzeln` ·
`feuer_knistern` · `donner` · `wind_boe` · `pusten` · `wasser_platsch` ·
`sternenfall` · `glitzern` · `bagger_motor` · `rakete_start` · `drache_feuer`

**Kulissen** laufen in der Endlosschleife und brauchen deshalb einen nahtlosen
Übergang, 20 bis 60 Sekunden lang:

`bauernhof` · `wald_tag` · `wald_nacht` · `stube` · `savanne` · `baustelle` ·
`nacht_stadt` · `hoehle` · `wind_hoehe` · `regen` · `weltraum` ·
`sternenhimmel` · `unterwasser`

## Worauf du achten solltest

**Schneide die Stille am Anfang weg.** Das ist der wichtigste Punkt. Die ganze
Engine ist darauf ausgelegt, den Klang auf ein Zehntel Sekunde genau zu setzen –
eine halbe Sekunde Vorlauf in der Datei macht diese Arbeit zunichte.

**Um die Lautstärke musst du dich nicht kümmern.** Der Pegelabgleich in
`src/engine/sounds/index.ts` gilt nur für synthetische Klänge; echte Aufnahmen
werden unverändert abgespielt. Trotzdem hilft es, wenn sie untereinander
ungefähr gleich laut sind.

**Halte die Effekte kurz**, eine halbe bis drei Sekunden. Alles Längere
überlappt mit dem Weiterlesen.

Mono reicht völlig, und 128 kbit/s MP3 hört im Kinderzimmer niemand von 320
auseinander.

## Woher nehmen

- **[Pixabay](https://pixabay.com/sound-effects/)** – ohne Konto, ohne
  Namensnennung, direkter Download. Der schnellste Weg.
- **[BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/)** – 33.000
  Archivaufnahmen in bester Qualität. **Nur privat und für Bildungszwecke
  erlaubt.** Für die eigene Familie in Ordnung, für einen Store nicht.
- **[Freesound](https://freesound.org/)** – die größte Sammlung. Konto nötig,
  und unbedingt **auf CC0 filtern**, sonst holst du dir Auflagen ins Haus.
- **[Zapsplat](https://www.zapsplat.com/)** – sehr gute Tierkategorie. Gratis
  mit Namensnennung.

Die Dateien hier **gehören ins Repo** – sonst fehlen sie beim Netlify-Build und
auf dem Handy läuft wieder alles synthetisch. Bei vierzig kurzen Klängen reden
wir über wenige Megabyte.

Der Haken daran: Damit veröffentlichst du die Dateien auf GitHub. Achte also
darauf, dass die Lizenz das hergibt. Pixabay, Mixkit und CC0 von Freesound sind
unproblematisch. Bei BBC-Aufnahmen wird es heikel, wenn das Repo öffentlich ist –
dann lieber ein privates Repo, oder für diese Klänge eine andere Quelle nehmen.
