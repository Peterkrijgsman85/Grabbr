const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'src', 'canvas-engine.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');

test('geselecteerde stroke-eigenschappen zijn achteraf wijzigbaar en committen history', () => {
  assert.match(engine, /applySelectedProperties\(next, commit = true\)/);
  assert.match(engine, /supportsStrokeWidth\(item\)/);
  assert.match(renderer, /engine\.applySelectedProperties\(\{ width \}, false\)/);
  assert.match(renderer, /strokeWidth'\)\.addEventListener\('change', \(\) => commitCurrentState\(\)/);
});

test('geselecteerde tekstgrootte is achteraf wijzigbaar', () => {
  assert.match(engine, /supportsFontSize\(item\)/);
  assert.match(renderer, /engine\.applySelectedProperties\(\{ fontSize \}, false\)/);
});

test('crop en propertywijzigingen blijven onderdeel van dezelfde undo-history', () => {
  assert.match(engine, /baseDataUrl: this\.baseDataUrl/);
  assert.match(engine, /await this\.loadBaseImage\(this\.baseDataUrl\)/);
  assert.match(engine, /this\.callbacks\.onCommit\?\.\(\)/);
  assert.doesNotMatch(renderer, /onBaseChanged: \(\) => \{ resetHistory\(\)/);
});
