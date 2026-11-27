const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('bron declareert Electron en main inspecteert de daadwerkelijke module-export', () => {
  assert.equal(pkg.devDependencies.electron, '45.4.1');
  assert.match(main, /const electron = require\('electron'\)/);
  assert.match(main, /const electronClipboard = electron\.clipboard/);
  assert.doesNotMatch(main, /\{[^\n}]*clipboard[^\n}]*\}\s*=\s*require\('electron'\)/);
});

test('app-info rapporteert echte runtimeversie en clipboard-capabilities', () => {
  assert.match(main, /process\.versions\.electron \|\| null/);
  assert.match(main, /clipboardCapabilities: detectClipboardCapabilities/);
});
