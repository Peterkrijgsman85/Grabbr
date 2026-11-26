const test = require('node:test');
const assert = require('node:assert/strict');
const { WindowRegistry } = require('../src/window-registry.js');

test('meerdere annotatievensters bestaan onafhankelijk naast elkaar', () => {
  const registry = new WindowRegistry();
  const first = { id: 101, document: 'screenshot-a' };
  const second = { id: 102, document: 'screenshot-b' };
  registry.add(first); registry.add(second);
  assert.equal(registry.size, 2);
  assert.deepEqual(registry.values().map(w => w.document), ['screenshot-a', 'screenshot-b']);
  registry.remove(first);
  assert.equal(registry.size, 1);
  assert.equal(registry.has(second), true);
});
