const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readme = read('README.md');
const building = read('docs/BUILDING.md');
const troubleshooting = read('docs/TROUBLESHOOTING.md');
const changelog = read('CHANGELOG.md');
const license = read('LICENSE');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const workflow = read('.github/workflows/release.yml');

test('README is gebruikersgericht en bevat platforminstallatie en Releases', () => {
  assert.match(readme, /^# Grabbr/m);
  assert.match(readme, /GitHub Releases/);
  assert.match(readme, /## Installeren op macOS/);
  assert.match(readme, /## Installeren op Windows/);
  assert.match(readme, /Apple Developer ID/);
  assert.match(readme, /niet genotarized/);
  assert.match(readme, /Scherm- en systeemaudio-opname/);
  assert.match(readme, /Sluit Grabbr volledig af/);
  assert.match(readme, /downloadt of installeert updates niet automatisch/);
});

test('README beschrijft actuele OCR, tray, hotkeys, clipboard, opslag en instellingen', () => {
  for (const phrase of ['OCR-tekst vastleggen', 'System Tray', 'Standaardhotkeys', 'Clipboard en opslaan', 'Automatisch controleren op updates', 'Instellingen → Over']) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('builddocumentatie weerspiegelt package en releaseworkflow', () => {
  assert.equal(pkg.version, '0.7.6');
  assert.equal(lock.version, '0.7.6');
  assert.match(building, /Node\.js \*\*24\.x\*\*/);
  assert.match(building, /Electron 45\.4\.1/);
  assert.match(building, /electron-builder 26\.18\.1/);
  assert.match(building, /npm ci --ignore-scripts/);
  assert.match(building, /develop/);
  assert.match(building, /Draft Release/);
  assert.match(building, /ad-hoc gesigned/);
  assert.match(workflow, /runs-on: macos-15/);
  assert.match(workflow, /runs-on: windows-latest/);
});

test('troubleshooting bevat concrete Gatekeeper, TCC, clipboard, OCR, hotkey, notificatie en SmartScreen-stappen', () => {
  for (const phrase of ['Open toch', 'xattr -dr com.apple.quarantine', 'tccutil reset ScreenCapture com.grabbr.app', 'Clipboard kopieert niet', 'OCR herkent niets', 'Globale hotkey werkt niet', 'Geen OCR- of succesnotificatie', 'Windows SmartScreen']) {
    assert.match(troubleshooting, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('MIT License is expliciet gekozen voor Peter Krijgsman in 2026', () => {
  assert.equal(pkg.license, 'MIT');
  assert.match(license, /^MIT License/m);
  assert.match(license, /Copyright \(c\) 2026 Peter Krijgsman/);
  assert.match(readme, /MIT-licentie/);
});

test('CHANGELOG loopt chronologisch tot en met 0.7.6', () => {
  const versions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)$/gm)].map(match => match[1]);
  assert.equal(versions[0], '0.7.6');
  for (let index = 1; index < versions.length; index++) {
    const left = versions[index - 1].split('.').map(Number);
    const right = versions[index].split('.').map(Number);
    assert.ok(left[0] > right[0] || left[0] === right[0] && (left[1] > right[1] || left[1] === right[1] && left[2] > right[2]));
  }
});

test('geen CONTRIBUTING of oude projectbranding in documentatie', () => {
  assert.equal(fs.existsSync(path.join(root, 'CONTRIBUTING.md')), false);
  const markdown = ['README.md', 'ARCHITECTURE.md', 'CHANGELOG.md', 'docs/BUILDING.md', 'docs/TROUBLESHOOTING.md'].map(read).join('\n');
  assert.doesNotMatch(markdown, /LocalShot|LanTel/i);
  assert.doesNotMatch(readme, /\[Bijdragen\]/);
});

test('alle lokale Markdown-links in README bestaan', () => {
  const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]);
  for (const link of links) {
    if (/^(?:https?:|\.\.\/\.\.\/|#)/.test(link)) continue;
    assert.equal(fs.existsSync(path.join(root, link)), true, `Ontbrekend README-linkdoel: ${link}`);
  }
});
