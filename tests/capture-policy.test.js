const test = require('node:test');
const assert = require('node:assert/strict');
const { isOwnSourceName, filterExternalSources, mediaConstraints, cursorPolicySatisfied } = require('../src/capture-policy.js');

test('window capture vraagt de browser expliciet om nooit een cursor vast te leggen', () => {
  const constraints = mediaConstraints('window');
  assert.equal(constraints.video.cursor, 'never');
  assert.equal(constraints.video.displaySurface, 'window');
});

test('screen capture behoudt bestaand cursorbeleid', () => {
  const constraints = mediaConstraints('screen');
  assert.equal(constraints.video.cursor, 'always');
  assert.equal(constraints.video.displaySurface, 'monitor');
});

test('Grabbr-editor en Grabbr-selectie worden als eigen capturebron herkend', () => {
  assert.equal(isOwnSourceName('Grabbr'), true);
  assert.equal(isOwnSourceName('Grabbr selectie'), true);
  assert.equal(isOwnSourceName('Grabbr-selection'), true);
  assert.equal(isOwnSourceName('Finder'), false);
});

test('eigen Grabbr-vensters worden uit de bronlijst gefilterd', () => {
  const sources = [{ name: 'Finder', id: '1' }, { name: 'Grabbr selectie', id: '2' }, { name: 'Grabbr', id: '3' }];
  assert.deepEqual(filterExternalSources(sources), [{ name: 'Finder', id: '1' }]);
});

test('windowstream wordt afgewezen als het platform expliciet toch een cursor meldt', () => {
  assert.equal(cursorPolicySatisfied('window', { cursor: 'never' }), true);
  assert.equal(cursorPolicySatisfied('window', {}), true);
  assert.equal(cursorPolicySatisfied('window', { cursor: 'always' }), false);
});
