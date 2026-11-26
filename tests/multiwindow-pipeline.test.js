const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}`) >= 0 ? source.indexOf(`function ${name}`) : source.indexOf(`async function ${name}`);
  const end = source.indexOf(nextName, start + 1);
  return source.slice(start, end > start ? end : source.length);
}

test('iedere source capture opent een nieuw annotatievenster en vervangt de huidige canvas niet', () => {
  const body = functionBody(renderer, 'chooseSource', 'async function initializeAnnotation');
  assert.match(body, /window\.grabbr\.openAnnotation\(/);
  assert.doesNotMatch(body, /engine\.setDocument\(/);
});

test('gebiedscapture opent eveneens een afzonderlijk annotatievenster', () => {
  const start = main.indexOf("ipcMain.on('region:complete'");
  const end = main.indexOf("ipcMain.on('region:cancel'", start);
  const body = main.slice(start, end);
  assert.match(body, /createAnnotationWindow\(/);
  assert.doesNotMatch(body, /webContents\.send\('capture:region-complete'/);
});

test('annotatievensters worden in een registry bijgehouden en individueel verwijderd', () => {
  assert.match(main, /const annotationWindows = new WindowRegistry\(\)/);
  assert.match(main, /annotationWindows\.add\(win\)/);
  assert.match(main, /annotationWindows\.remove\(win\)/);
});

test('alleen het aanroepende annotatievenster mag zichzelf sluiten', () => {
  const start = main.indexOf("ipcMain.handle('window:close-self'");
  const end = main.indexOf("ipcMain.handle('settings:update-shortcuts'", start);
  const body = main.slice(start, end);
  assert.match(body, /BrowserWindow\.fromWebContents\(event\.sender\)/);
  assert.match(body, /annotationWindows\.has\(win\)/);
  assert.match(body, /win\.close\(\)/);
});
