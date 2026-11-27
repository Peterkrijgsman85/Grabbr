const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanFilenamePart, timestampForFilename, screenshotFilename } = require('../src/storage.js');

test('ongeldige bestandsnaamtekens worden veilig vervangen', () => {
  assert.equal(cleanFilenamePart('CRM: klant/overzicht?'), 'CRM- klant-overzicht-');
});

test('tijdstempel bevat milliseconden en is bestandssysteemveilig', () => {
  const value = timestampForFilename(new Date(2026, 10, 26, 14, 5, 9, 7));
  assert.equal(value, '2026-11-26_14-05-09-007');
});

test('naamconflict krijgt een zichtbaar volgnummer', () => {
  const date = new Date(2026, 0, 2, 3, 4, 5, 6);
  assert.match(screenshotFilename('Venster', date, 2), /Venster \(2\)\.png$/);
});
