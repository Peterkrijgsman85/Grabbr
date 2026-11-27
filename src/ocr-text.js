'use strict';

function normalizeOcrText(value) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\t\f\v]+/g, ' ');
  const lines = source.split('\n').map(line => line.replace(/[ \u00a0]+/g, ' ').trim());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const normalized = [];
  for (const line of lines) {
    if (!line && normalized[normalized.length - 1] === '') continue;
    normalized.push(line);
  }
  return normalized.join('\n');
}

function hasRecognizedText(value) {
  return normalizeOcrText(value).length > 0;
}

module.exports = { normalizeOcrText, hasRecognizedText };
