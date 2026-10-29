# Schreibmaschine

Ein 3D-Schreibmaschinen-Simulator im Browser. Man tippt auf der echten Tastatur –
Tasten, Typenhebel, Farbband und Wagen bewegen sich wie bei einer echten Reiseschreibmaschine,
dazu Originalklänge, Glocke und Wagenrücklauf.

## Entwicklung

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Typprüfung + Produktionsbuild nach dist/
npm run preview   # Produktionsbuild lokal ansehen (http://localhost:4173/schreibmaschine/)
```

## Bedienung

| Taste | Funktion |
|---|---|
| Zeichen | Anschlag |
| Enter | Wagenrücklauf + Zeilenschaltung |
| Rücktaste | Rückschritt (Überschreiben möglich) |
| Tab | Tabulator |
| Umschalt / Feststelltaste | Großbuchstaben |

## Technik

Vite · TypeScript · Three.js · postprocessing · Web Audio API · vite-plugin-pwa.
Planung und Roadmap: [`plan.md`](plan.md) · Änderungen: [`CHANGELOG.md`](CHANGELOG.md).

## Lizenzen

- Klänge: siehe [`public/sounds/LICENSES.md`](public/sounds/LICENSES.md) (CC BY 3.0 / CC BY 4.0 / CC0)
- Schrift: Special Elite (Apache 2.0) über `@fontsource/special-elite`
