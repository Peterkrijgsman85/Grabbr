# Grabbr

Grabbr is een screenshottool voor **macOS en Windows** met vensterselectie, fullscreen gebiedsselectie, een instelbare vensterschaduw en een uitgebreide annotatie-editor. De app gebruikt geen account, backend of cloudopslag.

> Status: functioneel prototype / uitbreidbare MVP-basis.

## Functies

- Vensterselectie met previews
- Cursorvrije window capture op macOS en Windows
- Fullscreen selectie-overlay voor gebiedscapture
- Dimming buiten de selectie, dubbele selectierand, hoekmarkeringen en live afmetingen
- Schermcapture
- Hoge-resolutie capture met thumbnailfallback
- Instelbare transparante schaduwrand rond vastgelegde vensters
- Pijl, lijn, rechthoek, ellips en vrije pen
- Moderne, afgeronde pijlen en ellipslijnen geïnspireerd op de meegeleverde Shottr-referentie
- Interactieve resize-handles voor pijlen, lijnen, kaders, ellipsen, blur, pixelate en stapnummers
- Tekst en automatisch oplopende stapnummers
- Blur, pixelate en permanente ondoorzichtige redactie
- Bijsnijden in de editor
- Selecteren, verplaatsen en verwijderen van annotaties
- Undo/redo met maximaal 50 stappen
- PNG met transparantie en JPEG
- Kopiëren naar het systeemklembord en opslaan als bestand
- Menubalk/system tray
- Tray-/menubalkoptie **Laatste screenshot openen** op macOS en Windows
- Configureerbare globale hotkeys voor venster, gebied en scherm
- Optionele native autostart op macOS en Windows, standaard uitgeschakeld
- Configureerbare standaard opslagmap met native folder picker
- Automatisch opslaan van nieuwe captures met unieke bestandsnamen en zonder stil overschrijven
- Ieder screenshot in een nieuw, onafhankelijk annotatievenster
- Betrouwbare PNG-kopie naar het native systeemklembord
- Geen netwerkverzoeken vanuit de app

## Cursorvrije window capture

Bij het vastleggen van een afzonderlijk venster gebruikt Grabbr primair de native window-snapshot van Electron `desktopCapturer`. Deze bron bevat geen muiscursor; Grabbr verwijdert de cursor dus niet achteraf uit pixels.

Als een platform de primaire snapshot niet kan leveren, gebruikt Grabbr een beveiligde streamfallback met de expliciete media-constraint `cursor: 'never'`. Wanneer het platform expliciet meldt dat toch een cursor wordt opgenomen, wordt die stream niet gebruikt en valt Grabbr terug op de cursorvrije bronthumbnail.

De Grabbr-editor en fullscreen selectie-overlay zijn daarnaast afgeschermd met native content protection, hebben herkenbare Grabbr-bronnamen en worden uit capturebronlijsten gefilterd. Daardoor kunnen de editor, bronkiezer en selectie-overlay niet per ongeluk als doel of als onderdeel van window capture worden gebruikt.

## Snel starten

Vereist: Node.js 22 of nieuwer en npm.

```bash
npm install
npm start
```

Of gebruik `start-macos.command` respectievelijk `start-windows.bat`.

## Standaardhotkeys

| Actie | Sneltoets |
|---|---|
| Venster vastleggen | `Ctrl/Cmd + Shift + 2` |
| Gebied vastleggen | `Ctrl/Cmd + Shift + 3` |
| Scherm vastleggen | `Ctrl/Cmd + Shift + 4` |

Open **Instellingen** in de titelbalk om deze combinaties te wijzigen. Klik in een veld en druk de gewenste combinatie. Grabbr controleert of de combinaties geldig, uniek en beschikbaar zijn. De instellingen worden bewaard in de gebruikersmap van de applicatie.

## Meerdere annotatievensters

Iedere nieuwe window-, screen- of area-capture opent altijd een afzonderlijk annotatievenster. Een bestaande screenshot wordt nooit vervangen. Elk venster heeft een eigen:

- bronbitmap;
- annotatielijst;
- selectie;
- undo/redo-history;
- crop- en schaduwstatus;
- zoomniveau.

Vanuit een annotatievenster kan opnieuw een capture worden gestart; het oorspronkelijke venster blijft daarbij ongewijzigd open. Annotatievensters worden in het hoofdproces apart geregistreerd en kunnen onafhankelijk worden gesloten.

## Kopiëren naar het klembord

De knop **Kopiëren** rendert eerst de volledige screenshot, schaduw en annotaties naar PNG-bytes zonder selectiehandles. Het hoofdproces:

1. valideert de PNG-signature;
2. maakt een native Electron-afbeelding van de bytes;
3. schrijft die afbeelding naar het macOS- of Windows-systeemklembord;
4. leest het klembord terug;
5. bevestigt dat breedte en hoogte exact overeenkomen.

