# Echte Klänge einsetzen

Leg eine Audiodatei in dieses Verzeichnis, benenne sie nach dem Klang, und
führe `npm run content` aus. Fertig.

> **Die synthetischen Klänge sind abgeschaltet.** Wo keine Aufnahme liegt,
> bleibt es still. Lieber Stille als ein schlechter Klang – für Tierstimmen
> hat die Synthese nie getaugt, und halbgute Geräusche will hier niemand.
>
> Die Bibliothek zeigt an, wie viele der 52 Klänge geladen sind. Jede Datei
> wirkt sofort für sich; du musst nicht alles auf einmal besorgen.

Erlaubte Formate: `.mp3`, `.ogg`, `.opus`, `.m4a`, `.wav`, `.webm`

Die vollständige Liste aller benötigten Dateien mit Suchbegriffen steht in
[`EINKAUFSLISTE.md`](EINKAUFSLISTE.md).

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
