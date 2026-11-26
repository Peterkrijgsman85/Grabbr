const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrayTemplate } = require('../src/tray-menu.js');

function labels(platform) {
  const noop = () => {};
  return buildTrayTemplate(platform, { captureWindow: noop, captureRegion: noop, captureScreen: noop, openLastScreenshot: noop, openApp: noop, quit: noop })
    .filter(item => item.label).map(item => item.label);
}

test('macOS-menubalkmenu bevat Laatste screenshot openen', () => {
  assert.ok(labels('darwin').includes('Laatste screenshot openen'));
});

test('Windows-traymenu bevat Laatste screenshot openen', () => {
  assert.ok(labels('win32').includes('Laatste screenshot openen'));
});

test('traymenu behoudt alle captureacties op beide platformen', () => {
  for (const platform of ['darwin', 'win32']) {
    assert.deepEqual(labels(platform).slice(0, 4), ['Venster vastleggen', 'Gebied vastleggen', 'Scherm vastleggen', 'Laatste screenshot openen']);
  }
});
