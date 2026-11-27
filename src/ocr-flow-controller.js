'use strict';

const { pngDimensions } = require('./clipboard-payload.js');
const { extractAndCopyText } = require('./ocr-service.js');

function selectedPngBytes(payload) {
  const match = String(payload?.dataUrl || '').match(/^data:image\/png;base64,(.+)$/s);
  if (!match) throw new Error('De OCR-selectie is geen geldige PNG.');
  return Buffer.from(match[1], 'base64');
}

async function completeOcrSelection(payload, dependencies = {}) {
  const log = typeof dependencies.log === 'function' ? dependencies.log : () => {};
  const notify = typeof dependencies.notify === 'function' ? dependencies.notify : async () => {};
  let result;
  try {
    const bytes = selectedPngBytes(payload);
    const dimensions = pngDimensions(bytes);
    log('selection-received', { bytes: bytes.length, width: dimensions.width, height: dimensions.height });
    const service = dependencies.extractAndCopy || extractAndCopyText;
    result = await service(bytes, dependencies.serviceDependencies || {});
    log(result.ok ? 'completed' : `failed-${result.stage || 'unknown'}`, {
      ok: result.ok === true,
      recognitionMethod: result.recognitionMethod || null,
      clipboardMethod: result.clipboardMethod || null
    });
  } catch (error) {
    result = { ok: false, stage: 'pipeline', message: `OCR-tekst vastleggen is mislukt: ${error.message}` };
    log('failed-pipeline', { ok: false, errorName: error.name || 'Error' });
  }

  try {
    await notify(result.ok, result.message);
    log('notification-shown', { ok: result.ok === true });
  } catch (error) {
    log('notification-failed', { ok: false, errorName: error.name || 'Error' });
    result = { ...result, notificationError: error.message };
  }
  return result;
}

module.exports = { selectedPngBytes, completeOcrSelection };
