const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, validateAccelerator, validateSettings, eventToAccelerator } = require('../src/hotkeys.js');

test('standaard sneltoetsen zijn geldig en uniek', () => {
  const result = validateSettings(DEFAULTS);
  assert.equal(result.valid, true);
});

test('sneltoets zonder modifier wordt geweigerd', () => {
  assert.equal(validateAccelerator('F2').valid, false);
});

test('dubbele sneltoetsen worden geweigerd', () => {
  const result = validateSettings({ window: 'Control+Shift+1', region: 'Control+Shift+1', screen: 'Control+Shift+2' });
  assert.equal(result.valid, false);
});

test('keydown wordt omgezet naar Electron accelerator', () => {
  const value = eventToAccelerator({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: '%', code: 'Digit5' }, true);
  assert.equal(value, 'Command+Shift+5');
});
