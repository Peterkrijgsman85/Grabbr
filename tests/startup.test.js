const test = require('node:test');
const assert = require('node:assert/strict');
const { isSupportedPlatform, loginItemOptions, normalizeState } = require('../src/startup.js');

test('autostart ondersteunt macOS en Windows, maar niet Linux', () => {
  assert.equal(isSupportedPlatform('darwin'), true);
  assert.equal(isSupportedPlatform('win32'), true);
  assert.equal(isSupportedPlatform('linux'), false);
});

test('Windows gebruikt het actuele executable-pad en geen losse shell-opdracht', () => {
  assert.deepEqual(loginItemOptions('win32', 'C:\\Apps\\Grabbr\\Grabbr.exe', true), {
    openAtLogin: true,
    path: 'C:\\Apps\\Grabbr\\Grabbr.exe',
    args: []
  });
});

test('macOS gebruikt de native login-iteminstelling', () => {
  assert.deepEqual(loginItemOptions('darwin', '/Applications/Grabbr.app/Contents/MacOS/Grabbr', false), { openAtLogin: false });
});

test('native status wordt consistent genormaliseerd', () => {
  assert.deepEqual(normalizeState('win32', { openAtLogin: true, wasOpenedAtLogin: true }, true), {
    supported: true,
    openAtLogin: true,
    desired: true,
    wasOpenedAtLogin: true,
    wasOpenedAsHidden: false
  });
});
