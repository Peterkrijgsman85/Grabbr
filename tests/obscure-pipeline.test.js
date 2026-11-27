const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'canvas-engine.js'), 'utf8');

test('blur en pixelate worden iedere render opnieuw uit de originele this.image gesampled', () => {
  const start = engine.indexOf('drawObscure(type, rect, ctx)');
  const end = engine.indexOf('contrastColor(hex)', start);
  const body = engine.slice(start, end);
  assert.match(body, /logicalRectToBitmap\(rect,this\.space\)/);
  assert.match(body, /drawImage\(\s*this\.image,/);
  assert.doesNotMatch(body, /drawImage\(this\.canvas|snapshot|getImageData/);
});

test('blur gebruikt expanded originele bron en cropt pas na opnieuw filteren', () => {
  const start = engine.indexOf('drawObscure(type, rect, ctx)');
  const end = engine.indexOf('contrastColor(hex)', start);
  const body = engine.slice(start, end);
  assert.match(body, /plan\.expandedSource/);
  assert.match(body, /filteredContext\.filter = `blur\(\$\{plan\.blurRadius\}px\)`/);
  assert.match(body, /plan\.cropInExpanded/);
});

test('pixelate maakt per render een nieuw samplecanvas zonder smoothing', () => {
  const start = engine.indexOf('drawObscure(type, rect, ctx)');
  const end = engine.indexOf('contrastColor(hex)', start);
  const body = engine.slice(start, end);
  assert.match(body, /small\.width = plan\.sampleSize\.width/);
  assert.match(body, /ctx\.imageSmoothingEnabled = false/);
  assert.match(body, /plan\.source\.x, plan\.source\.y/);
});
