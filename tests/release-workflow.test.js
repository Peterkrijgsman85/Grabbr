const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'release.yml'), 'utf8');

function jobBlock(jobName, nextJobName) {
  const startMarker = `  ${jobName}:`;
  const start = workflow.indexOf(startMarker);
  assert.notEqual(start, -1, `Workflow job ${jobName} ontbreekt`);
  const end = nextJobName ? workflow.indexOf(`  ${nextJobName}:`, start + startMarker.length) : workflow.length;
  return workflow.slice(start, end === -1 ? workflow.length : end);
}

function scalar(block, key) {
  const match = block.match(new RegExp(`^\\s{4}${key}:\\s*([^\\n#]+)`, 'm'));
  return match ? match[1].trim() : null;
}

function needs(block) {
  const inline = block.match(/^\s{4}needs:\s*\[([^\]]+)\]/m);
  if (inline) return inline[1].split(',').map(value => value.trim());
  const single = block.match(/^\s{4}needs:\s*([A-Za-z0-9_-]+)\s*$/m);
  return single ? [single[1]] : [];
}

const testJob = jobBlock('test', 'macos-arm64');
const macJob = jobBlock('macos-arm64', 'windows-x64');
const windowsJob = jobBlock('windows-x64', 'draft-release');
const draftJob = jobBlock('draft-release');

test('releaseworkflow start alleen op versietags en maakt uitsluitend een draft', () => {
  assert.match(workflow, /tags:\s*\n\s*- 'v\*'/);
  assert.match(draftJob, /draft:\s*true/);
  assert.match(draftJob, /generate_release_notes:\s*true/);
  assert.doesNotMatch(draftJob, /draft:\s*false/);
});

test('tests zijn een harde voorwaarde voor beide native buildjobs', () => {
  assert.deepEqual(needs(macJob), ['test']);
  assert.deepEqual(needs(windowsJob), ['test']);
  assert.match(testJob, /run:\s*npm test/);
  assert.match(testJob, /run:\s*npm run check/);
});

test('macOS-job is arm64, gebruikt een ondersteunde macOS-runner en verifieert runtimearchitectuur', () => {
  const runner = scalar(macJob, 'runs-on');
  assert.ok(/^macos-(?:latest|\d+)(?:-(?:large|xlarge))?$/.test(runner || ''), `Niet-ondersteunde macOS runnerconfiguratie: ${runner}`);
  assert.match(macJob, /name:\s*macOS Apple Silicon arm64/);
  assert.match(macJob, /test "\$\(uname -m\)" = "arm64"/);
  assert.match(macJob, /electron-builder --mac dir --arm64/);
  assert.match(macJob, /file "\$APP\/Contents\/MacOS\/Grabbr" \| grep -q 'arm64'/);
});

test('draft-release wacht op test, macOS en Windows', () => {
  assert.deepEqual(new Set(needs(draftJob)), new Set(['test', 'macos-arm64', 'windows-x64']));
});

test('tag-package mismatch, stabiele branch en ontbrekende artifacts falen expliciet', () => {
  assert.match(testJob, /Tag \$TAG does not match package\.json/);
  assert.match(testJob, /git merge-base --is-ancestor/);
  assert.match(draftJob, /Missing release artifact/);
  assert.match(macJob, /if-no-files-found:\s*error/);
  assert.match(windowsJob, /if-no-files-found:\s*error/);
});

test('macOS wordt ad-hoc gesigned, strikt geverifieerd en met ditto verpakt', () => {
  assert.match(macJob, /codesign --force --deep --sign -/);
  assert.match(macJob, /codesign --verify --deep --strict --verbose=4/);
  assert.match(macJob, /ditto -c -k --sequesterRsrc --keepParent/);
  assert.match(macJob, /Grabbr-\$\{VERSION\}-macOS-arm64\.zip/);
  assert.match(macJob, /Grabbr-\$\{VERSION\}-macOS-arm64\.dmg/);
});

test('Windowsjob garandeert x64 NSIS Setup en Portable zonder fragiel runnerlabel', () => {
  const runner = scalar(windowsJob, 'runs-on');
  assert.ok(/^windows-(?:latest|\d{4})$/.test(runner || ''), `Niet-ondersteunde Windows runnerconfiguratie: ${runner}`);
  assert.match(windowsJob, /PROCESSOR_ARCHITECTURE -ne 'AMD64'/);
  assert.match(windowsJob, /--win nsis portable --x64/);
  assert.match(windowsJob, /Windows-x64-Setup\.exe/);
  assert.match(windowsJob, /Windows-x64-Portable\.exe/);
});

test('releasejob genereert centrale SHA-256-checksums en uploadt complete set', () => {
  assert.match(draftJob, /SHA256SUMS\.txt/);
  assert.match(draftJob, /sha256sum/);
  assert.match(draftJob, /macOS-arm64\.zip/);
  assert.match(draftJob, /macOS-arm64\.dmg/);
  assert.match(draftJob, /Windows-x64-Setup\.exe/);
  assert.match(draftJob, /Windows-x64-Portable\.exe/);
});
