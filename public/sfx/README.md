# Echte Klänge einsetzen

Leg eine Audiodatei in dieses Verzeichnis, benenne sie nach dem Klang, den sie
ersetzen soll, und führe `npm run content` aus. Fertig. Für alles, wofür keine
Datei da ist, springt weiter der Synthesizer ein – du kannst also einzeln
austauschen und musst nichts am Code oder an den Geschichten anfassen.

Erlaubte Formate: `.mp3`, `.ogg`, `.opus`, `.m4a`, `.wav`, `.webm`

## Dateinamen

Die Tiere zuerst – die sind synthetisch am schwächsten:

| Datei | Was es sein soll |
|---|---|
| `esel.mp3` | Eselschrei, „I-A" |
| `hund_bellen.mp3` | zwei, drei Mal bellen |
| `hund_jaulen.mp3` | langgezogenes Jaulen |
| `katze_miau.mp3` | ein einzelnes Miau |
| `hahn_kikeriki.mp3` | Hahnenschrei |
| `tier_krach.mp3` | alle vier gleichzeitig (oder du lässt den Synthesizer die Einzelklänge stapeln) |

Geräusche – hier ist der Synthesizer schon brauchbar, aber echte Aufnahmen sind besser:

| Datei | Was es sein soll |
|---|---|
| `tuer_knarr.mp3` | knarrende Tür |
| `fenster_klirr.mp3` | klirrendes Glas |
| `schritte.mp3` | vier, fünf Schritte |
| `poltern.mp3` | Poltern, Umfallen |
| `schnarchen.mp3` | zwei Atemzüge Schnarchen |
| `glitzern.mp3` | kleines Zauberglitzern zum Schluss |

Kulissen – laufen in der Endlosschleife, brauchen also einen sauberen Übergang:

| Datei | Was es sein soll |
|---|---|
| `bauernhof.mp3` | Tagatmosphäre, Vögel, leichter Wind |
| `wald_nacht.mp3` | Nachtwald, Grillen, Eule |
| `stube.mp3` | ruhiger Innenraum, Kaminknistern |

## Worauf du achten solltest

**Schneide die Stille am Anfang weg.** Das ist der wichtigste Punkt. Die ganze
Engine ist darauf ausgelegt, den Klang auf ein Zehntel Sekunde genau zu setzen –
eine halbe Sekunde Vorlauf in der Datei macht diese Arbeit zunichte.

**Gleiche die Lautstärken an.** Ein zu lauter Hahn nach einem leisen Esel reißt
das Kind aus der Geschichte. Grobe Richtung: alle Effekte ungefähr gleich laut,
Kulissen deutlich leiser.

**Halte die Effekte kurz**, eine halbe bis drei Sekunden. Alles Längere
überlappt mit dem Weiterlesen.

**Kulissen brauchen einen nahtlosen Übergang**, 20 bis 60 Sekunden. Wenn man
den Ansatzpunkt hört, hört man ihn alle 20 Sekunden.

Mono reicht völlig, und 128 kbit/s MP3 hört im Kinderzimmer niemand von 320
auseinander. Die ganze Sammlung sollte unter 2 MB bleiben, sonst dauert der
Start auf dem Handy.

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
- **[Mixkit](https://mixkit.co/free-sound-effects/)** – klein, kuratiert, frei.

Die Dateien hier **gehören ins Repo** – sonst fehlen sie beim Netlify-Build und
auf dem Handy läuft wieder alles synthetisch. Bei fünfzehn kurzen Klängen reden
wir über deutlich unter einem Megabyte, das tut keinem Repo weh.

Der Haken daran: Damit veröffentlichst du die Dateien auf GitHub. Achte also
darauf, dass die Lizenz das hergibt. Pixabay, Mixkit und CC0 von Freesound sind
unproblematisch. Bei BBC-Aufnahmen wird es heikel, wenn das Repo öffentlich ist –
dann lieber ein privates Repo, oder für diese Klänge eine andere Quelle nehmen.
