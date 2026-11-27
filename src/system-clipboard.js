'use strict';

const { normalizePngBytes, pngDimensions, validDimensions, dimensionsMatch } = require('./clipboard-payload.js');
const { writePngNative } = require('./native-clipboard.js');

function detectClipboardCapabilities(dependencies = {}) {
  const electronClipboard = dependencies.electronClipboard;
  const nativeImage = dependencies.nativeImage;
  const platform = dependencies.platform || process.platform;
  return {
    runtime: {
      electron: dependencies.electronVersion || process.versions.electron || null,
      node: dependencies.nodeVersion || process.versions.node || null,
      platform
    },
    electronMain: Boolean(
      electronClipboard &&
      typeof electronClipboard.writeImage === 'function' &&
      typeof electronClipboard.readImage === 'function' &&
      nativeImage &&
      typeof nativeImage.createFromBuffer === 'function'
    ),
    nativeFallback: platform === 'darwin' || platform === 'win32'
  };
}

function tryElectronClipboard(bytes, expected, dependencies) {
  const image = dependencies.nativeImage.createFromBuffer(bytes);
  if (!image || typeof image.isEmpty !== 'function' || image.isEmpty()) throw new Error('Electron nativeImage kon de PNG niet lezen.');
  const decoded = image.getSize();
  if (!dimensionsMatch(expected, decoded)) throw new Error('Electron nativeImage decodeerde onverwachte afbeeldingsafmetingen.');
  dependencies.electronClipboard.writeImage(image);
  const confirmed = dependencies.electronClipboard.readImage();
  const actual = confirmed && typeof confirmed.isEmpty === 'function' && !confirmed.isEmpty() ? confirmed.getSize() : null;
  if (!validDimensions(actual) || !dimensionsMatch(expected, actual)) throw new Error('Electron clipboard bevestigde de afbeelding niet correct.');
  return { ok: true, width: expected.width, height: expected.height, method: 'Electron main clipboard.writeImage' };
}

async function writePngToSystemClipboard(payload, dependencies = {}) {
  const afterCopy = ['copy','close','minimize'].includes(dependencies.afterCopy)?dependencies.afterCopy:'copy';
  let bytes, expected;
  try {
    bytes = normalizePngBytes(payload);
    expected = pngDimensions(bytes);
  } catch (error) {
    return { ok: false, error: `Kopiëren naar het systeemklembord is mislukt: ${error.message}`, capabilities: detectClipboardCapabilities(dependencies) };
  }

  const capabilities = detectClipboardCapabilities(dependencies);
  const failures = [];

  if (capabilities.electronMain) {
    try {
      return { ...tryElectronClipboard(bytes, expected, dependencies), afterCopy, capabilities };
    } catch (error) {
      failures.push(`Electron-route: ${error.message}`);
    }
  } else {
    failures.push('Electron-route: clipboard.writeImage/readImage is in deze runtime niet beschikbaar');
  }

  if (capabilities.nativeFallback) {
    try {
      const nativeWriter = dependencies.nativeWriter || writePngNative;
      const result = await nativeWriter(bytes, capabilities.runtime.platform, dependencies.nativeOptions || {});
      if (!result?.ok || !dimensionsMatch(expected, result)) throw new Error('De native helper bevestigde de afbeelding niet correct.');
      return { ok: true, width: expected.width, height: expected.height, method: result.method || 'native fallback', afterCopy, capabilities };
    } catch (error) {
      failures.push(`Native route: ${error.message}`);
    }
  } else {
    failures.push(`Native route: niet beschikbaar voor ${capabilities.runtime.platform}`);
  }

  return { ok: false, error: `Kopiëren naar het systeemklembord is mislukt. ${failures.join(' | ')}`, capabilities };
}

module.exports = { detectClipboardCapabilities, tryElectronClipboard, writePngToSystemClipboard };
