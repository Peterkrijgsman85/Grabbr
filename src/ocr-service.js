'use strict';

const { normalizePngBytes } = require('./clipboard-payload.js');
const { normalizeOcrText } = require('./ocr-text.js');
const { recognizeTextFromPng } = require('./native-ocr.js');
const { writeTextToSystemClipboard } = require('./system-text-clipboard.js');

async function extractAndCopyText(payload, dependencies = {}) {
  let pngBytes;
  try { pngBytes = normalizePngBytes(payload); }
  catch (error) { return { ok: false, stage: 'image', message: `OCR kon het geselecteerde beeldgebied niet lezen: ${error.message}` }; }

  let recognition;
  try {
    const recognizer = dependencies.recognize || recognizeTextFromPng;
    recognition = await recognizer(pngBytes, dependencies.platform || process.platform, dependencies.ocrOptions || {});
  } catch (error) {
    return { ok: false, stage: 'ocr', message: `Tekstherkenning is mislukt: ${error.message}` };
  }

  const text = normalizeOcrText(recognition?.text);
  if (!text) return { ok: false, stage: 'empty', message: 'Geen tekst herkend in het geselecteerde gebied.' };

  let copied;
  try {
    const writer = dependencies.writeText || writeTextToSystemClipboard;
    copied = await writer(text, dependencies.clipboardOptions || {});
  } catch (error) {
    return { ok: false, stage: 'clipboard', message: `Herkende tekst kon niet worden gekopieerd: ${error.message}` };
  }
  if (!copied?.ok) return { ok: false, stage: 'clipboard', message: copied?.error || 'Herkende tekst kon niet worden gekopieerd.' };

  return { ok: true, text, recognitionMethod: recognition.method, clipboardMethod: copied.method, message: 'Tekst is naar het klembord gekopieerd.' };
}

module.exports = { extractAndCopyText };
