const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePngBytes, dimensionsMatch, pngDimensions } = require('../src/clipboard-payload.js');
const { pngHeader } = require('./png-fixture.js');

const png = pngHeader();

test('PNG-bytes blijven intact via Uint8Array en ArrayBuffer', () => {
  assert.deepEqual(normalizePngBytes(new Uint8Array(png)), png);
  const arrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
  assert.deepEqual(normalizePngBytes(arrayBuffer), png);
});

test('ongeldige klembordpayload wordt duidelijk afgewezen', () => {
  assert.throws(() => normalizePngBytes(Buffer.from('geen png')), /geen geldige PNG/i);
});

test('klembordverificatie vereist exact dezelfde afmetingen', () => {
  assert.equal(dimensionsMatch({ width: 1200, height: 800 }, { width: 1200, height: 800 }), true);
  assert.equal(dimensionsMatch({ width: 1200, height: 800 }, { width: 1199, height: 800 }), false);
});

test('PNG-afmetingen worden rechtstreeks uit IHDR gevalideerd', () => {
  assert.deepEqual(pngDimensions(pngHeader(640, 360)), { width: 640, height: 360 });
});
