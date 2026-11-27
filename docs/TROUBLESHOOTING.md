# Problemen oplossen

## macOS: ontwikkelaar kan niet worden gecontroleerd

De huidige builds zijn niet Developer ID-signed of genotarized.

Gebruik alleen een Grabbr-build die je vertrouwt en controleer desgewenst SHA-256 tegen `SHA256SUMS.txt`.

1. Zet `Grabbr.app` in `/Applications`.
2. Klik met rechts op de app en kies **Open**.
3. Bevestig **Open**.
4. Indien nodig: **Systeeminstellingen → Privacy en beveiliging → Open toch**.

## macOS: “Grabbr is beschadigd”

1. Verwijder de app.
2. Download de release opnieuw.
3. Pak de ZIP uit met Finder/Archive Utility en zet de app in `/Applications`.
4. Probeer rechtsklik → **Open**.

Alleen wanneer je de build en checksum vertrouwt, kun je als laatste stap de quarantainemarkering verwijderen:

```bash
xattr -dr com.apple.quarantine /Applications/Grabbr.app
```

Dit vervangt geen controle van de herkomst.

## macOS: Screen Recording blijft gevraagd worden

Grabbr heeft toegang nodig via:

**Systeeminstellingen → Privacy en beveiliging → Scherm- en systeemaudio-opname**

Na inschakelen:

1. Kies **Afsluiten** in het Grabbr-menubalkmenu.
2. Controleer in Activiteitenweergave dat Grabbr niet meer draait.
3. Start Grabbr opnieuw uit `/Applications`.

Blijft een nieuwe ad-hoc build toestemming vragen:

1. Verwijder oudere Grabbr-kopieën en houd één app in `/Applications`.
2. Sluit Grabbr volledig.
3. Reset de Screen Recording-toestemming:
   ```bash
   tccutil reset ScreenCapture com.grabbr.app
   ```
4. Start Grabbr opnieuw en geef toestemming.
5. Sluit en start Grabbr daarna nogmaals volledig.

Ad-hoc builds kunnen door macOS als een gewijzigde code-identiteit worden gezien. Een vaste locatie en één actuele appkopie beperken herhaalde prompts.

## macOS: geen screenshots of zwart beeld

- Controleer Screen Recording-toegang.
- DRM- of beveiligde vensters kunnen bewust zwart blijven.
- Minimaliseer het doelvenster niet.
- Herstart Grabbr volledig na toestemmingswijzigingen.

## Clipboard kopieert niet

- Probeer eerst de zichtbare knop **Kopiëren**.
- Controleer of een clipboardmanager de inhoud direct overschrijft.
- Op macOS: herstart Grabbr; op Windows: sluit tijdelijk andere apps die het clipboard langdurig locken.
- Een geselecteerde annotatie + `Cmd/Ctrl+C` gebruikt het interne annotatieclipboard. Deselecteer de annotatie om met dezelfde sneltoets de volledige screenshot te kopiëren.

Grabbr toont een fout als de clipboard-readback niet overeenkomt; het annotatievenster sluit of minimaliseert dan niet.

## OCR herkent niets

- Kies een strak gebied met voldoende contrast en resolutie.
- Geef op macOS Screen Recording-toegang.
- Controleer op Windows dat een geschikte gebruikers-/OCR-taal is geïnstalleerd.
- Bij lege herkenning verandert Grabbr het clipboard niet.
- Start vanuit source met extra veilige fase-logging:
  ```bash
  GRABBR_OCR_DEBUG=1 npm start
  ```
  De afbeelding en herkende tekst worden niet gelogd.

## Geen OCR- of succesnotificatie

### macOS

Controleer **Systeeminstellingen → Meldingen → Grabbr**. Grabbr probeert eerst een native macOS-notificatie en daarna Electron Notification.

### Windows

Controleer Windows-meldingsinstellingen en Focus Assist/Niet storen. Grabbr kan terugvallen op een System Tray-balloon.

## Globale hotkey werkt niet

- Controleer **Instellingen → Sneltoetsen** op conflicten.
- Kies een combinatie die niet door macOS, Windows of een andere app is gereserveerd.
- Sla op en controleer het bijgewerkte tray-/menubalkmenu.
- Herstart Grabbr als het besturingssysteem een eerder geregistreerde combinatie vasthoudt.

## Windows SmartScreen

De huidige Windows-builds zijn niet Authenticode-signed. Controleer dat het bestand uit de vertrouwde Grabbr GitHub Release komt. Kies daarna indien nodig:

**Meer informatie → Toch uitvoeren**

Gebruik bij voorkeur de SHA-256 uit de release.

## Updatecontrole meldt “niet geconfigureerd”

Lokale sourcebuilds hebben mogelijk geen `grabbr.githubRepository`. Releasebuilds krijgen deze metadata automatisch van GitHub Actions. Dit beïnvloedt capture en annotaties niet; alleen de GitHub-knop en updatecontrole zijn dan uitgeschakeld.
