const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRecentScreenshot } = require('../src/recent-screenshot.js');

test('geen laatste screenshot geeft een veilige ontbrekend-status', async () => {
  assert.deepEqual(await loadRecentScreenshot(null, { readFile: async () => Buffer.from('x') }), { ok: false, reason: 'missing-history' });
});

test('ontbrekend bestand geeft file-missing zonder crash', async () => {
  const fsApi = { readFile: async () => { const error = new Error('weg'); error.code = 'ENOENT'; throw error; } };
  assert.deepEqual(await loadRecentScreenshot('/weg.png', fsApi), { ok: false, reason: 'file-missing' });
});

test('bestaande screenshotbytes worden teruggegeven', async () => {
  const bytes = Buffer.from([1,2,3]);
  const result = await loadRecentScreenshot('/capture.png', { readFile: async () => bytes });
  assert.equal(result.ok, true);
  assert.equal(result.filePath, '/capture.png');
  assert.deepEqual(result.bytes, bytes);
});
