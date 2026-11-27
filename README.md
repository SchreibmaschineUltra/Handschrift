# Handschrift

Schreib dein Alphabet einmal mit Finger oder Stift, danach erscheint jeder getippte Text in deiner eigenen Handschrift.

Export als:
- **GoodNotes (radierbar)**: echte Kugelschreiber-Striche, in GoodNotes über *Neu → Importieren* öffnen
- **PDF** (Notability, Drucken)
- **PNG** und **PNG transparent**

Alles läuft im Browser, die Handschrift bleibt auf dem eigenen Gerät.

Der GoodNotes-Export nutzt [goodnotes-codec](https://github.com/Taylor-Nilsen/goodnotes-codec) (MIT-Lizenz, siehe `THIRD_PARTY_LICENSE-goodnotes-codec.txt`). Das Format ist inoffiziell nachgebaut; dieses Projekt ist nicht mit GoodNotes verbunden.

## Zugang nur mit persönlichem Link (Cloudflare Worker)

Auf Cloudflare läuft der Worker `src/worker.js` vor jeder Anfrage und lässt nur Besucher mit persönlichem Link herein; die Seite selbst liegt in `public/`.

- Jeder Freundes-Link (`/?k=…`) wird beim ersten Öffnen an dieses Gerät gebunden; auf anderen Geräten erscheint „Link schon vergeben“.
- Höchstens 15 Freundes-Links.
- Der Besitzer-Link (`/?k=` + `OWNER_TOKEN`) funktioniert auf allen Geräten und zeigt den Bereich „Freunde verwalten“.

Einstellungen: siehe `wrangler.toml` (KV-Speicher `DB`). Den geheimen `OWNER_TOKEN` im Dashboard unter Worker → Settings → Variables and Secrets eintragen.
