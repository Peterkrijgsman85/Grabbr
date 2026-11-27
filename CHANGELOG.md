# Changelog

Belangrijkste wijzigingen per ontwikkelrelease. Grabbr volgt nog geen formele stabiliteitsgarantie.

## 0.7.6

- Nieuw gebruikersgericht **Over**-scherm met dynamische versie, platform en architectuur.
- Updatebediening verplaatst naar Over.
- Veilige GitHub-knop op basis van dezelfde repositorymetadata als de updatechecker.
- Releaseworkflow blijft gericht op macOS arm64 en Windows x64 Draft Releases.

## 0.7.5

- Releaseworkflowtests losgekoppeld van een historisch macOS-runnerlabel; arm64- en dependencygaranties worden semantisch getest.
- macOS Vision OCR-runtimeketen, notificaties en diagnostische developmentlogging versterkt.

## 0.7.4

- Display-onafhankelijk annotatiecoördinatenstelsel voor Retina, mixed-DPI en editorzoom.
- Drie acties na kopiëren: openhouden, sluiten of minimaliseren.
- Zelfstandig instellingenvenster en automatisch sluiten van een leeg capture-hoofdvenster.
- Lokale OCR-tekstcapture via macOS Vision en Windows Media OCR.
- Detectie van nieuwe GitHub Releases zonder automatische download of installatie.
- Taggestuurde GitHub Draft Release-flow.

## 0.7.3

- Uitgebreide editorinstellingen, handmatige px-waarden en grotere stapannotaties.
- Tekst-resize, annotatieschaduw en opnieuw ingedeelde instellingen.
- Bestandsnaampatronen en configureerbare PNG/JPEG-output.
- Dynamische tray-/menubalkhotkeys en capturezichtbaarheid.

## 0.7.2

- Blur en pixelate volledig selecteerbaar, verplaatsbaar en resizebaar.
- Herberekening vanuit de originele screenshot om kwaliteitsverlies te voorkomen.
- Verbeterde macOS Electron-runtime-extractie en bundlepreflight voor testbuilds.

## 0.7.1

- Clipboardroutes met capability-detectie en native macOS/Windows-fallbacks.
- Robuustere multiwindow- en copy-closeflow.

## 0.7.0

- Moderne macOS hidden/inset-titelbalk.
- Verbeterde macOS-menubalklevenscyclus en Apple Silicon-testflow.

## 0.6 en eerder

- Fundament voor cross-platform capture, annotaties, vensterschaduw, gebiedsselectie, opslag, hotkeys en traybediening.
