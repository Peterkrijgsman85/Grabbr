const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('laatste opgeslagen pad wordt persistent bijgehouden', () => {
  assert.match(main, /recent = \{ lastSavedPath: filePath \}/);
  assert.match(main, /JSON\.stringify\(\{ shortcuts, storage, startup, annotation, recent \}/);
});

test('laatste screenshot opent als nieuw annotatievenster zonder opnieuw autosaven', () => {
  const start = main.indexOf('async function openLastScreenshot()');
  const end = main.indexOf('function registerShortcuts', start);
  const body = main.slice(start, end);
  assert.match(body, /loadRecentScreenshot/);
  assert.match(body, /createAnnotationWindow\(/);
  assert.match(body, /skipAutoSave: true/);
});

test('ontbrekende historie en ontbrekend bestand tonen een duidelijke melding', () => {
  assert.match(main, /Er is nog geen door Grabbr opgeslagen screenshot beschikbaar/);
  assert.match(main, /De laatst opgeslagen screenshot bestaat niet meer/);
  assert.match(main, /showMessageBox/);
});
