'use strict';

async function loadRecentScreenshot(filePath, fsApi) {
  if (!filePath) return { ok: false, reason: 'missing-history' };
  try {
    const bytes = await fsApi.readFile(filePath);
    if (!bytes || !bytes.length) return { ok: false, reason: 'empty-file' };
    return { ok: true, filePath, bytes };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: false, reason: 'file-missing' };
    return { ok: false, reason: 'read-failed', error };
  }
}

module.exports = { loadRecentScreenshot };
