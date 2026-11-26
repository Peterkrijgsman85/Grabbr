'use strict';

function cleanFilenamePart(value, fallback = 'Screenshot') {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return (cleaned || fallback).slice(0, 80);
}

function timestampForFilename(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function screenshotFilename(baseName, date = new Date(), index = 1) {
  const suffix = index === 1 ? '' : ` (${index})`;
  return `Grabbr ${timestampForFilename(date)} - ${cleanFilenamePart(baseName)}${suffix}.png`;
}

module.exports = { cleanFilenamePart, timestampForFilename, screenshotFilename };
