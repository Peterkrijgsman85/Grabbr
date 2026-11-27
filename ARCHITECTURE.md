# Grabbr architectuur

## Processen

- **Electron main process (`main.js`)**: vensters, tray/menu, globale hotkeys, captures, instellingen, opslag, clipboard, OCR, notificaties en updatecontrole.
- **Editorrenderer (`src/renderer.js`)**: UI, annotatie-interactie, documenthistory en instellingenpresentatie.
- **Selectie-overlay (`src/overlay.js`)**: gebiedsselectie voor screenshots en OCR.
- **Preloads**: smalle, expliciete IPC-bridges met `contextIsolation: true`, `nodeIntegration: false` en sandboxing.

## Capture en documenten

Window capture gebruikt eerst een cursorvrije native windowsnapshot. Screen- en area-capture gebruiken Electron desktop capture. Grabbr-vensters kunnen tijdens capture worden verborgen of juist selecteerbaar blijven.

Iedere capture opent een eigen annotatievenster. Een document gebruikt logische coördinaten (`coordinateVersion: 2`) die onafhankelijk zijn van DPR, bitmapresolutie en editorzoom. Export projecteert eenmaal naar de fysieke bitmapresolutie.

## Annotaties

De canvas-engine bewaart vectorachtige annotatieobjecten voor lijnen, pijlen, kaders, ellipsen, pen, tekst, stappen, blur, pixelate en redact. Eigenschappen en geometrie blijven bewerkbaar. Blur en pixelate worden na iedere wijziging opnieuw uit de originele bitmap berekend.

Undo/redo bewaart scenes per annotatievenster. Het interne annotatieclipboard staat los van het systeemclipboard.

## Clipboard

De renderer levert gevalideerde PNG-bytes via IPC. Het main process gebruikt Electron `clipboard` wanneer beschikbaar en lokale macOS/Windows-fallbacks wanneer nodig. Schrijven wordt met readback gecontroleerd voordat sluiten of minimaliseren mag plaatsvinden.

## OCR

OCR gebruikt dezelfde gebiedsselectie als area capture, maar opent geen editor. macOS gebruikt lokaal Vision; Windows gebruikt lokaal `Windows.Media.Ocr`. Alleen niet-lege, genormaliseerde tekst wordt naar het clipboard geschreven en teruggelezen. Resultaten en fouten worden als native notificatie gemeld.

## Instellingen

`settings-schema.js` migreert oudere instellingen naar secties voor Algemeen, Vastleggen, Sneltoetsen, Editor en Over. De updatebediening staat in Over. De instellingen worden in Electron `userData` bewaard en naar open vensters gebroadcast.

## Updatecontrole

Grabbr gebruikt de publieke GitHub Releases API zonder token. Pure modules verzorgen semver, draft/pre-releasefiltering, 24-uursinterval en URLvalidatie. De app downloadt of installeert geen updates.

De releaseworkflow injecteert de daadwerkelijke `${{ github.repository }}` in de gebouwde metadata. Zowel updatecontrole als GitHub-link gebruiken deze ene bron.

## Releasebouw

`.github/workflows/release.yml` start alleen op een versie-tag op stabiele code. Tests lopen eerst; daarna bouwen native macOS-arm64- en Windows-x64-jobs. macOS wordt ad-hoc gesigned en strikt geverifieerd. De workflow maakt checksums en een Draft Release die handmatig moet worden gepubliceerd.

Zie [docs/BUILDING.md](docs/BUILDING.md) voor de operationele flow.
