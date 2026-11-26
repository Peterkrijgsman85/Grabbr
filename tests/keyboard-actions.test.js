const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

test('undo en redo ondersteunen de gevraagde platformcombinaties', () => {
  assert.match(renderer, /mod && key === 'z'/);
  assert.match(renderer, /event\.shiftKey \? redo\(\) : undo\(\)/);
  assert.match(renderer, /mod && key === 'y'/);
  assert.match(renderer, /appInfo\.platform === 'darwin' \? event\.metaKey : event\.ctrlKey/);
});

test('Ctrl-C kopieert selectie intern en valt zonder selectie terug op screenshotkopie', () => {
  assert.match(renderer, /engine\.copySelectedAnnotation\(\)/);
  assert.match(renderer, /internalAnnotationClipboard = selected/);
  assert.match(renderer, /else \{\s*copyImage\(\)/);
});

test('full-screenshot copy gebruikt nooit renderer navigator.clipboard.write', () => {
  assert.doesNotMatch(renderer, /navigator\.clipboard|clipboard\.write\s*\(/);
  assert.match(renderer, /window\.grabbr\.writePngToClipboard\(pngBytes\)/);
});

test('Ctrl-V plakt intern met offset en negeert tekstinvoer', () => {
  assert.match(renderer, /targetIsTextInput/);
  assert.match(renderer, /engine\.pasteAnnotation\(internalAnnotationClipboard, pasteOffset\)/);
  assert.match(renderer, /pasteOffset = Math\.min\(96, pasteOffset \+ 8\)/);
});
