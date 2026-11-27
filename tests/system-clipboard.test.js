const test = require('node:test');
const assert = require('node:assert/strict');
const { detectClipboardCapabilities, writePngToSystemClipboard } = require('../src/system-clipboard.js');
const { pngHeader } = require('./png-fixture.js');

const png = pngHeader();

function image(width = 1200, height = 800) {
  return { isEmpty: () => false, getSize: () => ({ width, height }) };
}

function dependencies(options = {}) {
  const written = [];
  const confirmed = options.confirmed || image();
  return {
    written,
    electronClipboard: {
      writeImage(value) { if (options.writeError) throw options.writeError; written.push(value); },
      readImage() { return confirmed; }
    },
    nativeImage: { createFromBuffer: options.createFromBuffer || (() => image()) },
    afterCopy: options.afterCopy || 'copy'
  };
}

test('geldige PNG bereikt uitsluitend de Electron main-process writeImage API', async () => {
  const deps = dependencies();
  const result = await writePngToSystemClipboard(new Uint8Array(png), { ...deps, platform: 'darwin' });
  assert.equal(result.ok, true);
  assert.equal(result.method, 'Electron main clipboard.writeImage');
  assert.equal(result.afterCopy, 'copy');
  assert.equal(deps.written.length, 1);
  assert.equal(typeof deps.electronClipboard.write, 'undefined');
});

test('ontbrekende Electron clipboard wordt via native fallback afgehandeld', async () => {
  const result = await writePngToSystemClipboard(png, {
    electronClipboard: undefined,
    nativeImage: { createFromBuffer: () => image() },
    platform: 'darwin',
    nativeWriter: async () => ({ ok: true, width: 1200, height: 800, method: 'mock NSPasteboard' })
  });
  assert.equal(result.ok, true);
  assert.equal(result.method, 'mock NSPasteboard');
  assert.equal(result.capabilities.electronMain, false);
});

test('ontbrekende Electron clipboard én falende fallback geeft duidelijke fout', async () => {
  const result = await writePngToSystemClipboard(png, {
    electronClipboard: { write() {} }, nativeImage: { createFromBuffer: () => image() }, platform: 'win32',
    nativeWriter: async () => { throw new Error('PowerShell helper niet beschikbaar'); }
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /clipboard\.writeImage\/readImage is in deze runtime niet beschikbaar/);
  assert.match(result.error, /PowerShell helper niet beschikbaar/);
});

test('Electron writeImage-fout valt terug op native route', async () => {
  const result = await writePngToSystemClipboard(png, {
    ...dependencies({ writeError: new Error('clipboard bezet') }), platform: 'win32',
    nativeWriter: async () => ({ ok: true, width: 1200, height: 800, method: 'mock Windows Clipboard' })
  });
  assert.equal(result.ok, true);
  assert.equal(result.method, 'mock Windows Clipboard');
});

test('mislukte readback en native fallback zijn geen succes', async () => {
  const result = await writePngToSystemClipboard(png, {
    ...dependencies({ confirmed: image(640, 480), afterCopy: 'close' }), platform: 'win32',
    nativeWriter: async () => { throw new Error('native verificatie mislukt'); }
  });
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /closeAfterCopy.*true/);
});

test('sluiten-na-kopiëren wordt uitsluitend na bevestigd succes teruggegeven', async () => {
  const result = await writePngToSystemClipboard(png, { ...dependencies({ afterCopy: 'close' }), platform: 'darwin' });
  assert.equal(result.ok, true);
  assert.equal(result.afterCopy, 'close');
});

test('capability detection rapporteert runtime en native fallback', () => {
  const result = detectClipboardCapabilities({ electronClipboard: undefined, nativeImage: {}, platform: 'win32', electronVersion: '45.4.1', nodeVersion: '24.22.3' });
  assert.deepEqual(result, { runtime: { electron: '45.4.1', node: '24.22.3', platform: 'win32' }, electronMain: false, nativeFallback: true });
});
