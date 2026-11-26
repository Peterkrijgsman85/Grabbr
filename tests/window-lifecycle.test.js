const test = require('node:test');
const assert = require('node:assert/strict');
const { WindowLifecyclePolicy } = require('../src/window-lifecycle.js');

test('copy-close onderdrukt een direct macOS activate-event', () => {
  const policy = new WindowLifecyclePolicy({ suppressDurationMs: 1000 });
  policy.markProgrammaticAnnotationClose(5000);
  assert.equal(policy.shouldHandleActivate(5500), false);
  assert.equal(policy.shouldHandleActivate(6000), true);
});

test('activate maakt nooit zelf een leeg venster en toont alleen bestaand hoofdvenster', () => {
  const policy = new WindowLifecyclePolicy();
  assert.equal(policy.activateExistingMainWindow(null), false);
  const calls = [];
  const win = { isDestroyed: () => false, show: () => calls.push('show'), focus: () => calls.push('focus') };
  assert.equal(policy.activateExistingMainWindow(win), true);
  assert.deepEqual(calls, ['show','focus']);
});

test('tray houdt de app actief wanneer alle zichtbare vensters gesloten zijn', () => {
  const policy = new WindowLifecyclePolicy();
  assert.equal(policy.shouldQuitOnAllWindowsClosed(true), false);
  assert.equal(policy.shouldQuitOnAllWindowsClosed(false), true);
});
