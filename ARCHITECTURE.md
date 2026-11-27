# Grabbr-architectuur

## Ontwerpdoelen

1. **Zelfstandig en voorspelbaar:** geen accounts, uploads, analytics of backend.
2. **Gedeelde editor:** alle annotatie- en exportlogica is platformonafhankelijk.
3. **Vervangbare capturelaag:** Electron `desktopCapturer` is de eerste backend; ScreenCaptureKit en Windows.Graphics.Capture kunnen later als native modules worden toegevoegd.
4. **Niet-destructief tot export:** annotaties blijven scene-objecten en worden pas bij kopiëren of opslaan gerasterd.
5. **Veilige renderer:** context isolation, sandbox en een kleine IPC-whitelist.

## Datamodel

Een document bestaat uit:

- een onveranderlijke bitmap (`baseDataUrl` / `Image`);
- frame-instellingen voor schaduw en achtergrond;
- een geordende lijst annotaties;
- een history van scene-snapshots.

Vanaf 0.7.4 bevat een scene `coordinateVersion: 2` en een `coordinateSpace` met logische en bitmapafmetingen plus `scaleX/scaleY`. `coordinate-space.js` is de enige plek voor logisch↔bitmap, client↔logisch en exportprojecties. De canvas heeft intrinsieke bitmapafmetingen, terwijl de CSS-afmetingen uit logische documentafmetingen en editorzoom komen. Hierdoor wordt DPR nooit tweemaal toegepast. `normalizeLegacyScene()` deelt 0.7.3-bitmapcoördinaten éénmalig door de vastgelegde schaal.

Capturepayloads dragen waar mogelijk de display-scale mee. De area-overlay stuurt expliciet bitmap- én logische selectieafmetingen. Mixed-DPI-monitorverplaatsing verandert daardoor alleen CSS-layout, nooit annotatiegegevens.

Annotatiecoördinaten zijn relatief aan de oorspronkelijke bitmap. De schaduwmarge wordt alleen tijdens rendering toegevoegd. Daardoor verschuiven annotaties niet wanneer de gebruiker blur, offset of dekking van de schaduw aanpast.

Ondersteunde annotatietypen:

- `pen`: puntenlijst;
- `line`, `arrow`, `rect`, `ellipse`: begin- en eindpunt;
- `text`: positie, tekst en fontgrootte;
- `step`: positie, radius en nummer;
- `blur`, `pixelate`, `redact`: rechthoekige regio.

## Renderpipeline

1. Bereken transparante marge uit schaduwblur en offset.
2. Maak de canvas exact zo groot als bitmap plus marge.
3. Teken een optionele witte achtergrond.
4. Teken de bitmap met Canvas 2D-drop-shadow.
5. Teken annotaties in volgorde.
6. Teken alleen in editorweergave selectie- en cropoverlays.
7. Render voor export nogmaals zonder editoroverlays.

Blur en pixelate gebruiken nooit een momentopname van een eerder verwerkte canvas. `obscure-render.js` rekent de actuele annotatierechthoek terug naar originele screenshotpixels. De canvas-engine samplet vervolgens opnieuw uit `this.image`: blur gebruikt een vergrote bronregio voor nette filterranden; pixelate maakt een nieuw laagresolutiesample en tekent dat zonder smoothing. Daardoor levert iedere move of resize een verse render zonder uitrekken of cumulatief kwaliteitsverlies.

## Captureflow

1. Main process vraagt via `desktopCapturer` scherm- of vensterbronnen op met lichte previews.
2. Renderer toont de bronkiezer.
3. Na selectie autoriseert het main process precies die bron eenmalig via de display-media-handler; de renderer neemt vervolgens een frame op volledige resolutie via een `getDisplayMedia`-stroom.
4. Als die route niet beschikbaar is, vraagt de renderer een hoge-resolutiebron op via het main process.
5. De mediasporen worden onmiddellijk gestopt.
6. Voor vensters staat de schaduwrand standaard aan; voor schermen en gebieden uit.