Een fout wordt zichtbaar in het annotatievenster gemeld. Onder **Instellingen → Algemeen** staat de optie **Annotatievenster sluiten na kopiëren**. Deze staat standaard uit. Indien ingeschakeld wordt uitsluitend het venster waarin op **Kopiëren** is geklikt gesloten, en pas nadat het klembord de volledige afbeelding heeft bevestigd. Bij een kopieerfout blijft het venster open.

De renderer gebruikt nadrukkelijk niet `navigator.clipboard.write()` en krijgt via de preload ook geen algemeen clipboardobject. De enige beschikbare bridge is `writePngToClipboard(pngBytes)`, die één IPC-handler in het Electron main process aanroept.

De main-process service detecteert tijdens runtime of `electron.clipboard.writeImage`, `readImage` en `nativeImage.createFromBuffer` daadwerkelijk bestaan. Als deze Electron-API beschikbaar is, wordt deze eerst gebruikt en met readback geverifieerd. Als de runtime de API niet aanbiedt of de Electron-route faalt, gebruikt Grabbr automatisch een native fallback:

- macOS: AppKit `NSPasteboard` via de ingebouwde `/usr/bin/osascript` JXA-runtime, met ruwe PNG-bytes via stdin;
- Windows: PowerShell in STA-modus met `.NET System.Windows.Forms.Clipboard.SetImage/GetImage`, met base64-PNG via stdin.

Geen van beide fallbacks schrijft tijdelijke bestanden. Beide lezen het native clipboard terug en bevestigen de afbeeldingsafmetingen voordat succes wordt gemeld. Dit voorkomt de runtimefout `clipboard.write is not a function` en houdt de contextBridge klein.

## Laatste screenshot opnieuw openen

Het tray-/menubalkmenu bevat op macOS en Windows **Laatste screenshot openen**. Grabbr bewaart het pad van iedere automatisch of handmatig opgeslagen screenshot in de instellingen. De menuactie leest het bestand en opent het als een nieuw, onafhankelijk annotatievenster zonder het bestand opnieuw automatisch op te slaan.

Als nog niets is opgeslagen, het bestand is verwijderd of geen leesbare afbeelding bevat, toont Grabbr een duidelijke native melding. Andere vensters en de tray blijven actief.

## Eigenschappen, undo/redo en annotatieclipboard

Na selectie kunnen de volgende eigenschappen achteraf worden aangepast:

- lijndikte van pijl, lijn, kader, ellips en pen;
- tekstgrootte van tekstannotaties;
- kleur van bestaande annotaties.

Lijnannotaties hebben twee eindpunthandles. Hit-testing en coördinaten worden omgerekend vanuit de werkelijke canvas/CSS-verhouding, zodat resizen ook bij zoom en Retina/DPI-scaling correct blijft.

Undo/redo omvat toevoegen, verwijderen, verplaatsen, resizen, propertywijzigingen, plakken, schaduw en crop. Sneltoetsen:

- Undo: `Cmd+Z` / `Ctrl+Z`;
- Redo Windows/Linux: `Ctrl+Y`;
- Redo macOS: `Cmd+Shift+Z` en `Cmd+Y`.

Met een geselecteerde annotatie kopieert `Cmd/Ctrl+C` de annotatie intern. `Cmd/Ctrl+V` plakt een duplicaat met offset en behoudt alle eigenschappen. Zonder selectie blijft `Cmd/Ctrl+C` de volledige geannoteerde screenshot naar het systeemklembord kopiëren. Tekstinvoer behoudt het normale tekstclipboard.

## Transparante vensterschaduw

Schaduw is vereenvoudigd tot één schakelaar. Blur, offset en dekking zijn vaste, consistente waarden en worden niet meer als losse instellingen getoond. PNG-export en automatisch opslaan behouden echte alpha-transparantie rondom de schaduw. JPEG wordt uitgeschakeld zolang schaduw actief is, omdat JPEG geen alpha ondersteunt.

## Start met besturingssysteem

Onder **Instellingen → Algemeen** kan **Start met besturingssysteem** worden ingeschakeld. De optie staat standaard uit.

- Op macOS gebruikt Grabbr het native login-itemmechanisme van Electron/macOS.
- Op Windows registreert Grabbr het actuele executable-pad als login-item, zonder losse scripts of geplande taken.
- Bij uitschakelen wordt het login-item weer verwijderd.
- Grabbr leest de bevestigde status terug van het besturingssysteem en meldt het wanneer de wijziging niet is geaccepteerd.

## Automatisch opslaan

Nieuwe captures worden standaard automatisch als PNG opgeslagen in `Afbeeldingen/Grabbr`. In **Instellingen → Opslaan** kun je:

