'use strict';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function normalizePngBytes(payload) {
  let bytes;
  if (Buffer.isBuffer(payload)) bytes = Buffer.from(payload);
  else if (payload instanceof ArrayBuffer) bytes = Buffer.from(new Uint8Array(payload));
  else if (ArrayBuffer.isView(payload)) bytes = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  else if (Array.isArray(payload)) bytes = Buffer.from(payload);
  else throw new TypeError('Geen geldige PNG-bytebuffer ontvangen.');
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new TypeError('De klembordafbeelding is geen geldige PNG.');
  }
  return bytes;
}

function validDimensions(size) {
  return Boolean(size && Number.isInteger(size.width) && Number.isInteger(size.height) && size.width > 0 && size.height > 0);
}

function dimensionsMatch(expected, actual) {
  return validDimensions(expected) && validDimensions(actual) && expected.width === actual.width && expected.height === actual.height;
}

function pngDimensions(bytesLike) {
  const bytes = normalizePngBytes(bytesLike);
  if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new TypeError('De PNG bevat geen geldige IHDR-header.');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!validDimensions({ width, height })) throw new TypeError('De PNG heeft ongeldige afmetingen.');
  return { width, height };
}

module.exports = { PNG_SIGNATURE, normalizePngBytes, validDimensions, dimensionsMatch, pngDimensions };