### Cursorbeleid en self-exclusion

Window capture gebruikt eerst `desktopCapturer` met een windowbron en een grote thumbnailmaat. Deze OS-window-snapshot bevat geen cursor en vormt daarom de primaire pipeline op macOS en Windows. De getDisplayMedia-route is alleen fallback en krijgt `cursor: 'never'`; als `MediaStreamTrack.getSettings()` expliciet een ander cursorbeleid teruggeeft, wordt de stream afgewezen.

`src/capture-policy.js` centraliseert het beleid en is met unit-tests afgedekt. Zowel het editorvenster als de selectie-overlay gebruiken `setContentProtection(true)`. Eigen bronnen hebben namen die met `Grabbr` beginnen en worden tijdens bronenumeratie én vlak voor het vastleggen opnieuw geweigerd. Dit voorkomt dat verouderde bron-ID's of de overlay zelf in een window capture terechtkomen.

## Uitbreidingspunten

### Native capturebackends

Voeg achter dezelfde preload-interface platformmodules toe:

- macOS: Swift/Objective-C-module met ScreenCaptureKit;
- Windows: C++/Rust-module met Windows.Graphics.Capture;
- selectie van UI-elementen: Accessibility API respectievelijk UI Automation.

De renderer hoeft alleen een PNG/data-URL en bronnaam te ontvangen.

### Scrolling capture

Aanbevolen als afzonderlijke module:

- frame capture;
- programmeerbare scrollactie;
- overlapanalyse;
- detectie en maskering van sticky regions;
- stitcher met foutgrenzen.

### Documentbestanden

Voor bewerkbare sessies kan het scene-model als JSON naast een PNG worden opgeslagen. Gebruik dan verwijzingen of gecomprimeerde blobs om te voorkomen dat elke history-state dezelfde bitmap dupliceert.

### Pluginmodel

Nieuwe tools kunnen worden toegevoegd met een object dat `pointerDown`, `pointerMove`, `pointerUp`, `draw`, `bounds` en `serialize` implementeert. Het huidige prototype houdt dit bewust nog in één enginebestand, zodat het gedrag eerst stabiel kan worden gemaakt.

## Beveiligingsgrenzen

- Geen remote content.
- CSP: `connect-src 'none'`.
- Geen Node.js in de renderer.
- Alleen vooraf gedefinieerde IPC-methoden.
- Bestandsnamen worden door de native opslaan-dialoog gekozen.
- Geen stille uploads of automatische cloudintegraties.

## Fullscreen selectie-overlay

Gebiedscapture is gescheiden van de hoofdeditor:

1. Het hoofdvenster wordt verborgen.
2. Het scherm onder de muisaanwijzer wordt vóór opening van de overlay vastgelegd.
3. Een frameloos, always-on-top overlayvenster bedekt exact dat beeldscherm.
4. `overlay.js` tekent de schermafbeelding, dimming en selectiegrenzen op een canvas.
5. De geselecteerde bronpixels worden op oorspronkelijke resolutie uitgesneden.
6. Alleen de PNG-data wordt naar de editor teruggestuurd; de overlay wordt direct gesloten.

`overlay-preload.js` geeft de overlay uitsluitend drie acties: initialisatie ontvangen, selectie voltooien en annuleren.

## Globale hotkeys

`src/hotkeys.js` bevat platformonafhankelijke validatie, standaardwaarden en conversie van toetsenbordevents naar Electron accelerators. Het main process registreert alle drie combinaties atomair: als één combinatie bezet is, worden de vorige instellingen hersteld. Geldige instellingen worden als JSON in Electron `userData` bewaard.

## Resize-model

`src/model.js` levert zuivere functies voor resize-handles, handle-hit-testing en geometrische transformaties. De canvas-engine gebruikt deze functies voor:

- pijl: onafhankelijk begin- en eindpunt;
- lijn: onafhankelijk begin- en eindpunt;
- rechthoek en ellips: vier hoek- en vier zijhandles;
- blur en pixelate: vier hoek- en vier zijhandles;
- stapnummer: proportionele radius- en fontschaling vanuit vier hoeken.

Een resize begint altijd met een diepe kopie van de oorspronkelijke annotatie. Tijdens pointerbewegingen wordt de nieuwe geometrie daarvan afgeleid, zodat er geen cumulatieve afrondingsfouten ontstaan. De volledige interactie wordt als één history-stap opgeslagen.

CSS-pointercoördinaten worden via de werkelijke canvas/CSS-verhouding en schaduwmarge naar documentcoördinaten omgerekend. Dezelfde mapping voedt handle-hit-testing bij zoom, Retina en Windows-DPI-scaling. Blur/pixelate move- en resizecommits gebruiken de normale scene-history en zijn daardoor volledig undo/redo-baar.

## Opslagbeleid

De opslagmap en auto-savekeuze staan naast de hotkeys in `settings.json`. De standaardmap is `Pictures/Grabbr`. Automatische exports gebruiken PNG, een tijdstempel tot op milliseconden en een opgeschoonde bronnaam. Het main process schrijft met de exclusieve `wx`-vlag en probeert bij `EEXIST` een volgnummer; bestaande bestanden worden niet overschreven.

## Native autostart

`src/startup.js` houdt platformdetectie en login-itemopties zuiver en testbaar. Het main process voert de mutatie uit met `app.setLoginItemSettings()` en leest daarna de werkelijk bevestigde status terug met `app.getLoginItemSettings()`.

- macOS gebruikt het login-item voor de gebundelde `.app`.
- Windows gebruikt `process.execPath` met een lege argumentenlijst, zodat precies de geïnstalleerde Grabbr-runtime wordt gestart.
- Linux wordt expliciet als niet ondersteund gemarkeerd.
- De voorkeur is standaard `false` en wordt samen met hotkeys en opslag in `settings.json` bewaard.

## Iconen

Het hoofdicoon is beschikbaar als SVG, PNG, ICO en ICNS. Voor de macOS-menubalk gebruikt het main process een afzonderlijk 18/36-pixel template-icoon. Dit icoon is monochroom en gebruikt uitsluitend alpha-informatie: de sqircle is de templatevorm en de G is transparant uitgesneden. `setTemplateImage(true)` laat macOS de uiteindelijke kleur voor light/dark mode bepalen.

## macOS titlebar en vensterlevenscyclus

Alle normale Grabbr-vensters gebruiken op macOS `titleBarStyle: 'hiddenInset'`, `titleBarSeparatorStyle: 'none'` en een vaste `trafficLightPosition`. De HTML-titelbalk gebruikt dezelfde `--bg` als de app. De balk zelf en het merkgebied zijn draggable; knoppen, inputs, links, captureacties en headeracties zijn `no-drag`. Canvas en toolbars liggen buiten de drag-regio.

`WindowLifecyclePolicy` voorkomt dat het programmatisch sluiten van een annotatievenster na succesvol kopiëren een direct macOS `activate`-event omzet in een leeg hoofdvenster. `activate` toont uitsluitend een reeds bestaand hoofdvenster en maakt nooit zelf een venster. `window-all-closed` sluit de app niet zolang de tray/menubalk bestaat. Daardoor blijven hotkeys en traycapture beschikbaar zonder zichtbaar venster.

## macOS arm64 testbundle

De reproduceerbare builder `build-macos-arm64-test-app.sh` maakt een geldige `.app`-structuur met Info.plist, Grabbr.icns, bronpayload en een executable launcher. Omdat de officiële Electronbinary niet door het netwerkbeleid van de Linux-bouwomgeving kon worden opgehaald, downloadt de launcher Electron 45.4.1 arm64 bij de eerste start. De bundle vereist geen Node.js of npm, maar is niet volledig offline.

