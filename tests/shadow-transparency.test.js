const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'src', 'canvas-engine.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

test('schaduw heeft alleen een aan-uitstatus en vaste alpha-rendering', () => {
  assert.match(engine, /this\.shadow = \{ enabled: true \}/);
  assert.match(engine, /shadowColor = 'rgba\(0,0,0,\.35\)'/);
  assert.doesNotMatch(engine, /shadow\.blur|shadow\.offset|shadow\.opacity/);
});

test('schaduw-UI toont geen zichtbare detailparameters of witte achtergrond', () => {
  assert.match(html, /id="shadowEnabled"/);
  assert.doesNotMatch(html, /shadowBlur|shadowOffset|shadowOpacity|whiteBackground/);
});

test('JPEG wordt geweigerd zolang transparante schaduw actief is', () => {
  assert.match(engine, /JPEG ondersteunt geen transparante schaduw/);
  assert.match(engine, /if \(format === 'jpeg'\)/);
});
