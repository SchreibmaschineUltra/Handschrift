# Handschrift

Schreib dein Alphabet einmal mit Finger oder Stift, danach erscheint jeder getippte Text in deiner eigenen Handschrift.

Export als:
- **GoodNotes (radierbar)**: echte Kugelschreiber-Striche, in GoodNotes über *Neu → Importieren* öffnen
- **PDF** (Notability, Drucken)
- **PNG** und **PNG transparent**

Alles läuft im Browser, die Handschrift bleibt auf dem eigenen Gerät.

Der GoodNotes-Export nutzt [goodnotes-codec](https://github.com/Taylor-Nilsen/goodnotes-codec) (MIT-Lizenz, siehe `THIRD_PARTY_LICENSE-goodnotes-codec.txt`). Das Format ist inoffiziell nachgebaut; dieses Projekt ist nicht mit GoodNotes verbunden.

## Exportkontingent (Cloudflare)

Läuft die Seite über Cloudflare Pages mit Cloudflare Access, begrenzt `functions/api/quota.js` die GoodNotes-Exporte pro Person und Woche (Montag bis Sonntag). PDF und PNG sind frei.

Einstellungen im Pages-Projekt:
- KV-Namespace als Binding `QUOTA`
- Variable `ADMINS`: E-Mail-Adressen ohne Limit, durch Komma getrennt
- Variable `LIMIT`: Exporte pro Woche (Standard 10)

Ohne `/api/quota` (z. B. auf GitHub Pages) gibt es kein Limit.
