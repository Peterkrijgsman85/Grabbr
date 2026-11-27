# Grabbr releaseflow

## Bestanden naar `develop`

Upload/commit de volledige inhoud van deze sourceversie, in het bijzonder:

- `.github/workflows/release.yml`
- `package.json` en `package-lock.json`
- `main.js`, `preload.js`, `src/`, `assets/` en `tests/`
- bijgewerkte `README.md`, `ARCHITECTURE.md`, `BUILDING.md` en dit bestand

Stel geen GitHub-token in de app in. De releaseworkflow injecteert tijdens de macOS- en Windows-build automatisch `${{ github.repository }}` in `package.json` als updatebron.

## Van develop naar een draft release

1. Commit en push naar `develop`.
2. Laat review/tests lopen en merge de bevestigde commit naar de stabiele branch `main`, `master` of `stable`.
3. Controleer dat `package.json` exact de releaseversie bevat, bijvoorbeeld `0.7.4`.
4. Maak de overeenkomstige tag op die stabiele commit en push hem:

   ```bash
   git checkout main
   git pull
   git tag v0.7.4
   git push origin v0.7.4
   ```

5. De workflow test eerst en bouwt daarna parallel macOS arm64 en Windows x64.
6. Na succesvolle builds verschijnt op GitHub een **Draft Release** met gegenereerde notes, ZIP, DMG, Setup.exe, Portable.exe en SHA-256-bestand.
7. Download en praktijktest alle relevante artifacts.
8. Publiceer de draft uitsluitend handmatig via GitHub wanneer de praktijktest is goedgekeurd.

De workflow weigert tags die niet overeenkomen met `package.json`, commits die niet op de stabiele branch staan, ontbrekende artifacts en een macOS-app die de strikte codesigncontrole niet doorstaat.