De verificatie kent twee verschillende trustfasen:

1. **Officieel artifact:** archivehash uit `SHASUMS256.txt`, architectuur, sealed root, nested codeobjecten, Developer ID authority en TeamIdentifier worden gecontroleerd vóór iedere wijziging.
2. **Grabbr-testbundle:** het toevoegen/vervangen van `Contents/Resources/app` wijzigt de resource seal. Na deze bewuste wijziging wordt de testbundle daarom ad-hoc opnieuw ondertekend en met `codesign --verify --deep --strict` gecontroleerd. Dit vervangt niet de voorafgaande controle op de officiële Electron-signatuur.

De eerdere launcher onderdrukte codesign-output en wijzigde de Electron-bundle na verificatie zonder opnieuw te verzegelen. Dat kon een geldige officiële download later als onbruikbare bundle laten eindigen. De nieuwe launcher valideert de daadwerkelijke ZIP-resources en symlinks vóór codesign, geeft de laatste verificatiediagnostiek weer en scheidt officiële verificatie van testbundlesigning.

### Electron ZIP-layout en extractiepreflight

De officiële Darwin-ZIP wordt vóór extractie geïnspecteerd met `unzip -tq` en `unzip -Z1`. De launcher vereist exact één top-level `Electron.app/Contents/MacOS/Electron` en expliciete entries voor `Info.plist`, `_CodeSignature/CodeResources`, `Resources/default_app.asar` en het versioned Electron Framework-executable. Hierdoor wordt nooit een geneste helperapp of gedeeltelijke directorylaag gekozen.

Extractie gebruikt `/usr/bin/unzip -q`, omdat de Electron-release-ZIP executable modes en frameworksymlinks als standaard Unix ZIP-attributen bevat. Na extractie wordt exact `$extracted/Electron.app` gebruikt. De preflight controleert directoryinhoud, execute-bit, de `Versions/Current`-symlink en vergelijkt de SHA-256 van het uitgepakte `CodeResources` byte-for-byte met `unzip -p` uit het al geverifieerde archief. De fout `code has no resources but signature indicates they must be present` is daardoor een harde preflightfout en geen toegestaan codesignresultaat.

## Multiwindow-annotatiearchitectuur

Het hoofdvenster is de blijvende capture- en instellingenhost. Elke capture levert een immutable payload op die met `annotation:open` naar het hoofdproces gaat. `createAnnotationWindow()` maakt vervolgens een nieuwe `BrowserWindow` met een eigen rendererproces en registreert het venster in `WindowRegistry`.

De initiële payload wordt per `webContents.id` opgeslagen. Het annotatievenster vraagt deze na het opbouwen van zijn eigen UI op via `annotation:get-initial`. Daardoor bestaat geen timingafhankelijk push-event en heeft ieder venster een eigen `CanvasEngine`, bitmap, annotaties en history. Het sluiten van één venster verwijdert alleen de bijbehorende registry- en payload-entry.

Area capture volgt dezelfde route: na selectie maakt het hoofdproces direct een nieuw annotatievenster en herstelt het uitsluitend het venster dat de overlay heeft gestart.

Een leeg hoofdvenster vraagt na een geslaagde `annotation:open` via `window:close-empty-home` om vernietiging van uitsluitend zichzelf. Het hoofdproces accepteert dit alleen wanneer de afzender exact `mainWindow` is. De tray houdt het proces actief; bestaande annotatievensters worden niet geraakt.

Het Instellingen-menu gebruikt een afzonderlijk `settingsWindow`. Een bestaande instance wordt getoond en gefocust; anders wordt één nieuw settings-mode-venster gemaakt. Hierdoor opent de native tray/menuactie direct Instellingen zonder een leeg capturevenster te tonen.

## Klembordpipeline

