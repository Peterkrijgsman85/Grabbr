# Grabbr bouwen en releasen

## Vereisten

- Git
- Node.js **24.x** aanbevolen, gelijk aan de huidige GitHub Actions-flow
- npm (de bij Node 24 geleverde versie is geschikt)
- macOS voor macOS-artifacts; Windows voor Windows-artifacts

De builddependencies zijn exact gepind:

```text
Electron 45.4.1
electron-builder 26.18.1
```

`package-lock.json` hoort altijd samen met `package.json` te worden gecommit.

## Source lokaal testen

```bash
git checkout develop
npm ci --ignore-scripts
npm test
npm run check
```

Voor het daadwerkelijk starten van Electron vanuit source moeten de Electron-binaries beschikbaar zijn. Installeer zo nodig de dependencies inclusief scripts:

```bash
npm install
npm start
```

Gebruik voor een schone CI-/reviewcontrole altijd de gecommitte lockfile en verander dependencyversies niet impliciet.

## Handmatige platformbuilds

### macOS

Op Apple Silicon macOS:

```bash
npm install
npm test
npm run check
npm run dist:mac
```

De huidige configuratie maakt ZIP/DMG-output. Deze builds worden voor tests ad-hoc gesigned, maar zijn **niet Developer ID-signed en niet genotarized**. Gatekeeper kan daarom handmatige bevestiging vereisen.

### Windows

Op Windows x64:

```powershell
npm install
npm test
npm run check
npm run dist:win
```

Dit maakt een NSIS Setup en Portable executable. De huidige builds zijn niet Authenticode-signed.

## Releaseflow

1. Werk op `develop`.
2. Voer lokaal uit:
   ```bash
   npm test
   npm run check
   ```
3. Open een PR naar `develop` of laat de wijzigingen daar reviewen.
4. Merge de bevestigde commit naar de stabiele branch (`main`, `master` of `stable`).
5. Controleer dat `package.json` en `package-lock.json` dezelfde releaseversie bevatten.
6. Tag de stabiele commit:
   ```bash
   git checkout main
   git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
7. `.github/workflows/release.yml` voert tests uit en bouwt daarna parallel:
   - macOS arm64 op `macos-15`;
   - Windows x64 op `windows-latest`.
8. macOS wordt ad-hoc gesigned, strikt met `codesign` geverifieerd en met `ditto` verpakt.
9. Windows levert NSIS Setup en Portable.
10. De workflow maakt SHA-256-checksums en een **Draft Release** met gegenereerde notes.
11. Download en praktijktest alle artifacts.
12. Publiceer de draft handmatig wanneer de test is goedgekeurd.

De workflow publiceert nooit automatisch en faalt bij versieverschil, falende tests, verkeerde architectuur, ontbrekende artifacts of mislukte macOS-codesignverificatie.

## Repositorymetadata voor updatecontrole

Tijdens releasebuilds injecteert GitHub Actions `${{ github.repository }}` in `grabbr.githubRepository`. Dat is de enige bron voor de GitHub-knop en updatecontrole. Lokale bronbuilds zonder deze waarde tonen een niet-blokkerende melding dat updatecontrole niet is geconfigureerd.

## Geen automatische installatie

Grabbr gebruikt geen `electron-updater`. De app detecteert alleen releases. Download en installatie blijven handmatig.
