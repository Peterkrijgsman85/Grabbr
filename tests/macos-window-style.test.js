const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');

test('macOS gebruikt hiddenInset met native verkeerslichten', () => {
  assert.match(main, /options\.titleBarStyle = 'hiddenInset'/);
  assert.match(main, /options\.titleBarSeparatorStyle = 'none'/);
  assert.match(main, /options\.trafficLightPosition = \{ x: 18, y: 20 \}/);
});

test('titelbalk gebruikt dezelfde applicatieachtergrond en correcte drag-regio', () => {
  assert.match(css, /\.titlebar\{[^}]*background:var\(--bg\)[^}]*-webkit-app-region:drag/);
  assert.match(css, /\.titlebar button,[^}]*-webkit-app-region:no-drag/);
  assert.match(css, /\.platform-darwin \.titlebar\{[^}]*padding-left:82px/);
  assert.match(css, /\.platform-darwin \.capture-group,[^}]*-webkit-app-region:no-drag/);
});

test('renderer zet platformklasse voor macOS-specifieke layout', () => {
  assert.match(renderer, /document\.documentElement\.classList\.add\(`platform-\$\{appInfo\.platform\}`\)/);
});