De renderer exporteert de definitieve compositie met `canvas.toBlob('image/png')` naar een `Uint8Array`. Daardoor hoeft een grote base64-data-URL niet via IPC te worden gekopieerd. `clipboard-payload.js` valideert de PNG-header en normaliseert `ArrayBuffer`, typed arrays en buffers.

De preload exposeert uitsluitend `writePngToClipboard(pngBytes)` naar de renderer. Deze methode gebruikt `ipcRenderer.invoke('clipboard:write-png', ...)`; er wordt geen Electron-clipboardmodule, browserclipboard of generieke `write`-functie aan de renderer doorgegeven.

`system-clipboard.js` draait uitsluitend vanuit het main process. De service inspecteert de daadwerkelijke runtime via `process.versions.electron`, platform en functie-capabilities. De Electron-route wordt alleen gebruikt wanneer `electron.clipboard.writeImage`, `readImage` en `nativeImage.createFromBuffer` werkelijk functies zijn. Een ontbrekende export wordt dus niet meer als beschikbare API verondersteld.

Bij een ontbrekende of falende Electron-route schakelt `native-clipboard.js` zonder gebruikersinteractie over naar:

- macOS AppKit `NSPasteboard`, aangeroepen via JXA/osascript met ruwe PNG-stdin;
- Windows `.NET System.Windows.Forms.Clipboard`, aangeroepen via PowerShell `-STA` met base64-stdin en retry bij tijdelijke clipboard-locks.

Beide helpers verwerken alles in geheugen en maken geen tijdelijke bestanden. Ze lezen de afbeelding terug uit het native clipboard en retourneren JSON met de bevestigde afmetingen. De service vergelijkt die met de PNG-IHDR-afmetingen. Alleen een niet-lege afbeelding met exact dezelfde afmetingen geldt als succes. Foutmeldingen bevatten afzonderlijk de Electron- en native oorzaak plus de gedetecteerde capabilities. Het succesresultaat bevat de actuele globale instelling `closeAfterCopy`. De renderer vraagt pas daarna met `window:close-self` het sluiten van zichzelf aan; het hoofdproces accepteert dit uitsluitend wanneer de aanroepende `BrowserWindow` in de annotatievensterregistry staat.

## Traymenu en recent bestand

`tray-menu.js` levert één platformonafhankelijke menustructuur die zowel door de macOS-menubalk als de Windows-system tray wordt gebruikt. Iedere succesvolle auto-save of handmatige save wordt via `recordLastSavedPath()` persistent opgeslagen. `recent-screenshot.js` onderscheidt geen historie, ontbrekend bestand, leesfout en geldige bytes. Alleen geldige afbeeldingsbytes worden als nieuwe annotatiepayload geopend; fouten worden via een native dialoog gemeld zonder vensters te muteren.

## Documenthistory en intern annotatieclipboard

Een scene bevat nu de bronbitmapreferentie, annotaties, stapnummer en schaduwstatus. Hierdoor kan ook een crop volledig via undo/redo worden teruggedraaid. `History.push()` negeert identieke snapshots, kapt redo af na een nieuwe bewerking en bewaart per annotatievenster maximaal 50 scènes.

Het interne annotatieclipboard leeft uitsluitend in de renderer van het betreffende annotatievenster. Een kopie is een diepe clone; plakken genereert een nieuw ID, verplaatst de geometrie met een oplopende offset en commit één nieuwe historystap. Het systeemclipboard wordt alleen gebruikt wanneer geen annotatie geselecteerd is of wanneer de zichtbare knop **Kopiëren** wordt gebruikt.

## Schaduw- en exportbeleid

De vensterschaduw heeft alleen `enabled`. Renderwaarden zijn vast en de canvas wordt vooraf transparant gewist; PNG en clipboard-PNG behouden alpha. JPEG wordt in een apart canvas met een vaste witte achtergrond gerasterd. Annotatieschaduw is per zichtbaar annotatieobject opgeslagen en staat los van windowschaduw; blur en pixelate ondersteunen deze property niet.

