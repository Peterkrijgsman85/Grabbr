# Distributiebuilds maken

## Vooraf

Installeer Node.js 22+ en voer in deze map `npm install` uit. Voor de eerste prototypeversie zijn signing-variabelen niet nodig.

## macOS-build

Voer dit op een Mac uit:

```bash
npm ci   # gebruik npm install zolang er nog geen package-lock is
npm test
npm run check
npm run dist:mac
```

Resultaat: een DMG en ZIP in `release/`. De build is niet ondertekend of genotariseerd. Accepteer hem handmatig via Privacy en beveiliging. Geef daarna schermopnametoegang en start de app opnieuw.

Voor de source-only Apple Silicon testbundle kan ook worden gebruikt:

```bash
./build-macos-arm64-test-app.sh
```

Dit maakt `release-test/Grabbr.app`. Deze bootstrapbundle vereist geen Node.js/npm op de test-Mac, maar downloadt bij de eerste start de officiële Electron arm64-runtime, controleert de officiële SHA-256, valideert de volledige ZIP-layout, extraheert met system `unzip`, controleert Resources/Frameworks/CodeResources/symlinks en verifieert daarna de Developer ID-signatuur. Vervolgens injecteert hij de Grabbr-payload en verzegelt de gewijzigde testbundle ad-hoc opnieuw. Gebruik `npm run dist:mac` op een Mac met geïnstalleerde dependencies voor een volledig offline Electron-bundle.

## Windows-build

Voer dit op Windows uit:

```powershell
npm install
npm test
npm run check
npm run dist:win
```

Resultaat: een NSIS-installer en portable executable in `release\`. De build is niet ondertekend en kan daarom SmartScreen activeren.

## Waarom op het doelplatform bouwen?

De JavaScript-bron is gedeeld, maar DMG-, NSIS- en platformmetadata worden het betrouwbaarst op het bijbehorende besturingssysteem gemaakt. Zet later eventueel een CI-matrix op met `macos-latest` en `windows-latest`.

## Later ondertekenen

- macOS: Apple Developer ID Application, hardened runtime en notarization toevoegen.
- Windows: Authenticode-certificaat instellen via electron-builder.

De huidige `package.json` schakelt hardened runtime bewust uit voor de ongetekende prototypebuild.
