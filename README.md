# Grabbr

Grabbr is een screenshot- en annotatietool voor macOS en Windows. Leg een venster, scherm of vrij gekozen gebied vast, voeg visuele uitleg toe en kopieer of bewaar het resultaat. Grabbr draait als desktopapp met een macOS-menubalkmenu of Windows System Tray-menu en vereist geen account.

## Downloaden

Download de nieuwste testbuild via **[GitHub Releases](../../releases)**:

- **macOS Apple Silicon:** `Grabbr-<versie>-macOS-arm64.zip` of `.dmg`
- **Windows x64:** `Grabbr-<versie>-Windows-x64-Setup.exe` of `Portable.exe`
- **Integriteitscontrole:** `Grabbr-<versie>-SHA256SUMS.txt`

De huidige macOS- en Windows-builds zijn niet door een commerciële uitgever ondertekend. Lees daarom vóór installatie de platforminstructies hieronder.

## Belangrijkste functies

- Venster-, scherm- en gebiedscapture
- Cursorvrije venstercapture en transparante vensterschaduw
- Pijlen, lijnen, kaders, ellipsen, vrije pen, tekst en genummerde stappen
- Blur, pixelate en permanente redactie
- Annotaties selecteren, verplaatsen, resizen, kopiëren/plakken en aanpassen
- Undo/redo, crop en meerdere gelijktijdige annotatievensters
- Kopiëren als afbeelding naar het systeemklembord
- PNG met alpha of JPEG met instelbare kwaliteit
- Automatisch opslaan, eigen opslagmap en bestandsnaampatronen
- **OCR-tekst vastleggen:** selecteer een gebied en kopieer lokaal herkende tekst
- Configureerbare globale hotkeys
- macOS-menubalk en Windows System Tray, inclusief laatste screenshot en Instellingen
- Optionele autostart
- Handmatige en maximaal dagelijkse updatecontrole via GitHub Releases

Screenshots, annotaties en OCR-inhoud worden lokaal verwerkt. Alleen de updatecontrole haalt openbare releasemetadata van GitHub op; er is geen telemetrie of automatische upload.

## Ondersteunde platforms

| Platform | Huidige release-output |
|---|---|
| macOS | Apple Silicon arm64, unsigned/ad-hoc signed |
| Windows | x64 NSIS Setup en Portable |

Linux staat niet in de huidige geautomatiseerde releaseflow.

## Kernworkflow

1. Start een capture via Grabbr, de menubalk/System Tray of een globale hotkey.
2. Kies een venster of scherm, of sleep een gebied in de selectie-overlay.
3. Iedere screenshot opent in een zelfstandig annotatievenster.
4. Voeg annotaties toe en pas bestaande annotaties achteraf aan.
5. Kopieer de compositie, sla haar handmatig op of gebruik automatisch opslaan.

Voor OCR kies je **OCR-tekst vastleggen**, selecteer je een gebied en schrijft Grabbr de lokaal herkende platte tekst direct naar het systeemklembord. Er wordt geen annotatievenster geopend.

## Installeren op macOS

### 1. Download en plaats de app

1. Download de arm64-ZIP of DMG via [GitHub Releases](../../releases).
2. Pak de ZIP uit of open de DMG.
3. Plaats `Grabbr.app` in **Programma's / Applications**.

### 2. Gatekeeper bij een vertrouwde build

De huidige testbuilds zijn **niet gesigned met een Apple Developer ID en niet genotarized**. macOS kan daarom melden dat de ontwikkelaar niet kan worden gecontroleerd, of dat de app niet kan worden geopend.

Open alleen een build die je vertrouwt en waarvan je eventueel de SHA-256 met het releasebestand hebt gecontroleerd. Daarna:

1. Klik in Finder met rechts op `Grabbr.app` en kies **Open**.
2. Kies opnieuw **Open** in de waarschuwing.
3. Als die optie niet verschijnt: ga naar **Systeeminstellingen → Privacy en beveiliging**, zoek de melding over Grabbr en kies **Open toch**.

Bij de melding dat de app “beschadigd” is: download en pak de release opnieuw uit. Zie [Probleemoplossing](docs/TROUBLESHOOTING.md) voor de gecontroleerde vervolgstappen.

### 3. Schermopnametoestemming

Grabbr heeft macOS Screen Recording-toegang nodig voor screenshots:

1. Open **Systeeminstellingen → Privacy en beveiliging**.
2. Open **Scherm- en systeemaudio-opname** (op oudere macOS-versies: **Schermopname**).
3. Schakel Grabbr in.
4. **Sluit Grabbr volledig af**, ook via het menubalkmenu **Afsluiten**.
5. Start Grabbr opnieuw.

Alleen het venster sluiten is niet voldoende: Grabbr kan actief blijven in de menubalk.

Blijft een nieuwe ad-hoc build telkens toestemming vragen, verwijder dan de oude build, plaats de nieuwe build eerst in `/Applications`, reset de TCC-toestemming en autoriseer opnieuw. Concrete stappen staan in [Probleemoplossing](docs/TROUBLESHOOTING.md).

## Installeren op Windows

### Setup

1. Download `Grabbr-<versie>-Windows-x64-Setup.exe` via [GitHub Releases](../../releases).
2. Start de installer.
3. Als Microsoft Defender SmartScreen waarschuwt, controleer dan eerst dat het bestand van de vertrouwde Grabbr-release komt. Kies daarna **Meer informatie → Toch uitvoeren**.
4. Volg de installatiestappen en start Grabbr via het Startmenu.

### Portable

1. Download `Grabbr-<versie>-Windows-x64-Portable.exe`.
2. Bewaar het bestand in een vaste map.
3. Start het direct; installatie is niet nodig.

Verplaats een Portable-build niet voortdurend wanneer autostart is ingeschakeld: Windows registreert het actuele executable-pad.

## Menubalk, System Tray en hotkeys

Grabbr blijft beschikbaar via de macOS-menubalk of Windows System Tray, ook zonder open venster. Het menu bevat captureacties, OCR, **Laatste screenshot openen**, **Instellingen**, **Grabbr openen** en **Afsluiten**.

Standaardhotkeys:

| Actie | Sneltoets |
|---|---|
| Venster vastleggen | `Cmd/Ctrl + Shift + 2` |
| Gebied vastleggen | `Cmd/Ctrl + Shift + 3` |
| Scherm vastleggen | `Cmd/Ctrl + Shift + 4` |
| OCR-tekst vastleggen | `Cmd/Ctrl + Shift + 5` |

Je kunt deze aanpassen onder **Instellingen → Sneltoetsen**. Grabbr controleert conflicten bij registratie.

## Clipboard en opslaan

De zichtbare knop **Kopiëren** schrijft de volledige geannoteerde screenshot als afbeelding naar het systeemklembord. Met een geselecteerde annotatie kopieert `Cmd/Ctrl+C` die annotatie intern; `Cmd/Ctrl+V` plakt een duplicaat.

Onder **Instellingen → Vastleggen** configureer je:

- automatisch opslaan;
- opslagmap;
- PNG of JPEG en JPEG-kwaliteit;
- bestandsnaampatroon met tokens zoals `{date}`, `{time}`, `{type}` en `{counter}`;
- transparante vensterschaduw voor PNG.

Bestaande bestanden worden niet stil overschreven.

## Instellingen

- **Algemeen:** autostart, gedrag na kopiëren en Grabbr-vensters verbergen tijdens capture
- **Vastleggen:** vensterschaduw, opslaan, bestandsnaam en formaat
- **Sneltoetsen:** globale capture- en OCR-hotkeys
- **Editor:** standaard lijndikte, tekst-/stapgrootte en annotatieschaduw
- **Over:** versie, platform, architectuur, GitHub en updatecontrole

## Updates

Grabbr kan controleren of een nieuwere **gepubliceerde, niet-draft GitHub Release** beschikbaar is. Pre-releases worden standaard genegeerd.

- **Automatisch controleren op updates** staat standaard aan en gebeurt maximaal eenmaal per 24 uur.
- **Instellingen → Over → Nu controleren** voert direct een handmatige controle uit.
- **Bekijk release** opent de gevalideerde GitHub-releasepagina in je standaardbrowser.
- Grabbr **downloadt of installeert updates niet automatisch**. Installeren blijft handmatig via GitHub Releases.

Er wordt geen GitHub-token in de app opgeslagen en er is geen updatetelemetrie.

## Ontwikkelen

Zie:

- [Build- en release-instructies](docs/BUILDING.md)
- [Probleemoplossing](docs/TROUBLESHOOTING.md)
- [Changelog](CHANGELOG.md)
- [Technische architectuur](ARCHITECTURE.md)

## Licentie

Grabbr wordt geleverd onder de [MIT-licentie](LICENSE).