- automatisch opslaan in- of uitschakelen;
- met de native mapkiezer een andere standaardmap aanwijzen;
- de ingestelde map controleren voordat je opslaat.

Bestandsnamen bevatten datum, tijd tot op milliseconden en de naam van het venster of capturetype. Grabbr gebruikt een exclusieve bestandsaanmaak en voegt bij een zeldzame naamconflict automatisch een volgnummer toe. Een bestaand bestand wordt daardoor nooit stil overschreven.

## Annotaties achteraf aanpassen

Kies **Selecteer** en klik op een annotatie:

- pijlen krijgen een handle aan begin- en eindpunt;
- kaders en ellipsen krijgen acht handles voor hoeken en zijden;
- stapnummers krijgen vier proportionele hoekhandles;
- slepen binnen de selectie verplaatst de annotatie;
- `Delete` of `Backspace` verwijdert de selectie.

Bij het resizen van een stapnummer schalen badge en cijfer samen.

Blur- en pixelate-regio's krijgen dezelfde acht hoek- en zijhandles als kaders en ellipsen. Ze kunnen vrij worden verplaatst en in alle richtingen worden geresized. Na iedere wijziging samplet Grabbr de actuele regio opnieuw uit de originele screenshotbitmap. Een eerder verwerkte bitmap wordt nooit uitgerekt of opnieuw gefilterd, zodat opeenvolgend resizen geen cumulatief kwaliteitsverlies veroorzaakt.

## Gebied vastleggen

Gebiedscapture start direct een schermvullende overlay op het beeldscherm waar de muisaanwijzer staat:

1. Het scherm wordt vastgelegd voordat de overlay verschijnt.
2. De omgeving wordt verduisterd.
3. Sleep van de ene hoek naar de andere.
4. Tijdens het slepen blijven de selectie en afmetingen zichtbaar.
5. Laat de muisknop los om de uitsnede in de editor te openen.
6. Druk `Esc` of klik met rechts om te annuleren.

## macOS

Grabbr gebruikt op macOS een native `hiddenInset`-titelbalk. De verkeerslichtknoppen blijven native, terwijl de applicatieachtergrond doorloopt tot bovenaan. Alleen de daarvoor bedoelde titelbalkgebieden zijn draggable; captureknoppen, instellingen, canvas, toolbar en overige interactieve elementen zijn expliciet niet draggable.

Bouw op een Mac met:

```bash
npm install
npm test
npm run check
npm run dist:mac
```

De DMG en ZIP verschijnen in `release/`. Omdat de prototypebuild niet is ondertekend of genotariseerd, kan macOS hem blokkeren. Klik met rechts op Grabbr → **Open**, of gebruik **Systeeminstellingen → Privacy en beveiliging → Open toch**.

Geef daarna schermopnametoegang via **Systeeminstellingen → Privacy en beveiliging → Scherm- en systeemaudio-opname** en start de app opnieuw.

### Apple Silicon test-.app

`build-macos-arm64-test-app.sh` maakt een testbare `Grabbr.app` voor Apple Silicon zonder Node.js/npm-vereiste bij de eindgebruiker. De meegeleverde testbundle is unsigned en mag via **Privacy en beveiliging → Open toch** worden geaccepteerd.

Door netwerkblokkades in de Linux-bouwomgeving kon de officiële Electron arm64-runtime niet in het artifact worden ingebed. Een volledig offline zelfstandige Electron-bundle kon daardoor hier niet eerlijk worden geproduceerd. De test-.app downloadt daarom bij de eerste start de officiële Electron 45.4.1 arm64-runtime en bewaart hem onder `~/Library/Application Support/Grabbr`. Daarna wordt de gecachte runtime gebruikt. Voor de eerste start is dus internet nodig; Node.js en npm niet.

De runtimecontrole en extractie zijn in 0.7.2 opnieuw gericht herzien voor de fout `code has no resources but signature indicates they must be present`:

1. download van runtime én `SHASUMS256.txt`;
2. exacte SHA-256-controle op de verwachte archiefnaam;
3. vóór extractie wordt de ZIP getest en gecontroleerd op exact één top-level `Electron.app` en de verplichte `Contents/Resources`, `Contents/Frameworks`, `_CodeSignature/CodeResources`, executable en frameworkbinary;
4. extractie gebruikt macOS system `unzip`, dat de Unix-modebits en frameworksymlinks uit de officiële Electron-ZIP herstelt; de eerdere `ditto -x -k --rsrc`-route is verwijderd;
5. de launcher verifieert uitsluitend `$extracted/Electron.app` en zoekt niet langer met `find` naar een mogelijk gedeeltelijke of verkeerd geneste bundle;
6. een diagnostische preflight controleert dat Resources en Frameworks niet leeg zijn, `CodeResources` niet leeg is, het executable-bit aanwezig is en `Electron Framework.framework/Versions/Current` een symlink is;
7. de SHA-256 van het uitgepakte `CodeResources` moet exact gelijk zijn aan dezelfde entry in het ZIP-archief;
8. daarna volgen arm64/universal architectuurcontrole en een onverkorte `codesign --verify --deep --strict --verbose=4` op de complete ongewijzigde officiële Electron.app;
9. signing authority en TeamIdentifier worden gecontroleerd;
10. pas daarna wordt de Grabbr-payload toegevoegd en wordt de gewijzigde unsigned testbundle ad-hoc opnieuw verzegeld en geverifieerd.

