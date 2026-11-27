const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

test('window capture gebruikt de cursorvrije native snapshot vóór de streamfallback', () => {
  const windowGuard = renderer.indexOf("if (sourceKind === 'window')");
  const snapshotCall = renderer.indexOf("getSourceImage(source.id,'window')");
  const streamCall = renderer.indexOf('getDisplayMedia(GrabbrCapturePolicy.mediaConstraints(sourceKind))');
  assert.ok(windowGuard >= 0 && snapshotCall > windowGuard && streamCall > snapshotCall);
});

test('streamfallback past cursor never toe vóór het videoframe', () => {
  const constraint = renderer.indexOf("track.applyConstraints({ cursor: 'never' })");
  const drawFrame = renderer.indexOf("output.getContext('2d').drawImage(video, 0, 0)");
  assert.ok(constraint >= 0 && drawFrame > constraint);
});

test('editor en selectie-overlay gebruiken native content protection', () => {
  assert.match(main, /mainWindow\.setContentProtection\(general\.hideGrabbrDuringCapture\)/);
  assert.match(main, /overlayWindow\.setContentProtection\(true\)/);
  assert.match(main, /title: 'Grabbr selectie'/);
});

test('eigen Grabbr-bronnen worden vlak voor capture nogmaals geweigerd', () => {
  const matches = main.match(/!isOwnSourceName\(item\.name\)/g) || [];
  assert.ok(matches.length >= 2);
});
