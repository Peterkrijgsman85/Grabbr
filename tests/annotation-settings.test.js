const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ANNOTATION_SETTINGS, normalizeAnnotationSettings } = require('../src/annotation-settings.js');

test('annotatievenster sluiten na kopiëren staat standaard uit', () => {
  assert.equal(DEFAULT_ANNOTATION_SETTINGS.closeAfterCopy, false);
  assert.deepEqual(normalizeAnnotationSettings(undefined), { closeAfterCopy: false });
});

test('sluiten na kopiëren wordt alleen door expliciet true geactiveerd', () => {
  assert.deepEqual(normalizeAnnotationSettings({ closeAfterCopy: true }), { closeAfterCopy: true });
  assert.deepEqual(normalizeAnnotationSettings({ closeAfterCopy: 'true' }), { closeAfterCopy: false });
});