De concrete melding betekent dat `_CodeSignature/CodeResources` vóór `codesign` ontbrak of niet op de verwachte bundlelocatie stond. Deze fout wordt niet geaccepteerd of omzeild: de nieuwe preflight stopt eerder met een specifieke ontbrekende-directory/bestand/symlinkdiagnose. Alleen een complete bundle gaat door naar Apple's codesign-verificatie.

Deze beperking staat ook in `Contents/Resources/TEST_BUILD.txt` in de bundle.

## Windows

Bouw op Windows met:

```powershell
npm install
npm test
npm run check
npm run dist:win
```

De NSIS-installer en portable build verschijnen in `release\`. Een ongetekende build kan een SmartScreen-waarschuwing geven.

## Architectuur

```text
main.js                 vensters, capture, overlay, hotkeys en export
preload.js              beperkte IPC-brug voor de editor
overlay-preload.js      beperkte IPC-brug voor gebiedsselectie
src/renderer.js         editorworkflow en instellingen
src/overlay.js          fullscreen selectie en bitmapuitsnede
src/canvas-engine.js    annotaties, schaduw en export
src/model.js            geometrie, hit-testing en history
src/hotkeys.js          validatie en toetsenbordconversie
src/startup.js          platformopties en statusnormalisatie voor autostart
src/capture-policy.js   cursorbeleid en uitsluiting van eigen capturevensters
src/clipboard-payload.js PNG-validatie en dimensiecontrole voor het klembord
src/system-clipboard.js main-process writeImage/readImage en foutnormalisatie
src/window-registry.js  registratie van onafhankelijke annotatievensters
src/annotation-settings.js standaard en normalisatie voor annotatievensteropties
src/tray-menu.js        gedeeld tray-/menubalkmenu voor macOS en Windows
src/recent-screenshot.js veilige resolutie van de laatste opgeslagen screenshot
```

Beide renderers draaien met `nodeIntegration: false`, `contextIsolation: true` en `sandbox: true`. De Content Security Policy blokkeert externe content en netwerkverbindingen.

Zie `ARCHITECTURE.md` voor ontwerpbeslissingen en uitbreidingspunten.

## Privacy en redactie

Grabbr verstuurt niets. Capturedata blijft in het procesgeheugen totdat een nieuwe capture wordt gemaakt of de app wordt afgesloten.

- **Blur/pixelate** zijn visuele verhullingen.
- **Redact** schrijft een ondoorzichtig vlak in de uiteindelijke gerasterde export.
- Exports worden volledig gerasterd; annotaties blijven niet als afzonderlijke objecten in PNG of JPEG staan.

## Bekende beperkingen

- De selectie-overlay wordt geopend op het beeldscherm waar de muisaanwijzer staat; één selectie kan nog niet over meerdere beeldschermen lopen.
- Scrolling capture en OCR zijn nog niet geïmplementeerd.
- Tekst, vrije pen en redact zijn verplaatsbaar, maar hebben nog geen afzonderlijke resize-handles.
- Geminimaliseerde, DRM-beveiligde of door het besturingssysteem afgeschermde vensters kunnen niet altijd worden vastgelegd.
- Bijsnijden start een nieuwe history-basis; undo herstelt de bitmap van vóór de crop niet.
- De applicatie is nog niet ondertekend of genotariseerd.
- De huidige Apple Silicon test-.app is een gerepareerde runtime-bootstrapbundle, geen volledig offline Electron-bundle; de eerste start vereist een download van de officiële Electron-runtime.

## Branding en iconen

- `assets/icon.svg` en `assets/icon.png`: paars sqircle-appicoon met alleen een witte **G**.
- `assets/icon.ico`: Windows-iconenset.
- `assets/icon.icns`: macOS-appicoon.
- `assets/trayTemplate.png` en `trayTemplate@2x.png`: monochrome macOS-template-iconen met transparant uitgesneden **G**. Electron markeert deze met `setTemplateImage(true)`, zodat macOS ze passend rendert in light en dark mode.

## Licentie

MIT. Zie `LICENSE`.
