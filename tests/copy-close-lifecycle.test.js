const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('close-self markeert suppressie vóór uitsluitend het huidige annotatievenster sluit', () => {
  const start = main.indexOf("ipcMain.handle('window:close-self'");
  const end = main.indexOf("ipcMain.handle('settings:update-shortcuts'", start);
  const body = main.slice(start, end);
  const mark = body.indexOf('lifecyclePolicy.markProgrammaticAnnotationClose()');
  const close = body.indexOf('win.close()');
  assert.ok(mark >= 0 && close > mark);
  assert.match(body, /BrowserWindow\.fromWebContents\(event\.sender\)/);
  assert.match(body, /annotationWindows\.has\(win\)/);
  assert.doesNotMatch(body, /createWindow|createAnnotationWindow|ensureMainWindow/);
});

test('macOS activate toont alleen bestaand hoofdvenster en maakt geen leeg venster', () => {
  const match = main.match(/app\.on\('activate',[^\n]+/);
  assert.ok(match);
  assert.match(match[0], /activateExistingMainWindow\(mainWindow\)/);
  assert.doesNotMatch(match[0], /ensureMainWindow|createWindow/);
});

test('window-all-closed houdt Grabbr actief zolang tray bestaat', () => {
  assert.match(main, /shouldQuitOnAllWindowsClosed\(Boolean\(tray\)\)/);
});