## Instellingenschema 0.7.3

`settings-schema.js` migreert 0.7.2-velden (`startup`, `annotation`, beperkte `storage`) naar de secties `general`, `capture`, `storage` en `editor`. Editorwaarden worden veilig tot 1–200 begrensd. De renderer toont 5–50 voor lijndikte, maar bewaart een handmatige echte waarde buiten dat bereik. `filename-pattern.js` rendert tokens, saneert platformongeldige tekens, kiest de extensie en maakt conflictvarianten. Het traymenu krijgt dezelfde shortcuts uit het centrale settingssnapshot en wordt direct opnieuw opgebouwd na succesvolle registratie.

## Update-detectie

`update-check.js` bevat pure semver-, releasefilter-, interval- en URLvalidatie. `update-service.js` doet één publieke GitHub REST-call zonder token. Het main process gebruikt `net.fetch`, bewaart alleen `lastCheckedAt` en een tijdelijke status, en broadcast die naar vensters. Er is geen electron-updater, downloadfunctie, installatieactie of telemetrie. Externe navigatie loopt via een specifieke IPC-handler die alleen de release-URL van de geconfigureerde repository accepteert.

De releaseworkflow injecteert `${{ github.repository }}` uitsluitend in de gebouwde package metadata. Daardoor verwijst een releasebuild naar zijn werkelijke repository zonder hardcoded eigenaar in de bron.

## Lokale OCR-flow

OCR gebruikt dezelfde `overlayWindow` en regionselectie als area capture, maar `regionContext.action` is `ocr`. Bij voltooiing verwerkt het main process de geselecteerde PNG via `ocr-service.js` en keert vóór `createAnnotationWindow()` terug. Daardoor ontstaat geen annotatievenster of leeg hoofdvenster.

`native-ocr.js` routeert per platform naar lokale OS-technologie: Vision via JXA/AppKit op macOS en `Windows.Media.Ocr` via STA PowerShell/WinRT op Windows. De Windows helper verwijdert zijn tijdelijke PNG altijd in `finally`; macOS leest PNG-bytes direct via stdin. `ocr-text.js` normaliseert regeleinden, tabs en overtollige lege regels. `system-text-clipboard.js` verifieert de geschreven tekst via Electron main clipboard of lokale pbcopy/pbpaste dan wel Windows Forms Clipboard. De clipboardroute wordt uitsluitend aangeroepen als genormaliseerde OCR-tekst niet leeg is.

Resultaten en fouten worden via Electron `Notification` of een Windows trayballoon niet-blokkerend gemeld. De OCR-flow bevat geen netwerkcode.

`ocr-flow-controller.js` vormt de testbare end-to-end orchestrator: data-URL valideren, PNG-dimensies controleren, OCR-service uitvoeren, clipboard bevestigen en op iedere succes- of foutuitgang de notificatiecallback aanroepen. Onverwachte pipeline-exceptions worden eveneens in een foutresultaat en melding omgezet.

Op macOS gebruikt `native-ocr.js` de bewezen Vision-datahandlerroute (`VNImageRequestHandler.initWithDataOptions`) en een vast absoluut `/usr/bin/osascript`-pad. `assertHelperAvailable()` controleert het helperpad vóór spawn. Op Windows wordt het absolute WindowsPowerShell-pad afgeleid uit `SystemRoot`. Helpers lopen via `child_process.spawn` met stdin en begrensde timeout; notificaties gebruiken apart `execFile` met vaste executable en argumenten. Deze paden werken onafhankelijk van source- of ASAR-locatie.

Developmentlogging loopt door een metadata-allowlist in `ocrDebug()`. Payload, data-URL en herkende tekst kunnen daardoor niet per ongeluk in de console terechtkomen. Packaged builds loggen standaard niet.
