const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src', 'canvas-engine.js'), 'utf8');

test('canvas exporteert de volledige compositie als PNG-bytes zonder selectiehandles', () => {
  assert.match(engine, /async exportPngBytes\(\)/);
  const start = engine.indexOf('async exportPngBytes()');
  const body = engine.slice(start, engine.indexOf('\n    }', start) + 6);
  assert.match(body, /this\.render\(true\)/);
  assert.match(body, /toBlob/);
  assert.match(body, /new Uint8Array\(buffer\)/);
});

test('main process routeert PNG uitsluitend naar de gevalideerde clipboardservice', () => {
  const start = main.indexOf("ipcMain.handle('clipboard:write-png'");
  const end = main.indexOf("ipcMain.handle('image:auto-save'", start);
  const body = main.slice(start, end);
  assert.match(body, /writePngToSystemClipboard\(payload/);
  assert.match(body, /electronClipboard,/);
  assert.match(body, /nativeImage,/);
  assert.match(body, /process\.versions\.electron/);
  assert.doesNotMatch(body, /clipboard\.write\(/);
});

test('preload biedt één smalle IPC-methode en geen renderer clipboardobject', () => {
  assert.match(preload, /writePngToClipboard: pngBytes => ipcRenderer\.invoke\('clipboard:write-png', pngBytes\)/);
  assert.doesNotMatch(preload, /navigator\.clipboard|clipboard\.write\(|clipboard:\s*clipboard/);
});

test('renderer sluit pas na bevestigde kopie en nooit in het foutpad', () => {
  const start = renderer.indexOf('async function copyImage()');
  const end = renderer.indexOf('async function saveImage()', start);
  const body = renderer.slice(start, end);
  const copyIndex = body.indexOf('await window.grabbr.writePngToClipboard(pngBytes)');
  const successIndex = body.indexOf('if (!result?.ok) throw');
  const closeIndex = body.indexOf('await window.grabbr.closeSelf()');
  const catchIndex = body.indexOf('catch (error)');
  assert.ok(copyIndex >= 0 && successIndex > copyIndex && closeIndex > successIndex && catchIndex > closeIndex);
  const catchBody = body.slice(catchIndex);
  assert.doesNotMatch(catchBody, /closeSelf/);
});
